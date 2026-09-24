// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AttachLiveRacePolicyCommand } from '@deepracer-indy/typescript-client';

import { deepRacerClient } from '#services/deepRacer/deepRacerClient';

const MAX_CONNECT_RETRIES = 5;
const BASE_RETRY_MS = 1000;
const MAX_RETRY_MS = 30_000;

const getRetryDelay = (attempt: number): number => {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const random = array[0] / (0xffffffff + 1);
  return Math.min(BASE_RETRY_MS * Math.pow(2, attempt), MAX_RETRY_MS) + random * 1000;
};

/**
 * Attaches the caller's IoT policy before connecting, retrying with exponential backoff.
 * The backend grants the publish-capable FacilitatorIoTPolicy to admins / race facilitators
 * (see live-race/attachPolicy.ts), which is what authorizes publishing on the race topic tree.
 *
 * Shared by every authenticated {@link useBaseMqttTopic} wrapper (useRaceTopicMqtt,
 * useTimekeeperMqtt) — all attach the same policy before subscribing/publishing.
 */
export const attachPolicyWithRetry = async (signal: AbortSignal): Promise<void> => {
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
