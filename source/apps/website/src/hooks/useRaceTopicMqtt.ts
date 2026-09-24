// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { attachPolicyWithRetry } from './attachPolicyWithRetry.js';
import { useBaseMqttTopic, type UseBaseMqttTopicOptions, type UseBaseMqttTopicReturn } from './useBaseMqttTopic';

export { ConnectionStatus } from './useBaseMqttTopic';

type UseRaceTopicMqttOptions = Pick<UseBaseMqttTopicOptions, 'onEvent' | 'onReconnect'>;

/**
 * React hook for subscribing to physical race events via IoT Core MQTT.
 * For authenticated users (admin, facilitator, commentator).
 * Calls AttachLiveRacePolicy before connecting.
 */
export const useRaceTopicMqtt = (
  eventId: string,
  trackId: string,
  options: UseRaceTopicMqttOptions,
): UseBaseMqttTopicReturn =>
  useBaseMqttTopic(eventId, trackId, {
    ...options,
    beforeConnect: attachPolicyWithRetry,
    // AWS IoT Core forcibly disconnects an existing connection when a new one uses the same
    // client ID. Append a unique per-connection suffix so concurrent connections for the same
    // identity (multiple tabs) don't evict each other. The IoT policy authorizes `client/*`.
    getClientId: (identityId) => `${identityId}-${crypto.randomUUID()}`,
  });
