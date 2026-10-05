// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepRacerIndyServiceOperations } from '@deepracer-indy/typescript-server-client';

/**
 * Every stack that owns API-backed Lambda functions.
 *
 * `core` is the `ApiStack` / `Api` construct. Add a key here when an epic nested
 * stack ships, then move its operations over in {@link OPERATION_OWNER}.
 */
export type StackKey =
  'core' | 'eventManagement' | 'modelManagement' | 'realTimeRoles' | 'deviceManagement' | 'carLogs';

/**
 * THE authoritative assignment of every Smithy operation to its owning stack.
 *
 * This is the single source of truth for the core/epic split. Three properties
 * fall out of it, and they are the reason this map exists:
 *
 * 1. **Exhaustiveness** — `satisfies Record<DeepRacerIndyServiceOperations, StackKey>`
 *    makes a missing operation a compile error. An unowned operation would otherwise
 *    silently resolve to the `notImplemented` stub at runtime.
 * 2. **Disjointness** — an object key can hold exactly one value, so an operation
 *    cannot be claimed by two stacks. Double ownership would produce duplicate
 *    physical Lambda function names and fail the deployment.
 * 3. **Derivation** — `Api` derives its own operation list from this map rather than
 *    repeating it, so graduating a stub to an epic stack is a one-line change here
 *    plus the compiler-guided edits it forces.
 *
 */
export const OPERATION_OWNER = {
  // ── Profiles ───────────────────────────────────────────────────────────────
  CreateProfile: 'core',
  DeleteProfile: 'core',
  GetProfile: 'core',
  ListAdminProfiles: 'core',
  ListProfiles: 'core',
  UpdateProfile: 'core',
  UpdateGroupMembership: 'core',

  // ── Bulk user creation (Epic 6) ──────────────────────────────────────────────
  BulkInviteUser: 'core',
  GetBulkInviteUserJobStatus: 'core',
  ListBulkInviteUserJobs: 'core',
  ResendInvite: 'core',

  // ── Models ─────────────────────────────────────────────────────────────────
  CreateModel: 'core',
  DeleteModel: 'core',
  DeleteProfileModels: 'core',
  GetModel: 'core',
  ImportModel: 'core',
  ListModels: 'core',
  ListModelsForProfile: 'core',
  RetryTraining: 'core',
  StopModel: 'core',
  TestRewardFunction: 'core',

  // ── Evaluations ────────────────────────────────────────────────────────────
  CreateEvaluation: 'core',
  GetEvaluation: 'core',
  ListEvaluations: 'core',

  // ── Leaderboards, submissions, rankings ────────────────────────────────────
  CreateLeaderboard: 'core',
  CreateSubmission: 'core',
  DeleteLeaderboard: 'core',
  EditLeaderboard: 'core',
  GetLeaderboard: 'core',
  GetRanking: 'core',
  JoinLeaderboard: 'core',
  ListLeaderboards: 'core',
  ListRankings: 'core',
  ListSubmissions: 'core',

  // ── Live racing ────────────────────────────────────────────────────────────
  AttachLiveRacePolicy: 'core',
  ClearLiveLeaderboard: 'core',
  DeclareWinner: 'core',
  GetLiveRaceState: 'core',
  LaunchLiveRace: 'core',
  ListLiveQueueItems: 'core',
  RemoveLiveQueueItem: 'core',
  ReorderLiveQueue: 'core',
  ResetLiveQueueModel: 'core',

  // ── Assets and global settings ─────────────────────────────────────────────
  GetAdminAssetUrl: 'core',
  GetAssetUrl: 'core',
  GetGlobalSetting: 'core',
  UpdateGlobalSetting: 'core',

  // ── Race Management ─────────────────────────────────────────────────────────
  // ── Race Management (Epics 4+5) ────────────────────────────────────────────
  GetRaceStats: 'core',
  GetEventLeaderboard: 'realTimeRoles',
  RegisterUser: 'realTimeRoles',

  // ── Event Management ────────────────────────────────────────────────────────
  CreateEvent: 'eventManagement',
  DeleteEvent: 'eventManagement',
  EditEvent: 'eventManagement',
  GetEvent: 'eventManagement',
  ListEvents: 'eventManagement',
  TransitionEventStatus: 'eventManagement',
  AddTrackToEvent: 'eventManagement',
  RemoveTrackFromEvent: 'eventManagement',
  ListEventTracks: 'eventManagement',
  GetCombinedLeaderboard: 'eventManagement',

  // ── Timekeeping (Runs and Laps) ─────────────────────────────────────────────
  CreateRun: 'eventManagement',
  GetRun: 'eventManagement',
  ListRuns: 'eventManagement',
  TransitionRunStatus: 'eventManagement',
  CreateLap: 'eventManagement',
  UpdateLap: 'eventManagement',
  SetLapValidity: 'eventManagement',
  GetEventStatistics: 'eventManagement',

  // ── Model Management ────────────────────────────────────────────────────────
  DeployModel: 'modelManagement',
  GetDeployment: 'modelManagement',
  ImportPhysicalModel: 'modelManagement',
  ListAdminModels: 'modelManagement',
  ListDeployments: 'modelManagement',
  ListDeploymentsByBatch: 'modelManagement',
  ListDeploymentsByEvent: 'modelManagement',
  PackageModel: 'modelManagement',

  // ── Epic 2 — Device & Fleet Management ─────────────────────────────────────
  // Graduated off the shared `core` stub into DeviceManagementStack.
  ListDevices: 'deviceManagement',
  ActivateDevice: 'deviceManagement',
  ClearDeviceModels: 'deviceManagement',
  DeleteDevice: 'deviceManagement',
  UpdateDevice: 'deviceManagement',
  BatchUpdateDevice: 'deviceManagement',
  RestartDevice: 'deviceManagement',
  StopDevice: 'deviceManagement',
  ChangeDeviceColor: 'deviceManagement',
  ListFleets: 'deviceManagement',
  CreateFleet: 'deviceManagement',
  UpdateFleet: 'deviceManagement',
  DeleteFleet: 'deviceManagement',
  AssignEventFleets: 'deviceManagement',
  ListEventDevices: 'deviceManagement',

  // ── Car logs — rosbag fetch and video generation ───────────────────────────
  StartCarLogFetch: 'carLogs',
  ListCarLogFetches: 'carLogs',
  GetCarLogFetch: 'carLogs',
  ListCarLogAssets: 'carLogs',
  GetCarLogAssetUrls: 'carLogs',
  DeleteCarLogAsset: 'carLogs',
  CreateCarLogUpload: 'carLogs',
} as const satisfies Record<DeepRacerIndyServiceOperations, StackKey>;

/**
 * Operations with no handler yet. All of them share a single stub Lambda rather
 * than getting one function each.
 *
 * Why one shared function: a per-operation stub carries an explicit physical name
 * (`{namespace}-DeepRacerIndyApi-{Operation}Function`). When the operation later
 * graduates to an epic nested stack, CloudFormation creates the new function
 * before deleting the old one, the names collide, and the update rolls back. One
 * generically-named function has nothing to move.
 *
 * Currently empty: every modeled operation has a real handler. Add an operation
 * here (and it will route to the shared 501 stub) when its handler has not landed yet.
 *
 */
export const UNIMPLEMENTED_OPERATIONS = [] as const satisfies readonly DeepRacerIndyServiceOperations[];

export type UnimplementedOperation = (typeof UNIMPLEMENTED_OPERATIONS)[number];

/** Compile-time: the exact operation union owned by a given stack. */
export type OperationsOwnedBy<K extends StackKey> = {
  [Op in keyof typeof OPERATION_OWNER]: (typeof OPERATION_OWNER)[Op] extends K ? Op : never;
}[keyof typeof OPERATION_OWNER];

/** Operations owned by a stack that still need a real handler written. */
export type StubOperationsOwnedBy<K extends StackKey> = Extract<OperationsOwnedBy<K>, UnimplementedOperation>;

/** Operations owned by a stack that have a real handler. */
export type ImplementedOperationsOwnedBy<K extends StackKey> = Exclude<OperationsOwnedBy<K>, UnimplementedOperation>;

/**
 * Runtime counterpart to {@link OperationsOwnedBy}, for iterating when building
 * entry-point maps or asserting ownership in tests.
 *
 * Sorted alphabetically, deliberately: callers use this to create constructs, so
 * the return order determines resource ordering in the synthesized template.
 * Sorting decouples that from the grouping of {@link OPERATION_OWNER}, so the map
 * can be reorganized for readability without producing a template diff.
 */
export function operationsOwnedBy<K extends StackKey>(key: K): OperationsOwnedBy<K>[] {
  return (Object.entries(OPERATION_OWNER) as [DeepRacerIndyServiceOperations, StackKey][])
    .filter(([, owner]) => owner === key)
    .map(([operation]) => operation)
    .sort() as OperationsOwnedBy<K>[];
}

/** True when the operation has no handler and should route to the shared stub. */
export function isUnimplemented(operation: DeepRacerIndyServiceOperations): operation is UnimplementedOperation {
  return (UNIMPLEMENTED_OPERATIONS as readonly DeepRacerIndyServiceOperations[]).includes(operation);
}
