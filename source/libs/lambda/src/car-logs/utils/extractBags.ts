// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';

import { logger } from '@deepracer-indy/utils';
import { extract as tarExtract } from 'tar-stream';

import { CarLogJobError } from './jobErrors.js';
import { checkTarEntry, DEFAULT_TAR_LIMITS, TarBudget, type TarLimits } from './tarSafety.js';

export type BagResolution<T> = { accept: true; context: T } | { accept: false; reason: string };

export interface ExtractBagsOptions<T> {
  /** Decides, once per bag directory, whether it is extracted and with which context. */
  resolve: (bagDir: string) => Promise<BagResolution<T>>;
  /** Stores one file of an accepted bag; must consume the stream. */
  write: (context: T, bagDir: string, relativePath: string, body: Readable, size: number) => Promise<void>;
  limits?: TarLimits;
}

export interface ExtractedBag<T> {
  bagDir: string;
  context: T;
  files: string[];
}

export interface ExtractBagsResult<T> {
  accepted: ExtractedBag<T>[];
  skipped: { bagDir: string; reason: string }[];
}

/**
 * Streams a `.tar.gz` of rosbag directories without holding it in memory or on disk. The archive
 * is untrusted: any entry that is not a plain file or directory inside a bag directory, or that
 * exceeds the limits, aborts the whole extraction with a {@link CarLogJobError}.
 */
export async function extractBags<T>(
  source: Readable,
  { resolve, write, limits = DEFAULT_TAR_LIMITS }: ExtractBagsOptions<T>,
): Promise<ExtractBagsResult<T>> {
  const budget = new TarBudget(limits);
  const resolutions = new Map<string, BagResolution<T>>();
  const files = new Map<string, string[]>();
  const extract = tarExtract();
  let abortError: unknown;

  extract.on('entry', (header, stream, next) => {
    const handle = async () => {
      const decision = checkTarEntry(header);
      if (!decision.ok) {
        throw new CarLogJobError(`The archive contains an unsupported entry (${decision.reason}).`);
      }
      const limitReason = budget.add(header.size ?? 0);
      if (limitReason) {
        throw new CarLogJobError(`The archive exceeds the allowed size (${limitReason}).`);
      }
      if (decision.isDirectory) {
        stream.resume();
        return;
      }

      let resolution = resolutions.get(decision.bagDir);
      if (!resolution) {
        resolution = await resolve(decision.bagDir);
        resolutions.set(decision.bagDir, resolution);
      }
      if (!resolution.accept) {
        stream.resume();
        return;
      }

      // tar-stream entries are not Node Readables, which the S3 upload client requires.
      await write(resolution.context, decision.bagDir, decision.relativePath, Readable.from(stream), header.size ?? 0);
      files.set(decision.bagDir, [...(files.get(decision.bagDir) ?? []), decision.relativePath]);
    };

    handle().then(
      () => next(),
      (error) => {
        abortError = error;
        stream.destroy();
        extract.destroy(error);
      },
    );
  });

  try {
    await pipeline(source, createGunzip(), extract);
  } catch (pipelineError) {
    // Destroying the entry stream can surface as a premature-close error; the first failure is the cause.
    const error = abortError ?? pipelineError;
    if (error instanceof CarLogJobError) {
      throw error;
    }
    // The user-facing message is generic, so the real cause has to be in the logs.
    logger.error('The archive could not be read', { error });
    throw new CarLogJobError('The archive could not be read.', { cause: error });
  }

  const result: ExtractBagsResult<T> = { accepted: [], skipped: [] };
  for (const [bagDir, resolution] of resolutions) {
    if (resolution.accept) {
      result.accepted.push({ bagDir, context: resolution.context, files: files.get(bagDir) ?? [] });
    } else {
      result.skipped.push({ bagDir, reason: resolution.reason });
    }
  }
  return result;
}
