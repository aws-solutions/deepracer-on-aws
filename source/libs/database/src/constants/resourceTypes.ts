// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Represents a database entity.
 */
export enum ResourceType {
  EVALUATION = 'evaluation',
  EVENT = 'event',
  EVENTS = 'events',
  RUN = 'run',
  RUNS = 'runs',
  LAP = 'lap',
  /** Idempotency-token guard item for CreateLap; lives in the lap's item collection, TTL'd. */
  LAP_TOKEN = 'laptoken',
  LEADERBOARD = 'leaderboard',
  LEADERBOARDS = 'leaderboards',
  MODEL = 'model',
  PROFILE = 'profile',
  PROFILES = 'profiles',
  SUBMISSION = 'submission',
  TRAINING = 'training',
  RANKING = 'ranking',
  ACCOUNT_RESOURCE_USAGE = 'accountresourceusage',
  LIVE_QUEUE_ITEM = 'livequeueitem',

  // Race Manager — Device Management
  DEVICE = 'device',
  /** Fixed partition key value enabling list-all-devices queries */
  DEVICES = 'devices',
  FLEET = 'fleet',
  /** Fixed partition key value enabling list-all-fleets queries */
  FLEETS = 'fleets',
  FLEET_EVENT = 'fleetevent',

  DEPLOYMENT = 'deployment',
  BATCH = 'batch',
  RACESTATS = 'racestats',
  /** Bulk invite job, scoped under the initiating admin's profile partition (Epic 6). */
  BULK_INVITE_JOB = 'bulkinvitejob',
  /** Idempotency-token guard item for BulkInviteUser; lives in the job's item collection, TTL'd. */
  BULK_INVITE_JOB_TOKEN = 'bulkinvitejobtoken',
}
