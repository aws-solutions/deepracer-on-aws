// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  useMqttSubscription,
  type UseMqttSubscriptionOptions,
  type UseMqttSubscriptionReturn,
} from './useMqttSubscription.js';

export { ConnectionStatus } from './useMqttSubscription.js';

/**
 * Browser-facing device events, published by the BroadcastHandler on `device#` stream changes
 * (backend `deviceBroadcast.ts`). `DEVICE_STATUS_CHANGED` reflects an ONLINE/OFFLINE/PENDING
 * transition from the status poller / state-change handler; `DEVICE_COMMAND_RESULT` carries the
 * async outcome of a restart/stop/color command tracked via EventBridge (SSM command
 * completion → deviceStateChangeHandler → DDB → stream → here).
 */
export type DeviceMqttEvent =
  | { eventType: 'DEVICE_STATUS_CHANGED'; instanceId: string; timestamp: string; status: string }
  | {
      eventType: 'DEVICE_COMMAND_RESULT';
      instanceId: string;
      timestamp: string;
      commandId: string;
      commandStatus: string;
    };

type UseDeviceMqttOptions = UseMqttSubscriptionOptions<DeviceMqttEvent>;
type UseDeviceMqttReturn = UseMqttSubscriptionReturn;

const buildDeviceTopic = (namespace: string, instanceId: string): string =>
  `deepracer/${namespace}/device/${instanceId}`;

/**
 * React hook for subscribing to a single device's status/command events via IoT Core MQTT
 * (topic `deepracer/{ns}/device/{instanceId}`; `+` subscribes to every device). A falsy
 * instanceId disables the subscription. Thin wrapper over {@link useMqttSubscription}.
 */
export const useDeviceMqtt = (instanceId: string, options: UseDeviceMqttOptions): UseDeviceMqttReturn =>
  useMqttSubscription<DeviceMqttEvent>(instanceId, buildDeviceTopic, options, { disableWhenIdEmpty: true });
