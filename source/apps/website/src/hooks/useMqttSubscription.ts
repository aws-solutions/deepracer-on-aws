// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachLiveRacePolicyCommand } from '@deepracer-indy/typescript-client';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { CredentialsProvider } from 'aws-crt/dist.browser/browser/auth';
import { mqtt5, iot } from 'aws-iot-device-sdk-v2';
import { useCallback, useEffect, useRef, useState } from 'react';

import { deepRacerClient } from '#services/deepRacer/deepRacerClient.js';
import { environmentConfig } from '#utils/envUtils.js';

export enum ConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export interface UseMqttSubscriptionOptions<TEvent> {
  onEvent: (event: TEvent) => void;
  onReconnect?: () => void;
}

export interface UseMqttSubscriptionReturn {
  connectionStatus: ConnectionStatus;
}

interface UseMqttSubscriptionConfig {
  /** When true, a falsy `id` disables the subscription (used by the single-device hook). */
  disableWhenIdEmpty?: boolean;
}

const MAX_CONNECT_RETRIES = 5;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

const getRetryDelay = (attempt: number): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  //  Normalize to [0, 1) (exclusive of 1). 0xffffffff + 1 is used because we provided 32 bit array; need to divide by Uint32.Max + 1
  const random = array[0] / (0xffffffff + 1);
  return Math.min(BASE_RETRY_MS * Math.pow(2, attempt), MAX_RETRY_MS) + random * 1000;
};

const attachPolicyWithRetry = async (signal: AbortSignal): Promise<void> => {
  for (let attempt = 0; attempt < MAX_CONNECT_RETRIES; attempt++) {
    if (signal.aborted) return;
    try {
      await deepRacerClient.send(new AttachLiveRacePolicyCommand({}), { abortSignal: signal });
      return;
    } catch (error) {
      if (signal.aborted) return;
      if (attempt === MAX_CONNECT_RETRIES - 1) throw error;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, getRetryDelay(attempt));
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            resolve();
          },
          { once: true },
        );
      });
    }
  }
};

const createCredentialsProvider = (credentials: {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}): CredentialsProvider => {
  let cached = credentials;
  return {
    getCredentials: () => ({
      aws_access_id: cached.accessKeyId,
      aws_secret_key: cached.secretAccessKey,
      aws_sts_token: cached.sessionToken,
      aws_region: environmentConfig.region,
    }),
    refreshCredentials: async () => {
      const session = await fetchAuthSession({ forceRefresh: true });
      if (session.credentials) cached = session.credentials;
    },
  };
};

/**
 * Shared IoT Core MQTT subscription hook. Connects with SigV4 credentials from the Cognito
 * Identity Pool (retrying the SpectatorIoTPolicy attach with exponential backoff), subscribes to
 * the topic returned by `buildTopic(namespace, id)`, and invokes `onEvent` for each message.
 * The device- and live-race-specific hooks are thin wrappers that only supply the topic builder
 * and the event type.
 */
export const useMqttSubscription = <TEvent>(
  id: string,
  buildTopic: (namespace: string, id: string) => string,
  options: UseMqttSubscriptionOptions<TEvent>,
  config: UseMqttSubscriptionConfig = {},
): UseMqttSubscriptionReturn => {
  const { disableWhenIdEmpty = false } = config;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const clientRef = useRef<mqtt5.Mqtt5Client | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const buildTopicRef = useRef(buildTopic);
  buildTopicRef.current = buildTopic;

  const connect = useCallback(async (currentId: string, signal: AbortSignal) => {
    const { iotEndpoint, namespace, region } = environmentConfig;
    if (!iotEndpoint || !namespace) {
      if (!signal.aborted) setConnectionStatus(ConnectionStatus.ERROR);
      return;
    }

    try {
      setConnectionStatus(ConnectionStatus.CONNECTING);

      await attachPolicyWithRetry(signal);
      if (signal.aborted) return;

      const session = await fetchAuthSession();
      if (signal.aborted) return;
      if (!session.credentials) throw new Error('No credentials available');
      if (!session.identityId) throw new Error('No identity ID available');

      const credentialsProvider = createCredentialsProvider(session.credentials);

      const builder = iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(iotEndpoint, {
        region,
        credentialsProvider,
      });

      // AWS IoT Core forcibly disconnects an existing connection when a new one uses the same
      // client ID. Append a unique per-connection suffix so concurrent connections for the same
      // identity (multiple tabs, or the device + live-race hooks mounted together) don't evict
      // each other. The IoT policy authorizes `client/*`, so any suffix is permitted.
      builder.withConnectProperties({
        clientId: `${session.identityId}-${crypto.randomUUID()}`,
        keepAliveIntervalSeconds: 300,
      });

      if (signal.aborted) return;

      const client = new mqtt5.Mqtt5Client(builder.build());
      clientRef.current = client;

      const topic = buildTopicRef.current(namespace, currentId);

      let hasConnectedBefore = false;
      client.on('connectionSuccess', () => {
        if (signal.aborted) return;
        if (hasConnectedBefore) {
          optionsRef.current.onReconnect?.();
        }
        hasConnectedBefore = true;
        setConnectionStatus(ConnectionStatus.CONNECTED);
        client
          .subscribe({ subscriptions: [{ topicFilter: topic, qos: mqtt5.QoS.AtLeastOnce }] })
          .catch((error: unknown) => {
            // A failed subscribe means no events will arrive despite a live connection — surface
            // it as ERROR so callers can react rather than silently receiving nothing.
            console.error('Failed to subscribe to MQTT topic', { error });
            if (!signal.aborted) setConnectionStatus(ConnectionStatus.ERROR);
          });
      });

      client.on('disconnection', () => {
        if (signal.aborted) return;
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
      });

      client.on('messageReceived', (eventData) => {
        if (signal.aborted) return;
        try {
          const payload = new TextDecoder().decode(eventData.message.payload as ArrayBuffer);
          const event = JSON.parse(payload) as TEvent;
          optionsRef.current.onEvent(event);
        } catch (error) {
          console.error('Failed to parse MQTT message', { error });
        }
      });

      client.on('error', (error) => {
        console.error('MQTT client error', { error });
        if (!signal.aborted) setConnectionStatus(ConnectionStatus.ERROR);
      });

      client.start();
    } catch (error) {
      if (signal.aborted) return;
      console.error('Failed to establish MQTT connection', { error });
      setConnectionStatus(ConnectionStatus.ERROR);
    }
  }, []);

  useEffect(() => {
    if (disableWhenIdEmpty && !id) {
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      return;
    }

    const abortController = new AbortController();

    connect(id, abortController.signal).catch(() => {
      /** no-op */
    });

    return () => {
      abortController.abort();
      if (clientRef.current) {
        clientRef.current.stop();
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, [id, connect, disableWhenIdEmpty]);

  return { connectionStatus };
};
