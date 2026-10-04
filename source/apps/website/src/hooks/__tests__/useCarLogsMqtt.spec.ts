// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCarLogAssetTopic, buildCarLogJobTopic, useCarLogsMqtt } from '../useCarLogsMqtt';

const mockGetUserGroups = vi.fn();
const mockUseGetProfileQuery = vi.fn();
const mockDispatch = vi.fn();
type SubscriptionOptions = { onEvent: (event: Record<string, unknown>) => void };
const mockUseMqttSubscription = vi.fn(
  (_id: string, _topic: (namespace: string, id: string) => string, _options: SubscriptionOptions) => ({
    connectionStatus: 'CONNECTED',
  }),
);
const mockInvalidateTags = vi.fn((tags: unknown) => ({ type: 'invalidate', payload: tags }));

vi.mock('#utils/authUtils.js', () => ({
  getUserGroups: (...args: unknown[]) => mockGetUserGroups(...args),
}));

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useGetProfileQuery: (...args: unknown[]) => mockUseGetProfileQuery(...args),
}));

vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('#services/deepRacer/deepRacerApi.js', () => ({
  deepRacerApi: { util: { invalidateTags: (tags: unknown) => mockInvalidateTags(tags) } },
}));

vi.mock('../useMqttSubscription.js', () => ({
  ConnectionStatus: { CONNECTED: 'CONNECTED' },
  useMqttSubscription: (id: string, topic: (namespace: string, id: string) => string, options: SubscriptionOptions) =>
    mockUseMqttSubscription(id, topic, options),
}));

describe('useCarLogsMqtt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseGetProfileQuery.mockReturnValue({ data: { profileId: 'profile-001' } });
  });

  it('builds the expected MQTT topics', () => {
    expect(buildCarLogJobTopic('testns')).toBe('deepracer/testns/carlogs/jobs');
    expect(buildCarLogAssetTopic('testns', '+')).toBe('deepracer/testns/carlogs/assets/+');
  });

  it('subscribes managers to wildcard asset updates and the shared jobs topic', async () => {
    mockGetUserGroups.mockResolvedValue([UserGroups.ADMIN]);

    renderHook(() => useCarLogsMqtt());

    await waitFor(() => {
      expect(mockUseMqttSubscription.mock.calls.slice(-2)[0][0]).toBe('+');
    });
    const latestCalls = mockUseMqttSubscription.mock.calls.slice(-2);
    expect(latestCalls[1][0]).toBe('jobs');
    expect(latestCalls[0][1]('testns', '+')).toBe('deepracer/testns/carlogs/assets/+');
    expect(latestCalls[1][1]('testns', 'jobs')).toBe('deepracer/testns/carlogs/jobs');
  });

  it('subscribes racers to their profile-specific asset topic only', async () => {
    mockGetUserGroups.mockResolvedValue([UserGroups.RACERS]);

    renderHook(() => useCarLogsMqtt());

    await waitFor(() => {
      expect(mockUseMqttSubscription.mock.calls.slice(-2)[0][0]).toBe('profile-001');
    });
    const latestCalls = mockUseMqttSubscription.mock.calls.slice(-2);
    expect(latestCalls[1][0]).toBe('');
    expect(latestCalls[0][1]('testns', 'profile-001')).toBe('deepracer/testns/carlogs/assets/profile-001');
  });

  it('invalidates car-log tags when MQTT events arrive', async () => {
    mockGetUserGroups.mockResolvedValue([UserGroups.ADMIN]);

    renderHook(() => useCarLogsMqtt());

    await waitFor(() => {
      expect(mockUseMqttSubscription).toHaveBeenCalled();
    });

    const latestCalls = mockUseMqttSubscription.mock.calls.slice(-2);
    const assetOptions = latestCalls[0][2];
    const jobOptions = latestCalls[1][2];

    assetOptions.onEvent({ assetId: 'asset-001' });
    jobOptions.onEvent({ jobId: 'job-001' });

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockInvalidateTags).toHaveBeenCalledWith([
      { type: 'CarLogAssets', id: 'LIST' },
      { type: 'CarLogAssets', id: 'asset-001' },
    ]);
    expect(mockInvalidateTags).toHaveBeenCalledWith([
      { type: 'CarLogFetches', id: 'LIST' },
      { type: 'CarLogFetches', id: 'job-001' },
    ]);
  });
});
