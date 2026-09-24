// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { fetchAuthSession } from 'aws-amplify/auth';
import type { CredentialsProvider } from 'aws-crt/dist.browser/browser/auth';
import { mqtt5, iot } from 'aws-iot-device-sdk-v2';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PhysicalRaceEvent } from '#pages/PhysicalRace/types/events';
import { environmentConfig } from '#utils/envUtils';

export enum ConnectionStatus {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
}

export interface UseBaseMqttTopicOptions {
  onEvent: (event: PhysicalRaceEvent) => void;
  onReconnect?: () => void;
  /**
   * Called before the MQTT connection is established. Use this to attach an
   * IoT policy (authenticated hook) or skip it (public hook).
   */
  beforeConnect?: (signal: AbortSignal) => Promise<void>;
  /**
   * Returns the MQTT clientId. Authenticated hook uses the raw identityId;
   * public hook prefixes it with `spectator-`.
   */
  getClientId: (identityId: string) => string;
  /** When false, the subscription is torn down (or never established) and status is DISCONNECTED. Default true. */
  enabled?: boolean;
}

export interface UseBaseMqttTopicReturn {
  connectionStatus: ConnectionStatus;
  /**
   * Publishes `event` as JSON to this hook's race topic. Returns false (without throwing) if
   * there is no live client or no topic to publish to, so callers can surface a failure without
   * a try/catch around every publish call.
   *
   * Only admins / race facilitators are authorized to publish (FacilitatorIoTPolicy grants
   * iot:Publish on the race topic tree); a spectator's publish is rejected by IoT Core.
   *
   * Always populated by this hook — typed optional so that pure subscribers
   * (useRaceTopicMqtt, usePublicRaceTopicMqtt, and their consumers/mocks) aren't forced to
   * know about a capability they never use.
   */
  publish?: (event: PhysicalRaceEvent) => Promise<boolean>;
}

export const createCredentialsProvider = (credentials: {
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
 * Base hook for subscribing to physical race events via IoT Core MQTT.
 * Shared by useRaceTopicMqtt (authenticated) and usePublicRaceTopicMqtt (unauthenticated).
 * The only differences between those two hooks are the beforeConnect step and clientId.
 */
export const useBaseMqttTopic = (
  eventId: string,
  trackId: string,
  options: UseBaseMqttTopicOptions,
): UseBaseMqttTopicReturn => {
  const { enabled = true } = options;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.CONNECTING);
  const clientRef = useRef<mqtt5.Mqtt5Client | null>(null);
  const topicRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const connect = useCallback(async (evId: string, trId: string, signal: AbortSignal) => {
    const { iotEndpoint, namespace, region } = environmentConfig;
    if (!iotEndpoint || !namespace) {
      if (!signal.aborted) setConnectionStatus(ConnectionStatus.ERROR);
      return;
    }
    if (!evId || !trId) {
      if (!signal.aborted) setConnectionStatus(ConnectionStatus.DISCONNECTED);
      return;
    }

    try {
      setConnectionStatus(ConnectionStatus.CONNECTING);

      await optionsRef.current.beforeConnect?.(signal);
      if (signal.aborted) return;

      const session = await fetchAuthSession();
      if (signal.aborted) return;
      if (!session.credentials) throw new Error('No credentials available');
      if (!session.identityId) throw new Error('No identity ID available');

      const builder = iot.AwsIotMqtt5ClientConfigBuilder.newWebsocketMqttBuilderWithSigv4Auth(iotEndpoint, {
        region,
        credentialsProvider: createCredentialsProvider(session.credentials),
      });
      builder.withConnectProperties({
        clientId: optionsRef.current.getClientId(session.identityId),
        keepAliveIntervalSeconds: 300,
      });
      if (signal.aborted) return;

      const client = new mqtt5.Mqtt5Client(builder.build());
      clientRef.current = client;
      const topic = `deepracer/${namespace}/race/${evId}/${trId}`;
      topicRef.current = topic;

      let hasConnectedBefore = false;
      client.on('connectionSuccess', () => {
        if (signal.aborted) return;
        if (hasConnectedBefore) optionsRef.current.onReconnect?.();
        hasConnectedBefore = true;
        client
          .subscribe({ subscriptions: [{ topicFilter: topic, qos: mqtt5.QoS.AtLeastOnce }] })
          .then(() => {
            if (!signal.aborted) setConnectionStatus(ConnectionStatus.CONNECTED);
          })
          .catch((_e) => {
            if (!signal.aborted) {
              setConnectionStatus(ConnectionStatus.ERROR);
              // The MQTT client won't auto-reconnect after a subscribe failure since
              // the connection is still open. Stop then restart to re-enter the
              // reconnect cycle; this will fire connectionSuccess again and retry.
              client.stop();
              client.start();
            }
          });
      });
      client.on('disconnection', () => {
        if (!signal.aborted) setConnectionStatus(ConnectionStatus.DISCONNECTED);
      });
      client.on('messageReceived', (eventData) => {
        if (signal.aborted) return;
        let parsed: PhysicalRaceEvent;
        try {
          const payload = new TextDecoder().decode(eventData.message.payload as ArrayBuffer);
          parsed = JSON.parse(payload) as PhysicalRaceEvent;
        } catch (e) {
          console.error('Failed to parse MQTT message payload', e);
          return;
        }
        optionsRef.current.onEvent(parsed);
      });
      client.on('error', () => {
        if (!signal.aborted) setConnectionStatus(ConnectionStatus.ERROR);
      });
      client.start();
    } catch (error) {
      if (!signal.aborted) {
        console.error('Failed to establish MQTT connection', { error });
        setConnectionStatus(ConnectionStatus.ERROR);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus(ConnectionStatus.DISCONNECTED);
      return;
    }

    const abortController = new AbortController();
    connect(eventId, trackId, abortController.signal).catch((_e) => {
      /* no-op */
    });
    return () => {
      abortController.abort();
      if (clientRef.current) {
        clientRef.current.stop();
        clientRef.current.close();
        clientRef.current = null;
      }
      topicRef.current = null;
    };
  }, [eventId, trackId, connect, enabled]);

  const publish = useCallback(async (event: PhysicalRaceEvent): Promise<boolean> => {
    const client = clientRef.current;
    const topic = topicRef.current;
    if (!client || !topic) return false;

    try {
      await client.publish({
        topicName: topic,
        qos: mqtt5.QoS.AtLeastOnce,
        payload: JSON.stringify(event),
      });
      return true;
    } catch (error) {
      console.error('Failed to publish MQTT message', { error, topicName: topic });
      return false;
    }
  }, []);

  return { connectionStatus, publish };
};
