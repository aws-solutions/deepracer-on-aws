// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const publicDir = path.resolve(__dirname, '../../../public');
const DEPLOYMENT_EXCLUDED_NAMES = ['package.json', 'mockServiceWorker.js'];

const timerFiles = (): string[] => {
  const script = readFileSync(path.join(publicDir, 'timer_activation.sh'), 'utf8');
  const match = /^timerFiles="([^"]+)"$/m.exec(script);
  if (!match) throw new Error('timerFiles not found in timer_activation.sh');
  return match[1].split(/\s+/);
};

describe('timer_activation.sh timer files', () => {
  it.each(timerFiles())('downloads %s, which is published under public/timer', (file) => {
    expect(existsSync(path.join(publicDir, 'timer', file))).toBe(true);
    expect(DEPLOYMENT_EXCLUDED_NAMES).not.toContain(path.basename(file));
    expect(file).not.toMatch(/\.map$/);
  });

  it('publishes the timer manifest as valid JSON', () => {
    const manifest = JSON.parse(readFileSync(path.join(publicDir, 'timer', 'timer-package.json'), 'utf8')) as {
      main: string;
      dependencies: Record<string, string>;
    };

    expect(timerFiles()).toContain(manifest.main);
    expect(manifest.dependencies).toHaveProperty('@aws-sdk/client-iot-data-plane');
  });
});
