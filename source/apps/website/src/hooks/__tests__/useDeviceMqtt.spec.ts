// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionStatus, useDeviceMqtt } from '../useDeviceMqtt';

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
vi.mock('#services/deepRacer/deepRacerClient.js', () => ({
  deepRacerClient: { send: (...args: unknown[]) => mockSend(...args) },
}));

vi.mock('#utils/envUtils.js', () => ({
  environmentConfig: {
    iotEndpoint: 'abc123-ats.iot.us-west-2.amazonaws.com',
    namespace: 'testns',
    region: 'us-west-2',
  },
}));

const emitEvent = (event: string, ...args: unknown[]) => {
  (eventHandlers[event] ?? []).forEach((handler) => handler(...args));
};

describe('useDeviceMqtt', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    eventHandlers = {};
    mockSubscribe.mockResolvedValue(undefined);
    mockFetchAuthSession.mockResolvedValue({
      credentials: { accessKeyId: 'AKIATEST', secretAccessKey: 'secret', sessionToken: 'token' },
      identityId: 'us-west-2:test-identity-id',
    });
    mockSend.mockResolvedValue({});

    const { iot: iotModule, mqtt5: mqtt5Module } = await import('aws-iot-device-sdk-v2');
    const mockBuilder = { build: vi.fn().mockReturnValue({}), withConnectProperties: vi.fn().mockReturnThis() };
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

  it('subscribes to the device topic on connectionSuccess', async () => {
    renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('connectionSuccess');
    });

    expect(mockSubscribe).toHaveBeenCalledWith({
      subscriptions: [{ topicFilter: 'deepracer/testns/device/mi-0aaaaaaaaaaaaaaaa', qos: 1 }],
    });
  });

  it('calls onEvent with the parsed device event payload', async () => {
    const onEvent = vi.fn();
    const event = {
      eventType: 'DEVICE_COMMAND_RESULT',
      instanceId: 'mi-0aaaaaaaaaaaaaaaa',
      timestamp: '2026-01-01T00:00:00Z',
      commandId: 'cmd-1',
      commandStatus: 'Success',
    };

    renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      emitEvent('messageReceived', { message: { payload: new TextEncoder().encode(JSON.stringify(event)) } });
    });

    expect(onEvent).toHaveBeenCalledWith(event);
  });

  it('does not connect when instanceId is empty', async () => {
    const { result } = renderHook(() => useDeviceMqtt('', { onEvent: vi.fn() }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(mockStart).not.toHaveBeenCalled();
    expect(result.current.connectionStatus).toBe(ConnectionStatus.DISCONNECTED);
  });

  it('stops and closes the client on unmount', async () => {
    const { unmount } = renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn() }));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalled();
    });

    act(() => {
      unmount();
    });

    expect(mockStop).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('sets DISCONNECTED when the client disconnects', async () => {
    const { result } = renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => emitEvent('disconnection'));

    await waitFor(() => expect(result.current.connectionStatus).toBe(ConnectionStatus.DISCONNECTED));
  });

  it('sets ERROR when the client emits an error', async () => {
    const { result } = renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => emitEvent('error', new Error('mqtt failure')));

    await waitFor(() => expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR));
  });

  it('invokes onReconnect on a subsequent connectionSuccess', async () => {
    const onReconnect = vi.fn();
    renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn(), onReconnect }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => emitEvent('connectionSuccess')); // first connect — no reconnect callback
    act(() => emitEvent('connectionSuccess')); // reconnect

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('ignores an unparseable message payload without calling onEvent', async () => {
    const onEvent = vi.fn();
    renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => emitEvent('messageReceived', { message: { payload: new TextEncoder().encode('not json') } }));

    expect(onEvent).not.toHaveBeenCalled();
  });

  it('sets ERROR when the session has no credentials', async () => {
    mockFetchAuthSession.mockResolvedValueOnce({ identityId: 'us-west-2:id' });
    const { result } = renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn() }));

    await waitFor(() => expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR));
  });

  it('sets ERROR when the topic subscription fails after connecting', async () => {
    mockSubscribe.mockRejectedValueOnce(new Error('subscribe denied'));
    const { result } = renderHook(() => useDeviceMqtt('mi-0aaaaaaaaaaaaaaaa', { onEvent: vi.fn() }));
    await waitFor(() => expect(mockStart).toHaveBeenCalled());

    act(() => emitEvent('connectionSuccess'));

    await waitFor(() => expect(result.current.connectionStatus).toBe(ConnectionStatus.ERROR));
  });
});
