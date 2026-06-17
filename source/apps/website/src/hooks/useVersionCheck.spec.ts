// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook } from '#utils/testUtils.js';

import { useVersionCheck } from './useVersionCheck.js';

const CACHE_KEY = 'github_latest_version';

const mockFetch = (tagName: string, ok = true) => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 500,
      statusText: ok ? 'OK' : 'Internal Server Error',
      json: () => Promise.resolve({ tag_name: tagName }),
    }),
  );
};

beforeEach(() => {
  localStorage.clear();
  window.EnvironmentConfig = {
    apiEndpointUrl: '',
    userPoolId: '',
    userPoolClientId: '',
    identityPoolId: '',
    region: '',
    uploadBucketName: '',
    solutionVersion: 'v1.0.0',
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useVersionCheck', () => {
  it('returns undefined data when disabled', () => {
    const { result } = renderHook(() => useVersionCheck({ enabled: false }));
    expect(result.current.data).toBeUndefined();
  });

  it('fetches latest version and sets isNewestVersion=false when behind', async () => {
    mockFetch('v2.0.0');

    const { result } = renderHook(() => useVersionCheck({ enabled: true }));

    await vi.waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.latestVersion).toBe('v2.0.0');
    expect(result.current.data?.isNewestVersion).toBe(false);
  });

  it('sets isNewestVersion=true when on latest', async () => {
    mockFetch('v1.0.0');

    const { result } = renderHook(() => useVersionCheck({ enabled: true }));

    await vi.waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.isNewestVersion).toBe(true);
  });

  it('uses cached result when cache is fresh', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: { tag_name: 'v2.0.0' }, timeStamp: Date.now() }));

    const { result } = renderHook(() => useVersionCheck({ enabled: true }));

    await vi.waitFor(() => expect(result.current.data).toBeDefined());

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.data?.latestVersion).toBe('v2.0.0');
  });

  it('re-fetches when cache is expired', async () => {
    mockFetch('v2.0.0');

    const expiredTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data: { tag_name: 'v1.5.0' }, timeStamp: expiredTimestamp }));

    const { result } = renderHook(() => useVersionCheck({ enabled: true }));

    await vi.waitFor(() => expect(result.current.data).toBeDefined());

    expect(vi.mocked(fetch)).toHaveBeenCalled();
    expect(result.current.data?.latestVersion).toBe('v2.0.0');
  });

  it('handles fetch failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useVersionCheck({ enabled: true }));

    // Should not throw; data stays undefined
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });
});
