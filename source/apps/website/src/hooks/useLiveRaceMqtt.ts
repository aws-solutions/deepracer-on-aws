// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachLiveRacePolicyCommand } from '@deepracer-indy/typescript-client';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { CredentialsProvider } from 'aws-crt/dist.browser/browser/auth';
import { mqtt5, iot } from 'aws-iot-device-sdk-v2';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { LiveRaceEvent } from '#pages/LiveRace/types/events.js';
import { deepRacerClient } from '#services/deepRacer/deepRacerClient.js';
import { environmentConfig } from '#utils/envUtils.js';

export enum ConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

interface UseLiveRaceMqttOptions {
  onEvent: (event: LiveRaceEvent) => void;
  onReconnect?: () => void;
}

interface UseLiveRaceMqttReturn {
  connectionStatus: ConnectionStatus;
}

const MAX_CONNECT_RETRIES = 5;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

const getRetryDelay = (attempt: number): number => {
  //  Create holding unsigned 32 bit array of length 1
  const array = new Uint32Array(1);
  //  Modify array in place
  crypto.getRandomValues(array);
  //  Normalize to [0, 1) (exclusive of 1). 0xffffffff + 1 is used because we provided 32 bit array; need to divide by Uint32.Max + 1
  const random = array[0] / (0xffffffff + 1);
  return Math.min(BASE_RETRY_MS * Math.pow(2, attempt), MAX_RETRY_MS) + random * 1000;
};

const callAttachPolicy = async (signal: AbortSignal): Promise<void> => {
  if (signal.aborted) return;
  await deepRacerClient.send(new AttachLiveRacePolicyCommand({}), { abortSignal: signal });
};

const attachPolicyWithRetry = async (signal: AbortSignal): Promise<void> => {
  for (let attempt = 0; attempt < MAX_CONNECT_RETRIES; attempt++) {
    if (signal.aborted) return;
    try {
      await callAttachPolicy(signal);
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
 * React hook for subscribing to live race events via IoT Core MQTT.
 * Connects using SigV4 credentials from the Cognito Identity Pool,
 * subscribes to the deployment's leaderboard topic, and invokes onEvent
 * for each incoming message.
 */
export const useLiveRaceMqtt = (leaderboardId: string, options: UseLiveRaceMqttOptions): UseLiveRaceMqttReturn => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const clientRef = useRef<mqtt5.Mqtt5Client | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async (lbId: string, signal: AbortSignal) => {
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

      builder.withConnectProperties({ clientId: session.identityId, keepAliveIntervalSeconds: 300 });

      if (signal.aborted) return;

      const client = new mqtt5.Mqtt5Client(builder.build());
      clientRef.current = client;

      const topic = `deepracer/${namespace}/leaderboard/${lbId}`;

      let hasConnectedBefore = false;
      client.on('connectionSuccess', () => {
        if (signal.aborted) return;
        if (hasConnectedBefore) {
          optionsRef.current.onReconnect?.();
        }
        hasConnectedBefore = true;
        setConnectionStatus(ConnectionStatus.CONNECTED);
        void client.subscribe({ subscriptions: [{ topicFilter: topic, qos: mqtt5.QoS.AtLeastOnce }] });
      });

      client.on('disconnection', () => {
        if (signal.aborted) return;
        setConnectionStatus(ConnectionStatus.DISCONNECTED);
      });

      client.on('messageReceived', (eventData) => {
        if (signal.aborted) return;
        try {
          const payload = new TextDecoder().decode(eventData.message.payload as ArrayBuffer);
          const event = JSON.parse(payload) as LiveRaceEvent;
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
    const abortController = new AbortController();

    connect(leaderboardId, abortController.signal).catch(() => {
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
  }, [leaderboardId, connect]);

  return { connectionStatus };
};
