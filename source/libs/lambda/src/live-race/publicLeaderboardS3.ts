// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PutObjectCommand } from '@aws-sdk/client-s3';
import { rankingDao, type ResourceId } from '@deepracer-indy/database';
import { logger, s3Client } from '@deepracer-indy/utils';

const HTML_ENCODE_MAP: Record<string, string> = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' };
export const sanitizeDisplayField = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.replace(/[<>&"']/g, (c) => HTML_ENCODE_MAP[c] ?? c).trim();
};

interface LeaderboardEntry {
  rank: number;
  participantName: string;
  bestLapTimeMilliseconds: number;
  modelName: string;
  country: string;
}

/**
 * Publishes a leaderboard's current rankings (per-track or combined, keyed by `leaderboardId`)
 * to `public/leaderboards/{leaderboardId}.json` for the public leaderboard page's S3 hydration.
 * Bucket is a parameter (not read from `process.env`) so any Lambda granted write access can
 * call this without configuring env vars it has no other reason to set.
 */
export const publishLeaderboardToS3 = async (
  bucket: string,
  leaderboardId: ResourceId,
  leaderboardName?: string,
  leaderboardFooter?: string,
): Promise<void> => {
  // Exhaust all pages: listByRank paginates with a cursor, so a single call only
  // returns DEFAULT_MAX_QUERY_RESULTS rows. Follow the cursor until exhausted.
  const allRankings: Awaited<ReturnType<typeof rankingDao.listByRank>>['data'] = [];
  let cursor: string | null = null;
  do {
    const page = await rankingDao.listByRank({ leaderboardId, cursor });
    allRankings.push(...page.data);
    cursor = page.cursor;
  } while (cursor !== null);

  const entries: LeaderboardEntry[] = allRankings.map((r, i) => ({
    rank: i + 1,
    participantName: sanitizeDisplayField(r.userProfile?.alias),
    bestLapTimeMilliseconds: r.rankingScore ?? 0,
    modelName: sanitizeDisplayField(r.modelName),
    country: sanitizeDisplayField((r.userProfile as unknown as Record<string, string> | undefined)?.countryCode),
  }));

  const key = `public/leaderboards/${leaderboardId}.json`;
  const body = JSON.stringify({
    leaderboardId,
    name: leaderboardName === undefined ? undefined : sanitizeDisplayField(leaderboardName),
    footer: leaderboardFooter === undefined ? undefined : sanitizeDisplayField(leaderboardFooter),
    updatedAt: new Date().toISOString(),
    rankings: entries,
  });

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'max-age=5',
    }),
  );

  logger.info('Published leaderboard to S3', { leaderboardId, entryCount: entries.length, key });
};

/**
 * Writes an empty-rankings placeholder to `public/leaderboards/{leaderboardId}.json` if no
 * object exists there yet — prevents the page's first load from 404ing at the S3 origin before
 * any race has run. `name`/`footer` let the header show correctly from the first load too.
 * Best-effort: callers should not let a rejection propagate.
 */
export const publishEmptyLeaderboardPlaceholder = async (
  bucket: string,
  leaderboardId: ResourceId,
  name?: string,
  footer?: string,
): Promise<void> => {
  const key = `public/leaderboards/${leaderboardId}.json`;
  const body = JSON.stringify({
    leaderboardId,
    name: name === undefined ? undefined : sanitizeDisplayField(name),
    footer: footer === undefined ? undefined : sanitizeDisplayField(footer),
    updatedAt: new Date().toISOString(),
    rankings: [],
  });

  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'max-age=5',
      // Never clobber a real result already written for this key.
      IfNoneMatch: '*',
    }),
  );

  logger.info('Published empty leaderboard placeholder to S3', { leaderboardId, key });
};
