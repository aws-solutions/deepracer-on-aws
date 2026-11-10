// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Hardware-independent logic for the DeepRacer RPi timer. Kept free of GPIO / AWS SDK imports so
 * it can be unit tested off-device; timer.mjs wires it to the sensors and IoT Core.
 */

export const DEFAULT_DEBOUNCE_MS = 2000;
export const CREDENTIALS_REFRESH_MS = 60_000;
export const HEARTBEAT_INTERVAL_MS = 30_000;
export const TIMER_LAP_EVENT = 'TIMER_LAP';
export const TIMER_HEARTBEAT_EVENT = 'TIMER_HEARTBEAT';

/** @param {string} value */
const stripTrailingSlashes = (value) => {
  let end = value.length;
  while (end > 0 && value[end - 1] === '/') end -= 1;
  return value.slice(0, end);
};

/**
 * Validates the JSON config written by timer_activation.sh and applies defaults.
 * @param {unknown} raw
 */
export const parseConfig = (raw) => {
  if (!raw || typeof raw !== 'object') throw new Error('Timer config must be a JSON object');
  const config = /** @type {Record<string, any>} */ (raw);
  for (const key of ['region', 'iotEndpoint', 'topicPrefix']) {
    if (typeof config[key] !== 'string' || config[key].length === 0) {
      throw new Error(`Timer config is missing "${key}"`);
    }
  }
  const gpio = config.gpio ?? {};
  return {
    region: config.region,
    iotEndpoint: config.iotEndpoint,
    topicPrefix: stripTrailingSlashes(config.topicPrefix),
    credentialsFile: config.credentialsFile ?? '/root/.aws/credentials',
    registrationFile: config.registrationFile ?? '/var/lib/amazon/ssm/registration',
    gpio: {
      sensor1: Number(gpio.sensor1 ?? 17),
      sensor2: Number(gpio.sensor2 ?? 27),
      debounceMs: Number(gpio.debounceMs ?? DEFAULT_DEBOUNCE_MS),
      activeLow: Boolean(gpio.activeLow ?? false),
      ...(gpio.chip !== undefined && { chip: String(gpio.chip) }),
    },
  };
};

/**
 * Reads the managed instance ID from the SSM agent's registration file
 * (`{"ManagedInstanceID":"mi-...","Region":"..."}`).
 * @param {string} registrationJson
 */
export const parseInstanceId = (registrationJson) => {
  const { ManagedInstanceID: instanceId } = JSON.parse(registrationJson);
  if (typeof instanceId !== 'string' || !/^mi-[0-9a-f]{17}$/.test(instanceId)) {
    throw new Error('SSM registration file has no valid ManagedInstanceID; is the agent registered?');
  }
  return instanceId;
};

/**
 * Extracts one profile from an AWS shared credentials (INI) file. The SSM agent writes the
 * hybrid activation role's rotating credentials to the `default` profile.
 * @param {string} iniText
 * @param {string} [profile]
 */
export const parseSharedCredentials = (iniText, profile = 'default') => {
  let section;
  const values = /** @type {Record<string, string>} */ ({});
  for (const rawLine of iniText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header) {
      section = header[1].trim();
      continue;
    }
    if (section !== profile) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
  }
  if (!values.aws_access_key_id || !values.aws_secret_access_key) return undefined;
  return {
    accessKeyId: values.aws_access_key_id,
    secretAccessKey: values.aws_secret_access_key,
    ...(values.aws_session_token && { sessionToken: values.aws_session_token }),
  };
};

/**
 * Turns raw sensor levels into lap crossings. Fires on the active edge only, and suppresses any
 * crossing within debounceMs of the previous one from *either* sensor, so one car pass that
 * trips both sensors (or bounces) records a single crossing.
 * @param {{ debounceMs: number; activeLow: boolean }} options
 */
export const createCrossingDetector = ({ debounceMs, activeLow }) => {
  const activeLevel = activeLow ? 0 : 1;
  const lastLevels = new Map();
  let lastCrossingAt = Number.NEGATIVE_INFINITY;

  /**
   * @param {number} pin
   * @param {number} level
   * @param {number} nowMs
   * @returns {boolean} true when this sample is an accepted crossing
   */
  return (pin, level, nowMs) => {
    const previous = lastLevels.get(pin);
    lastLevels.set(pin, level);
    // The first sample only establishes the resting level.
    if (previous === undefined || previous === level || level !== activeLevel) return false;
    if (nowMs - lastCrossingAt < debounceMs) return false;
    lastCrossingAt = nowMs;
    return true;
  };
};

/** @param {string} topicPrefix @param {string} instanceId */
export const timerTopic = (topicPrefix, instanceId) => `${topicPrefix}/${instanceId}`;

/**
 * `bootId` identifies this timer process. `sequence` and `timestamp` only compare within one
 * process: both start over when the service restarts, so the page resets its tracking when the
 * bootId changes.
 * @param {{ instanceId: string; bootId: string; timestamp: number; gpio: number; sequence: number }} lap
 */
export const buildLapMessage = ({ instanceId, bootId, timestamp, gpio, sequence }) => ({
  eventType: TIMER_LAP_EVENT,
  instanceId,
  bootId,
  timestamp,
  gpio,
  sequence,
});

/** @param {{ instanceId: string; bootId: string; timestamp: number }} heartbeat */
export const buildHeartbeatMessage = ({ instanceId, bootId, timestamp }) => ({
  eventType: TIMER_HEARTBEAT_EVENT,
  instanceId,
  bootId,
  timestamp,
});

/**
 * Stamps a message with when it is actually sent, on the same clock as its `timestamp`. A crossing
 * delayed by publish retries then shows its age, so the page doesn't use a stale crossing to
 * start or resume a run.
 * @template {object} T
 * @param {T} message
 * @param {number} publishedAt
 */
export const withPublishTime = (message, publishedAt) => ({ ...message, publishedAt });

/**
 * AWS SDK credential provider over the SSM agent's shared credentials file. Reports a short
 * expiration so the SDK re-reads the file on every publish and picks up the agent's rotated
 * credentials (see CREDENTIALS_REFRESH_MS).
 * @param {{ credentialsFile: string; readFile: (path: string) => string; now?: () => number }} options
 */
export const createSharedCredentialsProvider =
  ({ credentialsFile, readFile, now = Date.now }) =>
  async () => {
    const credentials = parseSharedCredentials(readFile(credentialsFile));
    if (!credentials) throw new Error(`No default profile in ${credentialsFile}`);
    return { ...credentials, expiration: new Date(now() + CREDENTIALS_REFRESH_MS) };
  };

/** Backoff between attempts to publish a crossing (~31 s in total, on top of the SDK's own retries). */
export const PUBLISH_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

/** @param {number} ms */
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Serializes publishes so crossings reach IoT Core in the order they happened. A message published
 * with `retry` is re-sent with backoff before it is given up on, so a transient outage delays a
 * crossing instead of losing it (lap times come from the timestamps, so the delay is harmless).
 * A message that still fails is logged and does not block the ones after it; the browser detects
 * the lost crossing from the gap in sequence numbers. The returned promises never reject.
 * @param {(message: { eventType: string }) => Promise<unknown>} send
 * @param {{ logError?: (...args: unknown[]) => void; retryDelaysMs?: number[]; sleep?: (ms: number) => Promise<unknown> }} [options]
 */
export const createOrderedPublisher = (
  send,
  { logError = console.error, retryDelaysMs = PUBLISH_RETRY_DELAYS_MS, sleep = defaultSleep } = {},
) => {
  let chain = Promise.resolve();
  /** @param {{ eventType: string }} message @param {number[]} delays */
  const sendWithRetry = async (message, delays) => {
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        await send(message);
        return;
      } catch (error) {
        const reason = /** @type {{ message?: string } | undefined} */ (error)?.message ?? error;
        if (attempt === delays.length) {
          logError(`Failed to publish ${message.eventType}:`, reason);
        } else {
          logError(`Publish ${message.eventType} failed, retrying in ${delays[attempt]}ms:`, reason);
          await sleep(delays[attempt]);
        }
      }
    }
  };
  /**
   * @param {{ eventType: string }} message
   * @param {{ retry?: boolean }} [options] retry is for crossings; heartbeats are superseded by the next one
   */
  const publish = (message, { retry = false } = {}) => {
    chain = chain.then(() => sendWithRetry(message, retry ? retryDelaysMs : []));
    return chain;
  };
  /** Resolves once every queued publish has settled. */
  const drain = () => chain;
  return { publish, drain };
};

/**
 * Labels of the GPIO controller that drives the 40-pin header, most specific first: RP1 on the
 * Pi 5 / CM5, BCM2711 on the Pi 4 / CM4, BCM2835 on earlier models. The Pi 5 also exposes SoC
 * (pinctrl-bcm2712) chips whose line numbers do not match the header's GPIO numbers.
 */
export const HEADER_GPIO_CHIP_LABELS = ['pinctrl-rp1', 'pinctrl-bcm2711', 'pinctrl-bcm2835'];

/**
 * Picks the gpiochip for the 40-pin header. Chip numbering differs between kernels and
 * distributions (gpiochip4 on early Pi 5 Raspberry Pi OS kernels, gpiochip0 on later ones), so
 * the chip is found by its label rather than assumed from the board model.
 * @param {{ name: string; label: string }[]} chips
 * @param {string} [override] chip name from the config, e.g. "gpiochip0"
 */
export const selectHeaderGpioChip = (chips, override) => {
  const describe = () => chips.map(({ name, label }) => `${name} (${label})`).join(', ') || 'none';
  if (override !== undefined) {
    const chip = chips.find(({ name }) => name === override || name === `gpiochip${override}`);
    if (!chip) throw new Error(`Configured gpio.chip "${override}" not found. Available chips: ${describe()}`);
    return chip;
  }
  for (const label of HEADER_GPIO_CHIP_LABELS) {
    const chip = chips.find((candidate) => candidate.label === label);
    if (chip) return chip;
  }
  throw new Error(
    `No 40-pin header GPIO chip found. Set gpio.chip in the timer config. Available chips: ${describe()}`,
  );
};

/** @param {string} chipName e.g. "gpiochip4" */
export const gpioChipNumber = (chipName) => {
  const match = /^gpiochip(\d+)$/.exec(chipName);
  if (!match) throw new Error(`Unexpected GPIO chip name "${chipName}"`);
  return Number(match[1]);
};
