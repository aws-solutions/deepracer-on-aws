// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import {
  isUnimplemented,
  OPERATION_OWNER,
  operationsOwnedBy,
  StackKey,
  UNIMPLEMENTED_OPERATIONS,
} from '../operationOwnership.js';

/**
 * Exhaustiveness and disjointness are enforced at compile time by
 * `as const satisfies Record<DeepRacerIndyServiceOperations, StackKey>` and by object
 * keys being unique. These tests cover the runtime helpers derived from that map, and
 * assert the partition properties the rest of the framework depends on.
 */
describe('operationOwnership', () => {
  const STACK_KEYS: StackKey[] = [
    'core',
    'eventManagement',
    'modelManagement',
    'realTimeRoles',
    'deviceManagement',
    'carLogs',
  ];

  it('partitions every operation across stack keys with no gaps', () => {
    const partitioned = STACK_KEYS.flatMap((key) => operationsOwnedBy(key));
    expect(partitioned.sort()).toEqual(Object.keys(OPERATION_OWNER).sort());
  });

  it('assigns each operation to exactly one stack — no double ownership', () => {
    const partitioned = STACK_KEYS.flatMap((key) => operationsOwnedBy(key));
    expect(new Set(partitioned).size).toBe(partitioned.length);
  });

  it('returns operations in a deterministic sorted order', () => {
    // Callers use this to create constructs, so ordering determines resource ordering
    // in the synthesized template. Sorting decouples that from the readability
    // grouping of OPERATION_OWNER.
    const ops = operationsOwnedBy('core');
    expect(ops).toEqual([...ops].sort());
    expect(operationsOwnedBy('core')).toEqual(ops);
  });

  it('assigns every Car Logs operation to the carLogs key', () => {
    expect(operationsOwnedBy('carLogs')).toEqual([
      'CreateCarLogUpload',
      'DeleteCarLogAsset',
      'GetCarLogAssetUrls',
      'GetCarLogFetch',
      'ListCarLogAssets',
      'ListCarLogFetches',
      'StartCarLogFetch',
    ]);
  });

  it('assigns every Event Management operation to the eventManagement key', () => {
    expect(operationsOwnedBy('eventManagement').sort()).toEqual(
      [
        'CreateEvent',
        'DeleteEvent',
        'EditEvent',
        'GetEvent',
        'ListEvents',
        'TransitionEventStatus',
        'CreateRun',
        'GetRun',
        'ListRuns',
        'TransitionRunStatus',
        'CreateLap',
        'UpdateLap',
        'SetLapValidity',
        'GetEventStatistics',
        'AddTrackToEvent',
        'RemoveTrackFromEvent',
        'ListEventTracks',
        'GetCombinedLeaderboard',
      ].sort(),
    );
  });

  it('keeps every unimplemented operation owned by a real stack key', () => {
    // A stub still needs an owner: an unowned operation would fail spec assembly.
    for (const operation of UNIMPLEMENTED_OPERATIONS) {
      expect(OPERATION_OWNER[operation]).toBeDefined();
      expect(STACK_KEYS).toContain(OPERATION_OWNER[operation]);
    }
  });

  it('identifies unimplemented operations and only those', () => {
    for (const operation of UNIMPLEMENTED_OPERATIONS) {
      expect(isUnimplemented(operation)).toBe(true);
    }
    expect(isUnimplemented('CreateEvent')).toBe(false);
    expect(isUnimplemented('CreateModel')).toBe(false);
  });

  it('does not claim any Event Management operation is unimplemented', () => {
    // Epic 3 handlers exist; if one were listed as a stub it would route to the 501.
    for (const operation of operationsOwnedBy('eventManagement')) {
      expect(isUnimplemented(operation)).toBe(false);
    }
  });

  it('assigns every Model Management operation to the modelManagement key', () => {
    expect(operationsOwnedBy('modelManagement').sort()).toEqual(
      [
        'DeployModel',
        'GetDeployment',
        'ImportPhysicalModel',
        'ListAdminModels',
        'ListDeployments',
        'ListDeploymentsByBatch',
        'ListDeploymentsByEvent',
        'PackageModel',
      ].sort(),
    );
  });

  it('does not claim any Model Management operation is unimplemented', () => {
    for (const operation of operationsOwnedBy('modelManagement')) {
      expect(isUnimplemented(operation)).toBe(false);
    }
  });
});
