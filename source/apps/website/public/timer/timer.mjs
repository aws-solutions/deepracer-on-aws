// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * DeepRacer RPi timer. Watches the start/finish line sensors on GPIO and publishes each
 * crossing to IoT Core (`{topicPrefix}/{instanceId}`), where the Timekeeping page subscribes.
 *
 * Outbound HTTPS only: the timer opens no listening socket. It authenticates with the timer
 * hybrid activation role credentials that the SSM agent rotates into the shared credentials
 * file, and that role can only iot:Publish to the timer topic tree.
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

import { IoTDataPlaneClient, PublishCommand } from '@aws-sdk/client-iot-data-plane';

import {
  buildHeartbeatMessage,
  buildLapMessage,
  createCrossingDetector,
  createOrderedPublisher,
  createSharedCredentialsProvider,
  withPublishTime,
  gpioChipNumber,
  HEARTBEAT_INTERVAL_MS,
  parseConfig,
  parseInstanceId,
  selectHeaderGpioChip,
  timerTopic,
} from './timerCore.mjs';

const CONFIG_FILE = process.env.DEEPRACER_TIMER_CONFIG ?? '/etc/deepracer-timer/config.json';
const GPIO_POLL_INTERVAL_MS = 5;

const config = parseConfig(JSON.parse(readFileSync(CONFIG_FILE, 'utf8')));
const instanceId = parseInstanceId(readFileSync(config.registrationFile, 'utf8'));
const topic = timerTopic(config.topicPrefix, instanceId);
console.log(`Timer ${instanceId} publishing to ${topic}`, JSON.stringify(config.gpio));

const iotClient = new IoTDataPlaneClient({
  region: config.region,
  endpoint: `https://${config.iotEndpoint}`,
  credentials: createSharedCredentialsProvider({
    credentialsFile: config.credentialsFile,
    readFile: (path) => readFileSync(path, 'utf8'),
  }),
  // Without timeouts one request hung by a Wi-Fi drop would hold every later message in the
  // ordered publisher. throwOnRequestTimeout makes requestTimeout an error (it only warns
  // otherwise), so the request fails and the publisher retries it.
  requestHandler: { connectionTimeout: 5_000, requestTimeout: 10_000, throwOnRequestTimeout: true },
});
const bootId = randomUUID();

// Monotonic, epoch-based milliseconds: unaffected by NTP steps between two crossings, so the
// browser can derive lap times from the difference of consecutive timestamps.
const now = () => Math.round(performance.timeOrigin + performance.now());

const { publish, drain } = createOrderedPublisher((message) =>
  iotClient.send(
    new PublishCommand({
      topic,
      qos: 1,
      payload: new TextEncoder().encode(JSON.stringify(withPublishTime(message, now()))),
    }),
  ),
);

let sequence = 0;
const detectCrossing = createCrossingDetector(config.gpio);
const onLevel = (pin, level) => {
  const timestamp = now();
  if (!detectCrossing(pin, level, timestamp)) return;
  sequence += 1;
  console.log(`${sequence}: crossing on GPIO${pin} at ${timestamp} (${new Date(timestamp).toISOString()})`);
  publish(buildLapMessage({ instanceId, bootId, timestamp, gpio: pin, sequence }), { retry: true });
};

const pins = [config.gpio.sensor1, config.gpio.sensor2];
let releaseGpio = () => undefined;
// node-libgpiod's native Line holds only a raw pointer into its Chip, and a garbage-collected Chip
// closes the gpiochip, which releases every line it owned (the next read fails with EPERM). Keep the
// header chip referenced for the life of the process.
let headerChip;

const startLibgpiod = (libgpiod) => {
  // Each chip is opened once, to read its label, and the header chip's handle is reused. node-libgpiod
  // has no Chip close(); the few handles opened here at startup are released on process exit.
  // node-libgpiod 0.6 exposes chip names, labels and line consumers as properties, not methods.
  const handles = new Map(libgpiod.chipNames.map((name) => [name, new libgpiod.Chip(gpioChipNumber(name))]));
  const chips = [...handles].map(([name, handle]) => ({ name, label: handle.label }));
  const { name: chipName, label } = selectHeaderGpioChip(chips, config.gpio.chip);
  console.log(`Using ${chipName} (${label}) for the 40-pin header`);
  const chip = handles.get(chipName);
  headerChip = chip;
  const lines = [];
  try {
    for (const pin of pins) {
      const line = chip.getLine(pin);
      // Read before requesting: the consumer explains an EBUSY (another program owns the pin).
      const consumer = line.consumer;
      try {
        line.requestInputMode('deepracer-timer');
      } catch (error) {
        const owner = consumer ? `; it is in use by "${consumer}"` : '';
        throw new Error(`Cannot claim GPIO${pin} on ${chipName}: ${error.message}${owner}`);
      }
      lines.push({ pin, line });
    }
  } catch (error) {
    // Release whatever was requested so a restart can claim the lines.
    for (const { line } of lines) line.release();
    throw error;
  }
  // node-libgpiod exposes no edge events, so poll and let the detector find the edges.
  const interval = setInterval(() => {
    for (const { pin, line } of lines) {
      let level;
      try {
        level = line.getValue();
      } catch (error) {
        // A read error won't fix itself 200 times a second: exit so systemd restarts the timer,
        // after publishing the crossings already queued.
        console.error(`GPIO${pin} read failed on ${chipName}:`, error.message);
        shutdown('GPIO read failure', 1);
        return;
      }
      onLevel(pin, level);
    }
  }, GPIO_POLL_INTERVAL_MS);
  releaseGpio = () => {
    clearInterval(interval);
    for (const { line } of lines) line.release();
  };
  console.log('Using node-libgpiod');
};

const setupRpiGpioPin = (gpio, pin) =>
  new Promise((resolve, reject) => {
    gpio.setup(pin, gpio.DIR_IN, gpio.EDGE_BOTH, (error) =>
      error ? reject(new Error(`Failed to set up GPIO${pin}: ${error.message}`)) : resolve(),
    );
  });

const startRpiGpio = async () => {
  const { default: gpio } = await import('rpi-gpio');
  gpio.setMode(gpio.MODE_BCM);
  gpio.on('change', (pin, value) => onLevel(pin, value ? 1 : 0));
  releaseGpio = () => gpio.destroy();
  try {
    await Promise.all(pins.map((pin) => setupRpiGpioPin(gpio, pin)));
  } catch (error) {
    releaseGpio();
    throw error;
  }
  console.log('Using rpi-gpio (legacy, pre-6.x kernels only)');
};

// rpi-gpio is only a fallback for when node-libgpiod can't be loaded (no native build): on 6.x
// kernels it cannot work, so falling back after a libgpiod setup error would only hide the cause.
// Any setup failure exits, so systemd restarts the service and the Timekeeping page shows the
// timer as not responding instead of online with no working sensors.
let libgpiod;
try {
  ({ default: libgpiod } = await import('node-libgpiod'));
} catch (importError) {
  console.warn('node-libgpiod unavailable, falling back to rpi-gpio:', importError.message);
}
try {
  if (libgpiod) startLibgpiod(libgpiod);
  else await startRpiGpio();
} catch (error) {
  console.error('GPIO setup failed, exiting:', error.message);
  process.exit(1);
}

// Heartbeats let the Timekeeping page show that this timer is live before the first crossing.
const heartbeat = () => publish(buildHeartbeatMessage({ instanceId, bootId, timestamp: now() }));
heartbeat();
const heartbeatInterval = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

let shuttingDown = false;
// Stops reading the sensors, then publishes whatever is still queued (including laps being retried)
// before exiting.
const shutdown = (reason, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${reason}, shutting down`);
  clearInterval(heartbeatInterval);
  try {
    releaseGpio();
  } catch {
    /* ignore cleanup errors */
  }
  drain().then(() => process.exit(exitCode));
};
process.on('SIGINT', () => shutdown('SIGINT received'));
process.on('SIGTERM', () => shutdown('SIGTERM received'));
