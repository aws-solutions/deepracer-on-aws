// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Type declarations for timerCore.mjs, so the website's unit tests can type-check against it.

export declare const DEFAULT_DEBOUNCE_MS: number;
export declare const CREDENTIALS_REFRESH_MS: number;
export declare const HEARTBEAT_INTERVAL_MS: number;
export declare const TIMER_LAP_EVENT: 'TIMER_LAP';
export declare const TIMER_HEARTBEAT_EVENT: 'TIMER_HEARTBEAT';

export interface TimerConfig {
  region: string;
  iotEndpoint: string;
  topicPrefix: string;
  credentialsFile: string;
  registrationFile: string;
  gpio: { sensor1: number; sensor2: number; debounceMs: number; activeLow: boolean; chip?: string };
}

export declare const parseConfig: (raw: unknown) => TimerConfig;
export declare const parseInstanceId: (registrationJson: string) => string;
export declare const parseSharedCredentials: (
  iniText: string,
  profile?: string,
) => { accessKeyId: string; secretAccessKey: string; sessionToken?: string } | undefined;
export declare const createCrossingDetector: (options: {
  debounceMs: number;
  activeLow: boolean;
}) => (pin: number, level: number, nowMs: number) => boolean;
export declare const timerTopic: (topicPrefix: string, instanceId: string) => string;
export declare const buildLapMessage: (lap: {
  instanceId: string;
  bootId: string;
  timestamp: number;
  gpio: number;
  sequence: number;
}) => {
  eventType: 'TIMER_LAP';
  instanceId: string;
  bootId: string;
  timestamp: number;
  gpio: number;
  sequence: number;
};
export declare const buildHeartbeatMessage: (heartbeat: { instanceId: string; bootId: string; timestamp: number }) => {
  eventType: 'TIMER_HEARTBEAT';
  instanceId: string;
  bootId: string;
  timestamp: number;
};
export declare const withPublishTime: <T extends object>(
  message: T,
  publishedAt: number,
) => T & { publishedAt: number };
export declare const createSharedCredentialsProvider: (options: {
  credentialsFile: string;
  readFile: (path: string) => string;
  now?: () => number;
}) => () => Promise<{ accessKeyId: string; secretAccessKey: string; sessionToken?: string; expiration: Date }>;
export declare const PUBLISH_RETRY_DELAYS_MS: number[];
export declare const createOrderedPublisher: <TMessage extends { eventType: string }>(
  send: (message: TMessage) => Promise<unknown>,
  options?: {
    logError?: (...args: unknown[]) => void;
    retryDelaysMs?: number[];
    sleep?: (ms: number) => Promise<unknown>;
  },
) => {
  publish: (message: TMessage, options?: { retry?: boolean }) => Promise<void>;
  drain: () => Promise<void>;
};
export declare const HEADER_GPIO_CHIP_LABELS: string[];
export declare const selectHeaderGpioChip: (
  chips: { name: string; label: string }[],
  override?: string,
) => { name: string; label: string };
export declare const gpioChipNumber: (chipName: string) => number;
