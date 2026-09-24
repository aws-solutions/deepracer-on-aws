// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeviceType } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { ACTIVATE_DEVICE_DEFAULTS, activateDeviceValidationSchema, ActivateDeviceFormValues } from './validation';

const validForm: ActivateDeviceFormValues = {
  deviceType: DeviceType.CAR,
  fleetId: '',
  name: 'my-device',
  ssid: '',
  wifiPassword: '',
  consolePassword: '',
  communityConsole: false,
};

describe('activateDeviceValidationSchema', () => {
  it('passes with all valid required fields', async () => {
    await expect(activateDeviceValidationSchema.validate(validForm)).resolves.toBeDefined();
  });

  it('fails when name is empty', async () => {
    await expect(activateDeviceValidationSchema.validate({ ...validForm, name: '' })).rejects.toThrow();
  });

  it('fails when name exceeds 64 characters', async () => {
    await expect(activateDeviceValidationSchema.validate({ ...validForm, name: 'a'.repeat(65) })).rejects.toThrow();
  });

  it('passes when name is exactly 64 characters', async () => {
    await expect(
      activateDeviceValidationSchema.validate({ ...validForm, name: 'a'.repeat(64) }),
    ).resolves.toBeDefined();
  });

  it('passes when name is 1 character', async () => {
    await expect(activateDeviceValidationSchema.validate({ ...validForm, name: 'a' })).resolves.toBeDefined();
  });

  it('fails when deviceType is empty', async () => {
    await expect(activateDeviceValidationSchema.validate({ ...validForm, deviceType: '' })).rejects.toThrow();
  });

  it('passes with deviceType CAR', async () => {
    await expect(
      activateDeviceValidationSchema.validate({ ...validForm, deviceType: DeviceType.CAR }),
    ).resolves.toBeDefined();
  });

  it('passes with deviceType TIMER', async () => {
    await expect(
      activateDeviceValidationSchema.validate({ ...validForm, deviceType: DeviceType.TIMER }),
    ).resolves.toBeDefined();
  });

  it('passes when fleetId is empty (optional)', async () => {
    await expect(activateDeviceValidationSchema.validate({ ...validForm, fleetId: '' })).resolves.toBeDefined();
  });

  it('passes when fleetId is provided', async () => {
    await expect(
      activateDeviceValidationSchema.validate({ ...validForm, fleetId: 'fleet-123' }),
    ).resolves.toBeDefined();
  });

  it('passes when optional fields are empty', async () => {
    await expect(
      activateDeviceValidationSchema.validate({
        ...validForm,
        ssid: '',
        wifiPassword: '',
        consolePassword: '',
      }),
    ).resolves.toBeDefined();
  });

  it('passes when optional fields have values', async () => {
    await expect(
      activateDeviceValidationSchema.validate({
        ...validForm,
        ssid: 'MyNetwork',
        wifiPassword: 'secret123',
        consolePassword: 'admin',
      }),
    ).resolves.toBeDefined();
  });
});

describe('ACTIVATE_DEVICE_DEFAULTS', () => {
  it('has expected default values', () => {
    expect(ACTIVATE_DEVICE_DEFAULTS.deviceType).toBe('');
    expect(ACTIVATE_DEVICE_DEFAULTS.fleetId).toBe('');
    expect(ACTIVATE_DEVICE_DEFAULTS.name).toBe('');
    expect(ACTIVATE_DEVICE_DEFAULTS.ssid).toBe('');
    expect(ACTIVATE_DEVICE_DEFAULTS.wifiPassword).toBe('');
    expect(ACTIVATE_DEVICE_DEFAULTS.consolePassword).toBe('');
    expect(ACTIVATE_DEVICE_DEFAULTS.communityConsole).toBe(false);
  });
});
