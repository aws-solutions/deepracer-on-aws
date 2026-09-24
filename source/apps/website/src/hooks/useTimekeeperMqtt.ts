// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react';

import type { LapCapturedEvent, OverlayUpdateEvent } from '#pages/PhysicalRace/types/events';

import { attachPolicyWithRetry } from './attachPolicyWithRetry.js';
import { ConnectionStatus, useBaseMqttTopic, type UseBaseMqttTopicOptions } from './useBaseMqttTopic';

export { ConnectionStatus };

/**
 * The Timekeeper is a publisher, not a consumer — it drives the race and broadcasts state
 * outward to spectator surfaces. `onEvent` is therefore optional; when omitted, inbound
 * messages on the topic are ignored.
 */
type UseTimekeeperMqttOptions = Pick<UseBaseMqttTopicOptions, 'onReconnect' | 'enabled'> &
  Partial<Pick<UseBaseMqttTopicOptions, 'onEvent'>>;

type EventIdentifierKeys = 'eventType' | 'eventId' | 'trackId';

interface UseTimekeeperMqttReturn {
  connectionStatus: ConnectionStatus;
  /** Broadcasts the live timing state (countdown, current laps, race status) to overlay/leaderboard views. */
  publishOverlayUpdate: (payload: Omit<OverlayUpdateEvent, EventIdentifierKeys>) => Promise<boolean>;
  /** Broadcasts a single captured lap as it is recorded. */
  publishLapCaptured: (payload: Omit<LapCapturedEvent, EventIdentifierKeys>) => Promise<boolean>;
}

/**
 * React hook for the Timekeeping page to broadcast physical race state via IoT Core MQTT.
 *
 * Publishes to the same race topic tree (`deepracer/{ns}/race/{eventId}/{trackId}`) that the
 * backend BroadcastHandler uses and that PublicLeaderboard / StreamingOverlay / CommentatorView
 * subscribe to — so a facilitator-driven update reaches spectators identically to a
 * server-driven one. This is the "client-side Path B" the FacilitatorIoTPolicy was created for.
 *
 * Thin wrapper over {@link useBaseMqttTopic}, sibling of useRaceTopicMqtt (authenticated,
 * subscribe-oriented) and usePublicRaceTopicMqtt (unauthenticated spectators) — the only
 * addition here is typed publish helpers for the two event shapes Timekeeping broadcasts.
 */
export const useTimekeeperMqtt = (
  eventId: string,
  trackId: string,
  options: UseTimekeeperMqttOptions = {},
): UseTimekeeperMqttReturn => {
  const { onEvent, onReconnect, enabled } = options;

  const { connectionStatus, publish } = useBaseMqttTopic(eventId, trackId, {
    onEvent: onEvent ?? (() => undefined),
    onReconnect,
    enabled,
    beforeConnect: attachPolicyWithRetry,
    // AWS IoT Core forcibly disconnects an existing connection when a new one uses the same
    // client ID. Append a unique per-connection suffix so concurrent connections for the same
    // identity (multiple tabs) don't evict each other. The IoT policy authorizes `client/*`.
    getClientId: (identityId) => `${identityId}-${crypto.randomUUID()}`,
  });

  const publishOverlayUpdate = useCallback(
    (payload: Omit<OverlayUpdateEvent, EventIdentifierKeys>): Promise<boolean> =>
      publish?.({ eventType: 'OVERLAY_UPDATE', eventId, trackId, ...payload }) ?? Promise.resolve(false),
    [publish, eventId, trackId],
  );

  const publishLapCaptured = useCallback(
    (payload: Omit<LapCapturedEvent, EventIdentifierKeys>): Promise<boolean> =>
      publish?.({ eventType: 'LAP_CAPTURED', eventId, trackId, ...payload }) ?? Promise.resolve(false),
    [publish, eventId, trackId],
  );

  return { connectionStatus, publishOverlayUpdate, publishLapCaptured };
};
