// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { LiveRaceEvent } from '#pages/LiveRace/types/events.js';

import {
  useMqttSubscription,
  type UseMqttSubscriptionOptions,
  type UseMqttSubscriptionReturn,
} from './useMqttSubscription.js';

export { ConnectionStatus } from './useMqttSubscription.js';

type UseLiveRaceMqttOptions = UseMqttSubscriptionOptions<LiveRaceEvent>;
type UseLiveRaceMqttReturn = UseMqttSubscriptionReturn;

const buildLeaderboardTopic = (namespace: string, leaderboardId: string): string =>
  `deepracer/${namespace}/leaderboard/${leaderboardId}`;

/**
 * React hook for subscribing to live race events via IoT Core MQTT.
 * Connects using SigV4 credentials from the Cognito Identity Pool,
 * subscribes to the deployment's leaderboard topic, and invokes onEvent
 * for each incoming message. Thin wrapper over {@link useMqttSubscription}.
 */
export const useLiveRaceMqtt = (leaderboardId: string, options: UseLiveRaceMqttOptions): UseLiveRaceMqttReturn =>
  useMqttSubscription<LiveRaceEvent>(leaderboardId, buildLeaderboardTopic, options);
