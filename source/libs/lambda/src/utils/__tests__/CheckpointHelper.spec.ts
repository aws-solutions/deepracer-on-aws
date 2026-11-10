// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { HeadObjectCommand, NotFound, S3Client } from '@aws-sdk/client-s3';
import { s3PathHelper, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { BadRequestError, CheckpointSelection } from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, s3Helper } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';

import { checkpointHelper } from '../CheckpointHelper.js';

const MODEL_KEY = { modelId: TEST_MODEL_ITEM.modelId, profileId: TEST_MODEL_ITEM.profileId };
const TRAINED_HERE = { includeCompletion: true };

const CHECKPOINTS_JSON = JSON.stringify({
  best_checkpoint: { name: '12_Step-3456.ckpt', avg_eval_metric: 100, time_stamp: 1234.5 },
  last_checkpoint: { name: '15_Step-4100.ckpt', avg_eval_metric: 87.5, time_stamp: 1300.2 },
});

const LAST_INDEX_KEY = new AmazonS3URI(
  s3PathHelper.getSageMakerModelFileS3Location(MODEL_KEY.modelId, MODEL_KEY.profileId, '15_Step-4100.ckpt.index'),
).key;

describe('CheckpointHelper', () => {
  const mockS3Client = mockClient(S3Client);

  beforeEach(() => {
    mockS3Client.reset();
    mockS3Client.on(HeadObjectCommand).resolves({});
  });

  describe('getModelCheckpoints()', () => {
    it("reads the model's best and last checkpoints", async () => {
      const getObjectSpy = vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(CHECKPOINTS_JSON);

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, TRAINED_HERE)).resolves.toEqual({
        best: { iteration: 12, completionPercentage: 100 },
        last: { iteration: 15, completionPercentage: 87.5 },
      });
      expect(getObjectSpy).toHaveBeenCalledWith(
        s3PathHelper.getDeepRacerCheckpointsS3Location(MODEL_KEY.modelId, MODEL_KEY.profileId),
        false,
      );
      expect(mockS3Client).toHaveReceivedCommandWith(HeadObjectCommand, { Key: LAST_INDEX_KEY });
    });

    it('leaves out the completion figure for a model trained elsewhere, which may rank by reward', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(CHECKPOINTS_JSON);

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, { includeCompletion: false })).resolves.toEqual({
        best: { iteration: 12 },
        last: { iteration: 15 },
      });
    });

    it('leaves out a last checkpoint whose files are missing, as in a partial import', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(CHECKPOINTS_JSON);
      mockS3Client.on(HeadObjectCommand).rejects(new NotFound({ message: 'Not Found', $metadata: {} }));

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, TRAINED_HERE)).resolves.toEqual({
        best: { iteration: 12, completionPercentage: 100 },
        last: undefined,
      });
    });

    it('reads the completion percentage under its older name', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(
        JSON.stringify({ best_checkpoint: { name: '3_Step-900.ckpt', avg_comp_pct: 50 } }),
      );

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, TRAINED_HERE)).resolves.toEqual({
        best: { iteration: 3, completionPercentage: 50 },
        last: undefined,
      });
    });

    it('leaves out a metric that is not a completion percentage, such as a lap time', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(
        JSON.stringify({ best_checkpoint: { name: '3_Step-900.ckpt', avg_eval_metric: 12345 } }),
      );

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, TRAINED_HERE)).resolves.toEqual({
        best: { iteration: 3 },
        last: undefined,
      });
    });

    it.each([
      ['the file is missing', ''],
      ['the file is not JSON', 'not json'],
      ['no checkpoint has a recognizable name', JSON.stringify({ best_checkpoint: { name: 'model.pb' } })],
    ])('returns undefined when %s', async (_, content) => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(content);

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, TRAINED_HERE)).resolves.toBeUndefined();
    });

    it('returns undefined when the file cannot be read, so the console still offers Best', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockRejectedValue(new Error('SlowDown'));

      await expect(checkpointHelper.getModelCheckpoints(MODEL_KEY, TRAINED_HERE)).resolves.toBeUndefined();
    });
  });

  describe('validateCheckpointSelection()', () => {
    it.each([undefined, CheckpointSelection.BEST])('accepts %s without reading the checkpoints', async (checkpoint) => {
      const getObjectSpy = vi.spyOn(s3Helper, 'getObjectAsStringFromS3');

      await expect(checkpointHelper.validateCheckpointSelection(MODEL_KEY, checkpoint)).resolves.toBeUndefined();
      expect(getObjectSpy).not.toHaveBeenCalled();
    });

    it('accepts LAST when the model has a last checkpoint with its files', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(CHECKPOINTS_JSON);

      await expect(
        checkpointHelper.validateCheckpointSelection(MODEL_KEY, CheckpointSelection.LAST),
      ).resolves.toBeUndefined();
    });

    it('rejects LAST when the model has no last checkpoint', async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue('');

      await expect(checkpointHelper.validateCheckpointSelection(MODEL_KEY, CheckpointSelection.LAST)).rejects.toThrow(
        BadRequestError,
      );
    });

    it("rejects LAST when the last checkpoint's files are missing", async () => {
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(CHECKPOINTS_JSON);
      mockS3Client.on(HeadObjectCommand).rejects(new NotFound({ message: 'Not Found', $metadata: {} }));

      await expect(checkpointHelper.validateCheckpointSelection(MODEL_KEY, CheckpointSelection.LAST)).rejects.toThrow(
        BadRequestError,
      );
    });

    it('passes a failed read through instead of reporting a missing checkpoint, so the caller can retry', async () => {
      const throttled = new Error('SlowDown');
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockRejectedValue(throttled);

      await expect(checkpointHelper.validateCheckpointSelection(MODEL_KEY, CheckpointSelection.LAST)).rejects.toBe(
        throttled,
      );
    });

    it('passes a failed file check through instead of reporting missing files', async () => {
      const denied = Object.assign(new Error('Access Denied'), { name: 'AccessDenied' });
      vi.spyOn(s3Helper, 'getObjectAsStringFromS3').mockResolvedValue(CHECKPOINTS_JSON);
      mockS3Client.on(HeadObjectCommand).rejects(denied);

      await expect(checkpointHelper.validateCheckpointSelection(MODEL_KEY, CheckpointSelection.LAST)).rejects.toBe(
        denied,
      );
    });
  });

  describe('toSimAppCheckpoint()', () => {
    it.each([
      [undefined, 'best'],
      [CheckpointSelection.BEST, 'best'],
      [CheckpointSelection.LAST, 'last'],
    ] as const)('maps %s to %s', (checkpoint, expected) => {
      expect(checkpointHelper.toSimAppCheckpoint(checkpoint)).toBe(expected);
    });
  });
});
