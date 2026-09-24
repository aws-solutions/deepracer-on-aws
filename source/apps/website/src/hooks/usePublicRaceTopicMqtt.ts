// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useBaseMqttTopic, type UseBaseMqttTopicOptions, type UseBaseMqttTopicReturn } from './useBaseMqttTopic';

export { ConnectionStatus } from './useBaseMqttTopic';

type UsePublicRaceTopicMqttOptions = Pick<UseBaseMqttTopicOptions, 'onEvent' | 'onReconnect'>;

/**
 * React hook for unauthenticated spectators to subscribe to physical race events.
 *
 * Key differences from useRaceTopicMqtt (authenticated):
 * - No AttachLiveRacePolicyCommand call (unauth identities cannot call the API)
 * - clientId MUST start with `spectator-${identityId}-` — the unauth IAM role scopes
 *   iot:Connect to `client/spectator-${cognito-identity.amazonaws.com:sub}-*`; anything else
 *   is denied. The trailing per-connection suffix (mirroring useMqttSubscription) lets
 *   multiple tabs for the same identity connect without evicting each other.
 * - Uses unauthenticated Cognito Identity Pool credentials (no sign-in required)
 */
export const usePublicRaceTopicMqtt = (
  eventId: string,
  trackId: string,
  options: UsePublicRaceTopicMqttOptions,
): UseBaseMqttTopicReturn =>
  useBaseMqttTopic(eventId, trackId, {
    ...options,
    getClientId: (identityId) => `spectator-${identityId}-${crypto.randomUUID()}`,
  });
