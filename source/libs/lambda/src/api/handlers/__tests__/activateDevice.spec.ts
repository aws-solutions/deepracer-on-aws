// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeviceType, InternalFailureError, NotAuthorizedError } from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { ActivateDeviceOperation } from '../activateDevice.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const HYBRID_ROLE = 'DeepRacerIndy-SSMHybridActivationRole';
const carInput = { name: 'car-01', deviceType: DeviceType.CAR, fleetId: 'ABCDEFGHIJKLMNO' };
const timerInput = { name: 'timer-01', deviceType: DeviceType.TIMER };

/** Extracts the CreateActivationCommand input from the first ssmClient.send call. */
const sentActivationInput = () =>
  (vi.mocked(ssmClient.send).mock.calls[0][0] as unknown as { input: Record<string, unknown> }).input;

beforeAll(() => {
  process.env.HYBRID_ACTIVATION_IAM_ROLE_NAME = HYBRID_ROLE;
  process.env.AWS_REGION = 'us-east-1';
});

afterAll(() => {
  delete process.env.HYBRID_ACTIVATION_IAM_ROLE_NAME;
});

describe('ActivateDevice operation', () => {
  beforeEach(() => {
    process.env.HYBRID_ACTIVATION_IAM_ROLE_NAME = HYBRID_ROLE;
    process.env.AWS_REGION = 'us-east-1';
    mockIsUserAdmin.mockResolvedValue(true);
    vi.mocked(ssmClient.send).mockResolvedValue({
      ActivationId: 'act-123',
      ActivationCode: 'super-secret-code',
    } as never);
  });

  it('throws NotAuthorizedError and does not call SSM when caller is not an admin', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('creates an SSM activation and returns activation params', async () => {
    const output = await ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT);

    expect(output.activationId).toBe('act-123');
    expect(output.activationCode).toBe('super-secret-code');
    expect(output.region).toBe('us-east-1');
    expect(output.expiresAt).toBeInstanceOf(Date);

    const input = sentActivationInput();
    expect(input.IamRole).toBe(HYBRID_ROLE);
    expect(input.RegistrationLimit).toBe(1);
    expect(input.DefaultInstanceName).toBe('car-01');
  });

  it('tags the activation with deepracer:managed=true plus Name/Type/fleetId', async () => {
    await ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT);

    const tags = sentActivationInput().Tags as Array<{ Key: string; Value: string }>;
    expect(tags).toEqual(
      expect.arrayContaining([
        { Key: 'deepracer:managed', Value: 'true' },
        { Key: 'Name', Value: 'car-01' },
        { Key: 'Type', Value: 'CAR' },
        { Key: 'fleetId', Value: 'ABCDEFGHIJKLMNO' },
      ]),
    );
  });

  it('omits the fleetId tag when no fleet is provided (still tagged deepracer:managed)', async () => {
    await ActivateDeviceOperation(timerInput, TEST_OPERATION_CONTEXT);

    const tags = sentActivationInput().Tags as Array<{ Key: string; Value: string }>;
    expect(tags.find((t) => t.Key === 'fleetId')).toBeUndefined();
    expect(tags).toEqual(expect.arrayContaining([{ Key: 'deepracer:managed', Value: 'true' }]));
  });

  it('sets an expiry ~24h out and passes it to SSM as ExpirationDate', async () => {
    const before = Date.now();
    const output = await ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT);

    const delta = output.expiresAt.getTime() - before;
    expect(delta).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(delta).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    expect(sentActivationInput().ExpirationDate).toEqual(output.expiresAt);
  });

  it('throws InternalFailureError when HYBRID_ACTIVATION_IAM_ROLE_NAME is missing', async () => {
    delete process.env.HYBRID_ACTIVATION_IAM_ROLE_NAME;

    await expect(ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });

  it('throws InternalFailureError when SSM CreateActivation fails', async () => {
    vi.mocked(ssmClient.send).mockRejectedValueOnce(new Error('ThrottlingException'));

    await expect(ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);
  });

  it('throws InternalFailureError when SSM returns no activation details', async () => {
    vi.mocked(ssmClient.send).mockResolvedValueOnce({} as never);

    await expect(ActivateDeviceOperation(carInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);
  });
});
