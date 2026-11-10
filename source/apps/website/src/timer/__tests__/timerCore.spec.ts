// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// The RPi timer ships as static files from public/timer; its hardware-independent logic is
// tested here because the website is the package that publishes it.
import {
  buildHeartbeatMessage,
  buildLapMessage,
  createCrossingDetector,
  createOrderedPublisher,
  createSharedCredentialsProvider,
  CREDENTIALS_REFRESH_MS,
  gpioChipNumber,
  PUBLISH_RETRY_DELAYS_MS,
  parseConfig,
  parseInstanceId,
  parseSharedCredentials,
  selectHeaderGpioChip,
  timerTopic,
  withPublishTime,
} from '../../../public/timer/timerCore.mjs';

const VALID_CONFIG = {
  region: 'us-east-1',
  iotEndpoint: 'abc123-ats.iot.us-east-1.amazonaws.com',
  topicPrefix: 'deepracer/ns/timer',
};

describe('parseConfig', () => {
  it('applies defaults for optional settings', () => {
    expect(parseConfig(VALID_CONFIG)).toEqual({
      ...VALID_CONFIG,
      credentialsFile: '/root/.aws/credentials',
      registrationFile: '/var/lib/amazon/ssm/registration',
      gpio: { sensor1: 17, sensor2: 27, debounceMs: 2000, activeLow: false },
    });
  });

  it('keeps configured GPIO settings and strips a trailing slash from the topic prefix', () => {
    const config = parseConfig({
      ...VALID_CONFIG,
      topicPrefix: 'deepracer/ns/timer/',
      gpio: { sensor1: 5, sensor2: 6, debounceMs: 1500, activeLow: true },
    });

    expect(config.topicPrefix).toBe('deepracer/ns/timer');
    expect(config.gpio).toEqual({ sensor1: 5, sensor2: 6, debounceMs: 1500, activeLow: true });
  });

  it('strips every trailing slash from the topic prefix', () => {
    expect(parseConfig({ ...VALID_CONFIG, topicPrefix: 'deepracer/ns/timer///' }).topicPrefix).toBe(
      'deepracer/ns/timer',
    );
    expect(parseConfig({ ...VALID_CONFIG, topicPrefix: '///' }).topicPrefix).toBe('');
  });

  it('keeps configured credential and registration file paths', () => {
    const config = parseConfig({ ...VALID_CONFIG, credentialsFile: '/tmp/creds', registrationFile: '/tmp/reg' });

    expect(config.credentialsFile).toBe('/tmp/creds');
    expect(config.registrationFile).toBe('/tmp/reg');
  });

  it('keeps a configured GPIO chip override as a string', () => {
    expect(parseConfig({ ...VALID_CONFIG, gpio: { chip: 0 } }).gpio.chip).toBe('0');
    expect(parseConfig(VALID_CONFIG).gpio).not.toHaveProperty('chip');
  });

  it.each(['region', 'iotEndpoint', 'topicPrefix'])('rejects a config without %s', (key) => {
    expect(() => parseConfig({ ...VALID_CONFIG, [key]: '' })).toThrow(key);
  });

  it('rejects a non-object config', () => {
    expect(() => parseConfig(null)).toThrow('JSON object');
  });
});

describe('parseInstanceId', () => {
  it('reads the managed instance ID from the SSM registration file', () => {
    expect(parseInstanceId('{"ManagedInstanceID":"mi-0123456789abcdef0","Region":"us-east-1"}')).toBe(
      'mi-0123456789abcdef0',
    );
  });

  it('rejects a registration file without a managed instance ID', () => {
    expect(() => parseInstanceId('{"Region":"us-east-1"}')).toThrow('ManagedInstanceID');
  });
});

describe('parseSharedCredentials', () => {
  const ini = [
    '# written by the SSM agent',
    '[other]',
    'aws_access_key_id = OTHER',
    'aws_secret_access_key = other-secret',
    '',
    '[default]',
    'aws_access_key_id = AKIDEXAMPLE',
    'aws_secret_access_key = secret=with=equals',
    'aws_session_token = token',
  ].join('\n');

  it('returns the default profile credentials', () => {
    expect(parseSharedCredentials(ini)).toEqual({
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'secret=with=equals',
      sessionToken: 'token',
    });
  });

  it('returns a named profile without a session token', () => {
    expect(parseSharedCredentials(ini, 'other')).toEqual({ accessKeyId: 'OTHER', secretAccessKey: 'other-secret' });
  });

  it('skips lines without a key/value separator', () => {
    expect(
      parseSharedCredentials('[default]\ngarbage line\naws_access_key_id = AKID\naws_secret_access_key = secret'),
    ).toEqual({ accessKeyId: 'AKID', secretAccessKey: 'secret' });
  });

  it('returns undefined when the profile is missing or incomplete', () => {
    expect(parseSharedCredentials(ini, 'missing')).toBeUndefined();
    expect(parseSharedCredentials('[default]\naws_access_key_id = AKID')).toBeUndefined();
  });
});

describe('createCrossingDetector', () => {
  it('fires on the rising edge for active-high sensors', () => {
    const detect = createCrossingDetector({ debounceMs: 2000, activeLow: false });

    expect(detect(17, 0, 0)).toBe(false);
    expect(detect(17, 1, 10)).toBe(true);
    expect(detect(17, 1, 15)).toBe(false);
    expect(detect(17, 0, 3000)).toBe(false);
    expect(detect(17, 1, 5000)).toBe(true);
  });

  it('fires on the falling edge for active-low (IR break-beam) sensors', () => {
    const detect = createCrossingDetector({ debounceMs: 2000, activeLow: true });

    expect(detect(17, 1, 0)).toBe(false);
    expect(detect(17, 0, 10)).toBe(true);
    expect(detect(17, 1, 500)).toBe(false);
  });

  it('treats the first sample as the resting level even if it is active', () => {
    const detect = createCrossingDetector({ debounceMs: 2000, activeLow: false });

    expect(detect(17, 1, 0)).toBe(false);
  });

  it('suppresses a second crossing from either sensor within the debounce window', () => {
    const detect = createCrossingDetector({ debounceMs: 2000, activeLow: false });
    detect(17, 0, 0);
    detect(27, 0, 0);

    expect(detect(17, 1, 100)).toBe(true);
    expect(detect(27, 1, 150)).toBe(false);
    detect(17, 0, 1000);
    expect(detect(17, 1, 2099)).toBe(false);
    detect(17, 0, 2200);
    expect(detect(17, 1, 2100 + 2000)).toBe(true);
  });
});

describe('messages', () => {
  it('builds the per-timer topic', () => {
    expect(timerTopic('deepracer/ns/timer', 'mi-0123456789abcdef0')).toBe('deepracer/ns/timer/mi-0123456789abcdef0');
  });

  it('builds lap and heartbeat payloads carrying the process bootId', () => {
    expect(buildLapMessage({ instanceId: 'mi-1', bootId: 'boot-a', timestamp: 1000, gpio: 17, sequence: 3 })).toEqual({
      eventType: 'TIMER_LAP',
      instanceId: 'mi-1',
      bootId: 'boot-a',
      timestamp: 1000,
      gpio: 17,
      sequence: 3,
    });
    expect(buildHeartbeatMessage({ instanceId: 'mi-1', bootId: 'boot-a', timestamp: 2000 })).toEqual({
      eventType: 'TIMER_HEARTBEAT',
      instanceId: 'mi-1',
      bootId: 'boot-a',
      timestamp: 2000,
    });
  });

  it('stamps the send time without changing the message', () => {
    const lap = buildLapMessage({ instanceId: 'mi-1', bootId: 'boot-a', timestamp: 1000, gpio: 17, sequence: 3 });

    expect(withPublishTime(lap, 4500)).toEqual({ ...lap, publishedAt: 4500 });
    expect(lap).not.toHaveProperty('publishedAt');
  });
});

describe('createSharedCredentialsProvider', () => {
  it('re-reads the credentials file and expires the credentials after the refresh interval', async () => {
    const readFile = vi.fn(() => '[default]\naws_access_key_id = AKID\naws_secret_access_key = secret');
    const provider = createSharedCredentialsProvider({
      credentialsFile: '/root/.aws/credentials',
      readFile,
      now: () => 1_000,
    });

    await expect(provider()).resolves.toEqual({
      accessKeyId: 'AKID',
      secretAccessKey: 'secret',
      expiration: new Date(1_000 + CREDENTIALS_REFRESH_MS),
    });
    await provider();
    expect(readFile).toHaveBeenCalledTimes(2);
    expect(readFile).toHaveBeenCalledWith('/root/.aws/credentials');
  });

  it('rejects when the file has no default profile', async () => {
    const provider = createSharedCredentialsProvider({ credentialsFile: '/root/.aws/credentials', readFile: () => '' });

    await expect(provider()).rejects.toThrow('No default profile in /root/.aws/credentials');
  });
});

describe('createOrderedPublisher', () => {
  it('sends messages one at a time in order', async () => {
    const sent: string[] = [];
    let releaseFirst: () => void = () => undefined;
    const send = vi.fn(
      (message: { eventType: string }) =>
        new Promise<void>((resolve) => {
          if (message.eventType === 'FIRST') {
            releaseFirst = () => {
              sent.push(message.eventType);
              resolve();
            };
          } else {
            sent.push(message.eventType);
            resolve();
          }
        }),
    );
    const { publish, drain } = createOrderedPublisher(send);

    void publish({ eventType: 'FIRST' });
    void publish({ eventType: 'SECOND' });
    await Promise.resolve();
    expect(send).toHaveBeenCalledTimes(1);

    releaseFirst();
    await drain();

    expect(sent).toEqual(['FIRST', 'SECOND']);
  });

  it('logs a failed publish and keeps sending the rest', async () => {
    const logError = vi.fn();
    const send = vi
      .fn<(message: { eventType: string }) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('AccessDenied'))
      .mockResolvedValueOnce(undefined);
    const { publish, drain } = createOrderedPublisher(send, { logError });

    await expect(publish({ eventType: 'TIMER_LAP' })).resolves.toBeUndefined();
    void publish({ eventType: 'TIMER_HEARTBEAT' });
    await drain();

    expect(logError).toHaveBeenCalledWith('Failed to publish TIMER_LAP:', 'AccessDenied');
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('logs a non-Error rejection as-is', async () => {
    const logError = vi.fn();
    const { publish } = createOrderedPublisher(() => Promise.reject('boom'), { logError });

    await publish({ eventType: 'TIMER_LAP' });

    expect(logError).toHaveBeenCalledWith('Failed to publish TIMER_LAP:', 'boom');
  });

  it('retries a crossing with backoff, keeping later messages queued behind it', async () => {
    const logError = vi.fn();
    const sleep = vi.fn(() => Promise.resolve());
    const sent: string[] = [];
    const send = vi
      .fn<(message: { eventType: string }) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('ServiceUnavailable'))
      .mockRejectedValueOnce(new Error('ServiceUnavailable'))
      .mockImplementation((message) => {
        sent.push(message.eventType);
        return Promise.resolve();
      });
    const { publish, drain } = createOrderedPublisher(send, { logError, retryDelaysMs: [10, 20, 40], sleep });

    void publish({ eventType: 'TIMER_LAP' }, { retry: true });
    void publish({ eventType: 'TIMER_HEARTBEAT' });
    await drain();

    expect(sleep.mock.calls).toEqual([[10], [20]]);
    expect(sent).toEqual(['TIMER_LAP', 'TIMER_HEARTBEAT']);
    expect(logError).toHaveBeenCalledWith('Publish TIMER_LAP failed, retrying in 10ms:', 'ServiceUnavailable');
    expect(logError).not.toHaveBeenCalledWith('Failed to publish TIMER_LAP:', expect.anything());
  });

  it('gives up on a crossing after the last retry', async () => {
    const logError = vi.fn();
    const sleep = vi.fn(() => Promise.resolve());
    const send = vi.fn(() => Promise.reject(new Error('AccessDenied')));
    const { publish } = createOrderedPublisher(send, { logError, retryDelaysMs: [10, 20], sleep });

    await publish({ eventType: 'TIMER_LAP' }, { retry: true });

    expect(send).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(logError).toHaveBeenLastCalledWith('Failed to publish TIMER_LAP:', 'AccessDenied');
  });

  it('does not retry messages published without retry, such as heartbeats', async () => {
    const sleep = vi.fn(() => Promise.resolve());
    const send = vi.fn(() => Promise.reject(new Error('Throttled')));
    const { publish } = createOrderedPublisher(send, { logError: vi.fn(), sleep });

    await publish({ eventType: 'TIMER_HEARTBEAT' });

    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('waits between retries by default', async () => {
    vi.useFakeTimers();
    const send = vi
      .fn<(message: { eventType: string }) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('ServiceUnavailable'))
      .mockResolvedValueOnce(undefined);
    const { publish } = createOrderedPublisher(send, { logError: vi.fn() });

    const published = publish({ eventType: 'TIMER_LAP' }, { retry: true });
    await vi.advanceTimersByTimeAsync(PUBLISH_RETRY_DELAYS_MS[0] - 1);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await published;

    expect(send).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

describe('selectHeaderGpioChip', () => {
  const PI5_CHIPS = [
    { name: 'gpiochip0', label: 'pinctrl-rp1' },
    { name: 'gpiochip10', label: 'gpio-brcmstb@107d508500' },
    { name: 'gpiochip11', label: 'pinctrl-bcm2712' },
  ];

  it('picks the RP1 chip on a Pi 5 regardless of its number', () => {
    expect(selectHeaderGpioChip(PI5_CHIPS)).toEqual({ name: 'gpiochip0', label: 'pinctrl-rp1' });
    expect(
      selectHeaderGpioChip([
        { name: 'gpiochip3', label: 'x' },
        { name: 'gpiochip4', label: 'pinctrl-rp1' },
      ]),
    ).toEqual({ name: 'gpiochip4', label: 'pinctrl-rp1' });
  });

  it.each(['pinctrl-bcm2711', 'pinctrl-bcm2835'])('picks the %s chip on earlier models', (label) => {
    expect(
      selectHeaderGpioChip([
        { name: 'gpiochip1', label: 'raspberrypi-exp-gpio' },
        { name: 'gpiochip0', label },
      ]),
    ).toEqual({ name: 'gpiochip0', label });
  });

  it('honours a configured chip by name or number', () => {
    expect(selectHeaderGpioChip(PI5_CHIPS, 'gpiochip11').name).toBe('gpiochip11');
    expect(selectHeaderGpioChip(PI5_CHIPS, '10').name).toBe('gpiochip10');
  });

  it('lists the available chips when the configured chip does not exist', () => {
    expect(() => selectHeaderGpioChip(PI5_CHIPS, 'gpiochip4')).toThrow(
      'Configured gpio.chip "gpiochip4" not found. Available chips: gpiochip0 (pinctrl-rp1)',
    );
  });

  it('lists the available chips when no header chip is recognised', () => {
    expect(() => selectHeaderGpioChip([{ name: 'gpiochip0', label: 'unknown' }])).toThrow(
      'No 40-pin header GPIO chip found. Set gpio.chip in the timer config. Available chips: gpiochip0 (unknown)',
    );
    expect(() => selectHeaderGpioChip([])).toThrow('Available chips: none');
  });
});

describe('gpioChipNumber', () => {
  it('parses the number from a chip name', () => {
    expect(gpioChipNumber('gpiochip4')).toBe(4);
  });

  it('rejects anything else', () => {
    expect(() => gpioChipNumber('/dev/gpiochip4')).toThrow('Unexpected GPIO chip name');
  });
});
