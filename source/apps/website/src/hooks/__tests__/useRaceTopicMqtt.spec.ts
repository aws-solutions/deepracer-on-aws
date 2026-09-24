// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectionStatus, useRaceTopicMqtt } from '../useRaceTopicMqtt';

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
}));

const mockSend = vi.fn().mockResolvedValue({});
vi.mock('#services/deepRacer/deepRacerClient', () => ({
  deepRacerClient: { send: (...args: unknown[]) => mockSend(...args) },
}));

vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    iotEndpoint: 'abc123-ats.iot.us-east-1.amazonaws.com',
    namespace: 'testns',
    region: 'us-east-1',
    apiEndpointUrl: 'https://api.example.com',
    userPoolId: 'us-east-1_test',
    userPoolClientId: 'testclient',
    identityPoolId: 'us-east-1:test-pool',
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

describe('useRaceTopicMqtt', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    eventHandlers = {};
    mockSubscribe.mockResolvedValue(undefined);
    mockFetchAuthSession.mockResolvedValue({
      credentials: mockCredentials,
      identityId: 'us-east-1:test-identity-id',
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
    const { result } = renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTING);
  });

  it('sets DISCONNECTED when eventId or trackId is empty', async () => {
    const { result } = renderHook(() => useRaceTopicMqtt('', '', { onEvent: vi.fn() }));
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe(ConnectionStatus.DISCONNECTED);
    });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('calls AttachLiveRacePolicy before connecting', async () => {
    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => {
      expect(mockSend).toHaveBeenCalled();
    });
  });

  it('creates MQTT client with identityId-{uuid} clientId (not spectator- prefix)', async () => {
    const { iot: iotModule } = await import('aws-iot-device-sdk-v2');
    const mockBuilder = {
      build: vi.fn().mockReturnValue({}),
      withConnectProperties: vi.fn().mockReturnThis(),
    };
    vi.mocked(iotModule.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth).mockReturnValue(
      mockBuilder as unknown as ReturnType<
        typeof iotModule.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth
      >,
    );

    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));

    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    expect(mockBuilder.withConnectProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: expect.stringMatching(
          /^us-east-1:test-identity-id-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ),
      }),
    );
  });

  it('generates a different clientId suffix across separate hook instances', async () => {
    const { iot: iotModule } = await import('aws-iot-device-sdk-v2');
    const mockBuilder = {
      build: vi.fn().mockReturnValue({}),
      withConnectProperties: vi.fn().mockReturnThis(),
    };
    vi.mocked(iotModule.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth).mockReturnValue(
      mockBuilder as unknown as ReturnType<
        typeof iotModule.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth
      >,
    );

    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    const firstClientId = mockBuilder.withConnectProperties.mock.calls[0][0].clientId;

    mockBuilder.withConnectProperties.mockClear();
    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockBuilder.withConnectProperties).toHaveBeenCalled());
    const secondClientId = mockBuilder.withConnectProperties.mock.calls[0][0].clientId;

    // Same identity prefix, but different per-connection suffixes — simulating two browser tabs.
    expect(firstClientId).not.toEqual(secondClientId);
    expect(firstClientId.startsWith('us-east-1:test-identity-id-')).toBe(true);
    expect(secondClientId.startsWith('us-east-1:test-identity-id-')).toBe(true);
  });

  it('subscribes to correct race topic on connectionSuccess', async () => {
    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('connectionSuccess');
    });

    expect(mockSubscribe).toHaveBeenCalledWith({
      subscriptions: [{ topicFilter: 'deepracer/testns/race/evt-1/trk-1', qos: 1 }],
    });
  });

  it('transitions to CONNECTED on connectionSuccess', async () => {
    const { result } = renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('connectionSuccess');
    });

    // CONNECTED is set after subscribe() resolves, not immediately on connectionSuccess.
    await waitFor(() => expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTED));
  });

  it('calls onEvent with parsed message', async () => {
    const onEvent = vi.fn();
    const mockEvent = { eventType: 'LEADERBOARD_UPDATED', eventId: 'evt-1', trackId: 'trk-1' };

    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode(JSON.stringify(mockEvent)) } });
    });

    expect(onEvent).toHaveBeenCalledWith(mockEvent);
  });

  it('discards malformed messages without crashing', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      /* no-op */
    });
    const onEvent = vi.fn();

    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode('not json') } });
    });

    expect(onEvent).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('sets ERROR on subscribe failure', async () => {
    mockSubscribe.mockRejectedValue(new Error('Subscribe denied'));
    const { result } = renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('connectionSuccess');
    });

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR);
    });
  });

  it('calls onReconnect on second connectionSuccess', async () => {
    const onReconnect = vi.fn();
    renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn(), onReconnect }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('connectionSuccess');
    });
    expect(onReconnect).not.toHaveBeenCalled();

    act(() => {
      emitEvent('connectionSuccess');
    });
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('stops and closes client on unmount', async () => {
    const { unmount } = renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      unmount();
    });

    expect(mockStop).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('sets ERROR when iotEndpoint is not configured', async () => {
    const envModule = await import('#utils/envUtils');
    const original = { ...envModule.environmentConfig };
    Object.assign(envModule.environmentConfig, { iotEndpoint: undefined });

    const { result } = renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR);
    });

    Object.assign(envModule.environmentConfig, original);
  });

  it('does not call onEvent after unmount', async () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => useRaceTopicMqtt('evt-1', 'trk-1', { onEvent }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      unmount();
    });
    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode('{"eventType":"TEST"}') } });
    });

    expect(onEvent).not.toHaveBeenCalled();
  });
});
