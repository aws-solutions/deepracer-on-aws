// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { ConnectionStatus, usePublicRaceTopicMqtt } from '../usePublicRaceTopicMqtt';

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

describe('usePublicRaceTopicMqtt', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    eventHandlers = {};
    mockSubscribe.mockResolvedValue(undefined);
    mockFetchAuthSession.mockResolvedValue({
      credentials: mockCredentials,
      identityId: 'us-east-1:test-identity-id',
    });

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
    const { result } = renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    expect(result.current.connectionStatus).toBe(ConnectionStatus.CONNECTING);
  });

  it('sets DISCONNECTED when eventId or trackId is empty — no IoT connect attempted', async () => {
    const { result } = renderHook(() => usePublicRaceTopicMqtt('', '', { onEvent: vi.fn() }));
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe(ConnectionStatus.DISCONNECTED);
    });
    // Must NOT call fetchAuthSession when IDs are empty
    expect(mockFetchAuthSession).not.toHaveBeenCalled();
  });

  it('does NOT call AttachLiveRacePolicy — connects directly without policy step', async () => {
    // The public hook has no import of deepRacerClient/AttachLiveRacePolicyCommand.
    // We verify it connects (fetchAuthSession → Mqtt5Client.start) without any
    // intermediate step — i.e. start is called in the same tick as fetchAuthSession resolves,
    // with no retry/backoff delay that would indicate a policy call in between.
    const startTime = Date.now();

    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    // fetchAuthSession is called (needed for credentials)
    expect(mockFetchAuthSession).toHaveBeenCalled();
    // Connection completes quickly — no retry delay from a failing policy call
    expect(Date.now() - startTime).toBeLessThan(500);
  });

  it('uses spectator-{identityId}-{uuid} as clientId, with a unique suffix per connection', async () => {
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

    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    expect(mockBuilder.withConnectProperties).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: expect.stringMatching(
          /^spectator-us-east-1:test-identity-id-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
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

    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());
    const firstClientId = mockBuilder.withConnectProperties.mock.calls[0][0].clientId;

    mockBuilder.withConnectProperties.mockClear();
    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockBuilder.withConnectProperties).toHaveBeenCalled());
    const secondClientId = mockBuilder.withConnectProperties.mock.calls[0][0].clientId;

    // Same identity prefix, but different per-connection suffixes — simulating two browser tabs.
    expect(firstClientId).not.toEqual(secondClientId);
    expect(firstClientId.startsWith('spectator-us-east-1:test-identity-id-')).toBe(true);
    expect(secondClientId.startsWith('spectator-us-east-1:test-identity-id-')).toBe(true);
  });

  it('subscribes to correct race topic', async () => {
    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('connectionSuccess');
    });

    expect(mockSubscribe).toHaveBeenCalledWith({
      subscriptions: [{ topicFilter: 'deepracer/testns/race/evt-1/trk-1', qos: 1 }],
    });
  });

  it('transitions to CONNECTED on connectionSuccess', async () => {
    const { result } = renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
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

    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode(JSON.stringify(mockEvent)) } });
    });

    expect(onEvent).toHaveBeenCalledWith(mockEvent);
  });

  it('calls onReconnect on second connectionSuccess', async () => {
    const onReconnect = vi.fn();
    renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn(), onReconnect }));
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
    const { unmount } = renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => {
      unmount();
    });

    expect(mockStop).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('does not call onEvent after unmount', async () => {
    const onEvent = vi.fn();
    const { unmount } = renderHook(() => usePublicRaceTopicMqtt('evt-1', 'trk-1', { onEvent }));
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
