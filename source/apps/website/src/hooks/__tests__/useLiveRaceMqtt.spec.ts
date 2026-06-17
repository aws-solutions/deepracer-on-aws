// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectionStatus, useLiveRaceMqtt } from '../useLiveRaceMqtt';

const mockFetchAuthSession = vi.fn();
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: (...args: unknown[]) => mockFetchAuthSession(...args),
}));

const mockSubscribe = vi.fn().mockResolvedValue(undefined);
const mockStart = vi.fn();
const mockStop = vi.fn();
const mockClose = vi.fn();
let eventHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

const mockClient = {
  on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
    if (!eventHandlers[event]) eventHandlers[event] = [];
    eventHandlers[event].push(handler);
  }),
  start: mockStart,
  stop: mockStop,
  close: mockClose,
  subscribe: mockSubscribe,
};

vi.mock('aws-iot-device-sdk-v2', () => ({
  mqtt5: {
    Mqtt5Client: vi.fn().mockImplementation(function () {
      return mockClient;
    }),
    QoS: { AtLeastOnce: 1 },
  },
  iot: {
    AwsIotMqtt5ClientConfigBuilder: {
      newWebsocketMqttBuilderWithSigv4Auth: vi.fn(),
    },
  },
  auth: {
    AwsCredentialsProvider: class {
      getCredentials() {
        return {};
      }
      async refreshCredentials() {
        /** no-op */
      }
    },
  },
}));

const mockSend = vi.fn().mockResolvedValue({});
vi.mock('#services/deepRacer/deepRacerClient.js', () => ({
  deepRacerClient: { send: (...args: unknown[]) => mockSend(...args) },
}));

vi.mock('#utils/envUtils.js', () => ({
  environmentConfig: {
    apiEndpointUrl: 'https://api.example.com',
    iotEndpoint: 'abc123-ats.iot.us-west-2.amazonaws.com',
    namespace: 'testns',
    region: 'us-west-2',
    userPoolId: 'us-west-2_test',
    userPoolClientId: 'testclient',
    identityPoolId: 'us-west-2:test-pool',
    uploadBucketName: 'test-bucket',
  },
}));

const mockCredentials = {
  accessKeyId: 'AKIATEST',
  secretAccessKey: 'secret',
  sessionToken: 'session-token',
};

const emitEvent = (event: string, ...args: unknown[]) => {
  (eventHandlers[event] ?? []).forEach((handler) => handler(...args));
};

describe('useLiveRaceMqtt', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    eventHandlers = {};
    mockFetchAuthSession.mockResolvedValue({
      tokens: { idToken: { toString: () => 'mock-jwt-token' } },
      credentials: mockCredentials,
      identityId: 'eu-central-1:test-identity-id',
    });
    mockSend.mockResolvedValue({});

    const { iot: iotModule, mqtt5: mqtt5Module } = await import('aws-iot-device-sdk-v2');
    const mockBuilder = {
      build: vi.fn().mockReturnValue({}),
      withConnectProperties: vi.fn().mockReturnThis(),
    };
    vi.mocked(iotModule.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth).mockReturnValue(
      mockBuilder as unknown as ReturnType<
        typeof iotModule.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth
      >,
    );
    vi.mocked(mqtt5Module.Mqtt5Client).mockImplementation(function () {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return mockClient as any;
    });
  });

  it('starts in CONNECTING state', () => {
    const { result } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTING);
  });

  it('calls attach policy endpoint before connecting', async () => {
    renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(mockSend).toHaveBeenCalled();
    });
  });

  it('creates MQTT client and starts connection', async () => {
    const { mqtt5: mqtt5Module } = await import('aws-iot-device-sdk-v2');

    renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(mqtt5Module.Mqtt5Client).toHaveBeenCalled();
    expect(mockStart).toHaveBeenCalled();
  });

  it('transitions to CONNECTED on connectionSuccess', async () => {
    const { result } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('connectionSuccess');
    });

    expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTED);
  });

  it('subscribes to the correct topic on connectionSuccess', async () => {
    renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('connectionSuccess');
    });

    expect(mockSubscribe).toHaveBeenCalledWith({
      subscriptions: [{ topicFilter: 'deepracer/testns/leaderboard/lb-1', qos: 1 }],
    });
  });

  it('calls onEvent with parsed message payload', async () => {
    const onEvent = vi.fn();
    const mockEvent = { eventType: 'LEADERBOARD_UPDATED', leaderboardId: 'lb-1', timestamp: '2026-01-01T00:00:00Z' };

    renderHook(() => useLiveRaceMqtt('lb-1', { onEvent }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode(JSON.stringify(mockEvent)) } });
    });

    expect(onEvent).toHaveBeenCalledWith(mockEvent);
  });

  it('discards malformed messages without crashing', async () => {
    const onEvent = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /** no-op */
    });

    renderHook(() => useLiveRaceMqtt('lb-1', { onEvent }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode('not json') } });
    });

    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse MQTT message', expect.anything());
    expect(onEvent).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('calls onReconnect on re-connection (not first connection)', async () => {
    const onReconnect = vi.fn();

    renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn(), onReconnect }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('connectionSuccess');
    });
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => {
      emitEvent('disconnection');
    });
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => {
      emitEvent('connectionSuccess');
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('stops and closes client on unmount', async () => {
    const { unmount } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      unmount();
    });

    expect(mockStop).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('sets ERROR status when attach policy fails after retries', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockSend.mockRejectedValue(new Error('AttachPolicy failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /** no-op */
    });

    const { result } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await vi.runAllTimersAsync();

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR);
    });
    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('sets ERROR status when iotEndpoint is not configured', async () => {
    const envModule = await import('#utils/envUtils.js');
    const original = { ...envModule.environmentConfig };
    Object.assign(envModule.environmentConfig, { iotEndpoint: undefined });

    const { result } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR);
    });

    Object.assign(envModule.environmentConfig, original);
  });

  it('aborts connection cleanly on unmount during connect', async () => {
    const { unmount } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent: vi.fn() }));

    // Unmount immediately — before the async connect settles
    act(() => {
      unmount();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    // connectionSuccess should not update state after abort
    act(() => {
      emitEvent('connectionSuccess');
    });

    // No subscribe should happen after abort
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it('does not call onEvent after abort', async () => {
    const onEvent = vi.fn();

    const { unmount } = renderHook(() => useLiveRaceMqtt('lb-1', { onEvent }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      unmount();
    });

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode('{"eventType":"TEST"}') } });
    });

    expect(onEvent).not.toHaveBeenCalled();
  });
});
