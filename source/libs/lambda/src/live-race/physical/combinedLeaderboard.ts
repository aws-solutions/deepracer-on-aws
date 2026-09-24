// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { eventDao, leaderboardDao, rankingDao, type RankingItem, type ResourceId } from '@deepracer-indy/database';
import { CombinedScoringStrategy } from '@deepracer-indy/typescript-server-client';
import { logger, metrics, waitForAll } from '@deepracer-indy/utils';

/**
 * Per-racer ranking scores gathered across an event's tracks, keyed by leaderboardId (track).
 */
type ScoresByTrack = ReadonlyMap<ResourceId, RankingItem>;

/**
 * Computes a racer's combined score across tracks per the event's configured strategy, from
 * however many tracks they've currently raced (1 to N — not necessarily all of the event's
 * tracks). Multi-track events commonly run tracks concurrently as independent heats (PRD
 * US-3.2.1 — "concurrent qualifying and finals with unified standings"); the combined leaderboard
 * must reflect real-time standings as racers complete individual tracks, not wait until every
 * racer has raced every track. Returns undefined only when the racer has no per-track score at all.
 *
 * Throws for an unrecognized strategy rather than returning undefined — the caller treats
 * `undefined` exclusively as "no per-track Ranking" and deletes any existing combined Ranking on
 * that signal. Conflating an unrecognized/future enum value with "no scores" would silently
 * delete a racer's valid combined Ranking, so this is surfaced as an error instead and caught by
 * the caller's error boundary (emits `CombinedLeaderboardRecomputeFailed`).
 */
export const computeCombinedScore = (
  strategy: CombinedScoringStrategy,
  scoresByTrack: ScoresByTrack,
): number | undefined => {
  const scores = Array.from(scoresByTrack.values()).map((r) => r.rankingScore);
  if (scores.length === 0) return undefined;

  switch (strategy) {
    case CombinedScoringStrategy.BEST_RESULT_PER_RACER:
      return Math.min(...scores);
    case CombinedScoringStrategy.SUM_ACROSS_TRACKS:
      return scores.reduce((a, b) => a + b, 0);
    case CombinedScoringStrategy.AVERAGE_ACROSS_TRACKS:
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    default:
      throw new Error(`Unsupported combined scoring strategy: ${strategy}`);
  }
};

/**
 * Recomputes the combined-leaderboard Ranking for a single racer within an event, aggregating
 * across whichever of the event's tracks that racer has currently raced. If the racer has no
 * per-track Ranking at all (e.g. their only Ranking was removed), any existing combined Ranking
 * for that racer is deleted so the combined leaderboard never shows a stale score.
 *
 * The combined leaderboard is represented as a Ranking collection keyed by `leaderboardId = eventId`,
 * reusing the existing RankingsEntity/RankingDao query surface (byLeaderboardId, sortedByRank) so a
 * future GetCombinedLeaderboard read can query it without any new storage.
 *
 * Idempotent: re-invocation with the same inputs re-derives the same outcome (upsert or
 * delete) from the current per-track Rankings — no side effects accumulate.
 *
 * Never throws — all failures are caught by the caller-facing wrapper below, which is the only
 * exported entry point invoked by the stream handler.
 */
const recomputeCombinedRankingForRacer = async (eventId: ResourceId, profileId: ResourceId): Promise<void> => {
  const event = await eventDao.get({ eventId });
  if (!event?.combinedScoringStrategy) return;

  // listByEventId uses ElectroDB's `pages: 'all'`, which auto-paginates through every DynamoDB
  // page internally before returning — `data` is already the complete, unpaginated result set (no
  // caller-side cursor to drain). Bounded by max-10-tracks-per-event limit regardless.
  const { data: tracks } = await leaderboardDao.listByEventId(eventId);
  if (tracks.length === 0) return;

  const rankingsByTrack = await waitForAll(
    tracks.map((track) => rankingDao.get({ leaderboardId: track.leaderboardId, profileId })),
  );

  const scoresByTrack: ScoresByTrack = new Map(
    tracks
      .map((track, i) => [track.leaderboardId, rankingsByTrack[i]] as const)
      .filter((entry): entry is [ResourceId, RankingItem] => entry[1] != null),
  );

  const combinedScore = computeCombinedScore(event.combinedScoringStrategy, scoresByTrack);
  const combinedLeaderboardId = eventId;

  if (combinedScore === undefined) {
    // Racer has no per-track Ranking at all (e.g. their only Ranking was removed). Clear any
    // stale combined Ranking so the combined leaderboard doesn't show an outdated score.
    await rankingDao.delete({ leaderboardId: combinedLeaderboardId, profileId });
    return;
  }

  // Display metadata (modelId/modelName/submissionId/submissionVideoS3Location/stats) is
  // per-submission, not per-racer — each track is a separate physical race with its own model,
  // video, and lap stats, so there is no single "correct" source across tracks. For
  // BEST_RESULT_PER_RACER the racer's best (lowest) per-track score IS the combined score, so its
  // Ranking is the unambiguous, correct source. SUM_ACROSS_TRACKS/AVERAGE_ACROSS_TRACKS have no
  // single source track for an aggregate; these required-but-otherwise-unused-by-GetCombinedLeaderboard
  // fields (see event-management-api-reference.md — only rankingScore/userProfile are
  // surfaced) are populated from the same best-performing track for consistency across strategies,
  // rather than arbitrary Map insertion order. userProfile (alias/avatar) is racer-level and is
  // therefore correct regardless of which Ranking is chosen.
  const [first, ...rest] = Array.from(scoresByTrack.values());
  const representative = rest.reduce((best, r) => (r.rankingScore < best.rankingScore ? r : best), first);

  const existing = await rankingDao.get({ leaderboardId: combinedLeaderboardId, profileId });
  const combinedAttrs = {
    rankingScore: combinedScore,
    modelId: representative.modelId,
    modelName: representative.modelName,
    submissionId: representative.submissionId,
    submissionNumber: representative.submissionNumber,
    submissionVideoS3Location: representative.submissionVideoS3Location,
    userProfile: representative.userProfile,
    stats: representative.stats,
  };

  if (existing) {
    await rankingDao.update({ leaderboardId: combinedLeaderboardId, profileId }, combinedAttrs);
  } else {
    await rankingDao.create({ leaderboardId: combinedLeaderboardId, profileId, ...combinedAttrs });
  }
};

/**
 * Entry point invoked from the stream handler when a per-track (physical) Ranking is written OR
 * removed (INSERT/MODIFY/REMOVE) for a leaderboard belonging to an event. Recomputes the combined
 * leaderboard for the affected racer — upserting it if they still have an eligible combined
 * score, or deleting any stale combined Ranking if they no longer have one.
 *
 * Wrapped in its own error boundary so a failure here (or the absence of
 * an eventId / combinedScoringStrategy) never blocks or delays the per-track leaderboard broadcast
 * that the caller performs independently.
 */
export const recomputeCombinedLeaderboard = async (eventId: ResourceId, profileId: ResourceId): Promise<void> => {
  try {
    await recomputeCombinedRankingForRacer(eventId, profileId);
    metrics.addMetric('CombinedLeaderboardRecomputed', 'Count', 1);
  } catch (error) {
    logger.error('Failed to recompute combined leaderboard', { error, eventId, profileId });
    metrics.addMetric('CombinedLeaderboardRecomputeFailed', 'Count', 1);
  }
};
