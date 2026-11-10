// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { HeadObjectCommand } from '@aws-sdk/client-s3';
import { type ResourceId, s3PathHelper } from '@deepracer-indy/database';
import {
  BadRequestError,
  type CheckpointInfo,
  CheckpointSelection,
  type ModelCheckpoints,
} from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, logger, s3Helper } from '@deepracer-indy/utils';

import { s3Client } from './clients/s3Client.js';

/** The checkpoint values the SimApp accepts for `EVAL_CHECKPOINT` and `pretrained_checkpoint`. */
export type SimAppCheckpoint = 'best' | 'last';

/** One entry of `deepracer_checkpoints.json`, as the SimApp writes it. */
interface DeepRacerCheckpointEntry {
  /** For example `"12_Step-3456.ckpt"`, where 12 is the training iteration. */
  name?: unknown;
  /** Average evaluation completion percentage of the checkpoint's iteration. */
  avg_eval_metric?: unknown;
  /** The same value under its name in older SimApp versions and community tooling. */
  avg_comp_pct?: unknown;
}

/** A checkpoint with the file name its TensorFlow files share. */
interface NamedCheckpoint extends CheckpointInfo {
  name: string;
}

interface ReadCheckpoints {
  best?: NamedCheckpoint;
  last?: NamedCheckpoint;
}

const CHECKPOINT_NAME_REGEX = /^(\d+)_Step-/;

/** Identifies a model whose checkpoints are read. */
interface ModelKey {
  modelId: ResourceId;
  profileId: ResourceId;
}

class CheckpointHelper {
  /**
   * The model's best and last checkpoints for display. Undefined when the model has none recorded or they
   * cannot be read right now; Best is always available, so the console then offers Best only.
   *
   * `includeCompletion` should be true only for a model trained by this solution, whose SimApp ranks
   * checkpoints by completion percentage. A model trained elsewhere may have ranked them by reward or lap
   * time, and the file does not say which, so its figure would be misread as a completion percentage.
   */
  async getModelCheckpoints(
    model: ModelKey,
    { includeCompletion }: { includeCompletion: boolean },
  ): Promise<ModelCheckpoints | undefined> {
    try {
      const checkpoints = await this.readCheckpoints(model);
      return (
        checkpoints && {
          best: this.toInfo(checkpoints.best, includeCompletion),
          last: this.toInfo(checkpoints.last, includeCompletion),
        }
      );
    } catch (error) {
      logger.warn('Unable to read model checkpoints', { modelId: model.modelId, error });
      return undefined;
    }
  }

  /**
   * Rejects LAST for a model that has no usable last checkpoint, so a job never silently falls back to
   * another checkpoint. A failed read is not a missing checkpoint: it is thrown as is, so the caller gets a
   * retryable server error rather than a validation error. BEST and no selection are always accepted, as
   * before.
   */
  async validateCheckpointSelection(model: ModelKey, checkpoint: CheckpointSelection | undefined): Promise<void> {
    if (checkpoint !== CheckpointSelection.LAST) {
      return;
    }
    const checkpoints = await this.readCheckpoints(model);
    if (!checkpoints?.last) {
      throw new BadRequestError({ message: 'The model has no last checkpoint to use.' });
    }
  }

  /** The SimApp value for a selection. No selection means BEST, the behavior before it could be chosen. */
  toSimAppCheckpoint(checkpoint: CheckpointSelection | undefined): SimAppCheckpoint {
    return checkpoint === CheckpointSelection.LAST ? 'last' : 'best';
  }

  /**
   * Reads `deepracer_checkpoints.json`. Returns undefined when the file is missing or holds no recognizable
   * checkpoint, and leaves out a last checkpoint whose files are not in S3, which can happen for an imported
   * model. Throws when S3 cannot be read.
   */
  private async readCheckpoints(model: ModelKey): Promise<ReadCheckpoints | undefined> {
    const location = s3PathHelper.getDeepRacerCheckpointsS3Location(model.modelId, model.profileId);
    const content = await s3Helper.getObjectAsStringFromS3(location, false);
    if (!content) {
      return undefined;
    }

    let json: Record<string, DeepRacerCheckpointEntry | undefined>;
    try {
      json = JSON.parse(content) as Record<string, DeepRacerCheckpointEntry | undefined>;
    } catch {
      logger.warn('Model checkpoints file is not valid JSON', { modelId: model.modelId });
      return undefined;
    }

    const best = this.toNamedCheckpoint(json.best_checkpoint);
    const recordedLast = this.toNamedCheckpoint(json.last_checkpoint);
    // Training always keeps the best checkpoint's files. The last one's are checked because an imported
    // model may name a checkpoint whose files were not uploaded, and the SimApp would then silently load
    // another checkpoint.
    const last = recordedLast && (await this.checkpointFilesExist(model, recordedLast)) ? recordedLast : undefined;

    return best || last ? { best, last } : undefined;
  }

  /** Whether the checkpoint's TensorFlow index file is in the model's S3 location. */
  private async checkpointFilesExist(model: ModelKey, checkpoint: NamedCheckpoint): Promise<boolean> {
    const { bucket, key } = new AmazonS3URI(
      s3PathHelper.getSageMakerModelFileS3Location(model.modelId, model.profileId, `${checkpoint.name}.index`),
    );
    try {
      await s3Client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (error) {
      const code = (error as { name?: string }).name;
      if (code === 'NotFound' || code === 'NoSuchKey') {
        logger.warn('Model checkpoint files are missing', { modelId: model.modelId, checkpoint: checkpoint.name });
        return false;
      }
      throw error;
    }
  }

  private toNamedCheckpoint(entry: DeepRacerCheckpointEntry | undefined): NamedCheckpoint | undefined {
    const name = typeof entry?.name === 'string' ? entry.name : undefined;
    const match = name ? CHECKPOINT_NAME_REGEX.exec(name) : null;
    if (!name || !match) {
      return undefined;
    }
    const metric = entry?.avg_eval_metric ?? entry?.avg_comp_pct;
    const isCompletionPercentage =
      typeof metric === 'number' && Number.isFinite(metric) && metric >= 0 && metric <= 100;

    return {
      name,
      iteration: Number(match[1]),
      ...(isCompletionPercentage ? { completionPercentage: metric } : {}),
    };
  }

  private toInfo(checkpoint: NamedCheckpoint | undefined, includeCompletion: boolean): CheckpointInfo | undefined {
    if (!checkpoint) {
      return undefined;
    }
    return {
      iteration: checkpoint.iteration,
      ...(includeCompletion && checkpoint.completionPercentage !== undefined
        ? { completionPercentage: checkpoint.completionPercentage }
        : {}),
    };
  }
}

export const checkpointHelper = new CheckpointHelper();
