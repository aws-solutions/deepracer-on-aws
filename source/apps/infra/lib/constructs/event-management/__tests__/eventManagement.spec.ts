// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { formatEntryPoints } from '../eventManagement.js';

const TEST_PREFIX = 'api/handlers/';
const TEST_ENTRY_POINTS = {
  CreateEvent: 'createEvent',
  GetEvent: 'getEvent',
  ListEvents: 'listEvents',
  EditEvent: 'editEvent',
  DeleteEvent: 'deleteEvent',
  TransitionEventStatus: 'transitionEventStatus',
  AddTrackToEvent: 'addTrackToEvent',
  RemoveTrackFromEvent: 'removeTrackFromEvent',
  ListEventTracks: 'listEventTracks',
  CreateRun: 'createRun',
  GetRun: 'getRun',
  ListRuns: 'listRuns',
  TransitionRunStatus: 'transitionRunStatus',
  CreateLap: 'createLap',
  UpdateLap: 'updateLap',
  SetLapValidity: 'setLapValidity',
  GetEventStatistics: 'getEventStatistics',
  GetCombinedLeaderboard: 'getCombinedLeaderboard',
} as const;

describe('formatEntryPoints', () => {
  it('should prepend the prefix to each entry point value', () => {
    const entryPoints = { ...TEST_ENTRY_POINTS };
    const result = formatEntryPoints(entryPoints, TEST_PREFIX);

    expect(result.CreateEvent).toBe('api/handlers/createEvent');
    expect(result.GetEvent).toBe('api/handlers/getEvent');
    expect(result.ListEvents).toBe('api/handlers/listEvents');
    expect(result.EditEvent).toBe('api/handlers/editEvent');
    expect(result.DeleteEvent).toBe('api/handlers/deleteEvent');
    expect(result.TransitionEventStatus).toBe('api/handlers/transitionEventStatus');
    expect(result.AddTrackToEvent).toBe('api/handlers/addTrackToEvent');
    expect(result.RemoveTrackFromEvent).toBe('api/handlers/removeTrackFromEvent');
  });

  it('should preserve all keys from the input dictionary', () => {
    const entryPoints = { ...TEST_ENTRY_POINTS };
    const unmutatedEntryPointsLength = Object.keys(entryPoints).length;
    const result = formatEntryPoints(entryPoints, TEST_PREFIX);

    expect(Object.keys(result)).toEqual(Object.keys(TEST_ENTRY_POINTS));
    expect(Object.keys(result).length).toBe(unmutatedEntryPointsLength);
  });

  it('should handle a different prefix', () => {
    const entryPoints = { ...TEST_ENTRY_POINTS };
    const customPrefix = 'custom/path/';
    const result = formatEntryPoints(entryPoints, customPrefix);

    expect(result.CreateEvent).toBe('custom/path/createEvent');
    expect(result.GetEvent).toBe('custom/path/getEvent');
  });

  it('should handle an empty prefix', () => {
    const entryPoints = { ...TEST_ENTRY_POINTS };
    const result = formatEntryPoints(entryPoints, '');

    expect(result.CreateEvent).toBe('createEvent');
    expect(result.GetEvent).toBe('getEvent');
  });

  it('should handle entry points that already contain a path', () => {
    const entryPoints = {
      CreateEvent: 'nested/createEvent',
      GetEvent: 'nested/getEvent',
      ListEvents: 'listEvents',
      EditEvent: 'editEvent',
      DeleteEvent: 'deleteEvent',
      TransitionEventStatus: 'transitionEventStatus',
      AddTrackToEvent: 'addTrackToEvent',
      RemoveTrackFromEvent: 'removeTrackFromEvent',
      ListEventTracks: 'listEventTracks',
      CreateRun: 'createRun',
      GetRun: 'getRun',
      ListRuns: 'listRuns',
      TransitionRunStatus: 'transitionRunStatus',
      CreateLap: 'createLap',
      UpdateLap: 'updateLap',
      SetLapValidity: 'setLapValidity',
      GetEventStatistics: 'getEventStatistics',
      GetCombinedLeaderboard: 'getCombinedLeaderboard',
    } as const;

    const result = formatEntryPoints(entryPoints, TEST_PREFIX);

    expect(result.CreateEvent).toBe('api/handlers/nested/createEvent');
    expect(result.GetEvent).toBe('api/handlers/nested/getEvent');
  });
});
