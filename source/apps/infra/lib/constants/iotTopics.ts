// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/** IoT topic root for a deployment: `deepracer/{ns}`. */
export const iotTopicRoot = (namespace: string) => `deepracer/${namespace}`;

/** Virtual leaderboard topic family: `deepracer/{ns}/leaderboard`. */
export const iotTopicPrefix = (namespace: string) => `${iotTopicRoot(namespace)}/leaderboard`;

/** Physical race topic family: `deepracer/{ns}/race` — a sibling of the leaderboard family, not nested under it. */
export const iotRaceTopicPrefix = (namespace: string) => `${iotTopicRoot(namespace)}/race`;

/**
 * Countdown topic wildcard for a deployment, using the IAM-style wildcard IoT policies
 * require: `deepracer/{ns}/leaderboard/*\/countdown`.
 *
 * One topic per track (leaderboardId), nested under the virtual leaderboard family. The
 * browser publishes directly to this topic (bypassing Lambda) for low-latency countdown/pause/
 * resume updates during Timekeeping — see Task 9.2.
 *
 * NOTE: IoT policies do not expand MQTT wildcards (`+`, `#`) in the `Resource` field — they are
 * matched as literal characters. `*` is the IAM-style wildcard IoT policies actually expand, so
 * it is used here in place of the MQTT single-level wildcard `+` that appears in the topic name
 * on the wire (`{TOPIC_PREFIX}/{leaderboardId}/countdown`).
 * @see https://docs.aws.amazon.com/iot/latest/developerguide/audit-chk-iot-misconfigured-policies.html
 */
export const iotCountdownTopicFilter = (namespace: string) => `${iotTopicPrefix(namespace)}/*/countdown`;

/** Device status/command topic family: `deepracer/{ns}/device` — cloud→browser push of device
 * status changes and async command results. A sibling of the leaderboard
 * and race families under the shared root. */
export const iotDeviceTopicPrefix = (namespace: string) => `${iotTopicRoot(namespace)}/device`;

/** Car-log topic family: `deepracer/{ns}/carlogs` — cloud→browser push of fetch-job and asset changes. */
export const iotCarLogTopicPrefix = (namespace: string) => `${iotTopicRoot(namespace)}/carlogs`;
