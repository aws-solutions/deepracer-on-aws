// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { isSafeBagDirName } from './bagMatcher.js';

export interface TarLimits {
  maxEntries: number;
  maxEntryBytes: number;
  maxTotalBytes: number;
}

export const DEFAULT_TAR_LIMITS: TarLimits = {
  maxEntries: 20_000,
  maxEntryBytes: 10 * 1024 ** 3,
  maxTotalBytes: 20 * 1024 ** 3,
};

/** Characters allowed in the path segments below a bag directory; excludes `%`, which URL parsing would decode into dot segments. */
const SAFE_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export const isSafePathSegment = (segment: string) =>
  SAFE_SEGMENT_PATTERN.test(segment) && segment !== '.' && segment !== '..';

export type TarEntryDecision =
  { ok: true; bagDir: string; relativePath: string; isDirectory: boolean } | { ok: false; reason: string };

/**
 * Checks one entry of an untrusted archive before anything is written. Only regular files and
 * directories two or more levels below the archive root are accepted (`<bag dir>/<file>`), and
 * paths must stay inside their bag directory: absolute paths, `..`, backslashes and links are
 * rejected, so nothing can be written outside the destination prefix or aliased to another object.
 */
export function checkTarEntry(header: { name: string; type?: string | null; size?: number }): TarEntryDecision {
  const isDirectory = header.type === 'directory';
  if (header.type !== 'file' && !isDirectory) {
    return { ok: false, reason: `unsupported entry type ${header.type ?? 'unknown'}` };
  }

  const name = header.name;
  if (name.includes('\0') || name.includes('\\') || name.startsWith('/')) {
    return { ok: false, reason: 'unsafe path' };
  }
  const segments = name.split('/').filter((segment) => segment !== '' && segment !== '.');
  if (segments.some((segment) => segment === '..')) {
    return { ok: false, reason: 'path traversal' };
  }
  if (segments.length === 0) {
    return { ok: false, reason: 'empty path' };
  }
  if (!isSafeBagDirName(segments[0])) {
    return { ok: false, reason: 'unsupported directory name' };
  }
  if (segments.length === 1 && !isDirectory) {
    return { ok: false, reason: 'file outside of a bag directory' };
  }
  if (!segments.slice(1).every(isSafePathSegment)) {
    return { ok: false, reason: 'unsupported file name' };
  }
  const relativePath = segments.slice(1).join('/');
  if (relativePath.length > 500 || segments.some((segment) => segment.length > 255)) {
    return { ok: false, reason: 'path too long' };
  }

  return { ok: true, bagDir: segments[0], relativePath, isDirectory };
}

/** Tracks entry and byte totals of one archive against its limits. */
export class TarBudget {
  private entries = 0;
  private bytes = 0;

  constructor(private readonly limits: TarLimits = DEFAULT_TAR_LIMITS) {}

  /** Counts an entry; returns a reason when a limit is exceeded. */
  add(size: number): string | undefined {
    this.entries += 1;
    this.bytes += size;
    if (this.entries > this.limits.maxEntries) {
      return 'too many entries';
    }
    if (size > this.limits.maxEntryBytes) {
      return 'entry too large';
    }
    if (this.bytes > this.limits.maxTotalBytes) {
      return 'archive too large when extracted';
    }
    return undefined;
  }
}
