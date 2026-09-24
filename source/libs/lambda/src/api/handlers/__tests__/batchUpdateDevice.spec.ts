// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao, fleetDao } from '@deepracer-indy/database';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { BatchUpdateDeviceOperation } from '../batchUpdateDevice.js';

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const FLEET = 'FLEET0000000001';
const A = 'mi-0000000000000000a';
const B = 'mi-0000000000000000b';

describe('BatchUpdateDevice operation', () => {
  beforeEach(() => {
    mockIsUserAdmin.mockResolvedValue(true);
    vi.spyOn(fleetDao, 'load').mockResolvedValue({ fleetId: FLEET } as never);
    vi.spyOn(deviceDao, 'partialUpdate').mockResolvedValue({} as never);
    vi.mocked(ssmClient.send).mockResolvedValue({} as never);
  });

  it('assigns all devices to a fleet: validates the fleet once, patches DDB then tags each', async () => {
    const out = await BatchUpdateDeviceOperation({ instanceIds: [A, B], fleetId: FLEET }, TEST_OPERATION_CONTEXT);

    expect(fleetDao.load).toHaveBeenCalledTimes(1);
    expect(out.assignedInstanceIds).toEqual([A, B]);
    expect(out.errors).toEqual([]);
    // SSM tag (source of truth) is written first; the DDB cache is updated on success.
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: A }, { fleetId: FLEET });
    expect(vi.mocked(ssmClient.send).mock.calls[0][0].constructor.name).toBe('AddTagsToResourceCommand');
  });

  it('unassigns all devices when no fleetId is provided (removes the tag, clears DDB)', async () => {
    const out = await BatchUpdateDeviceOperation({ instanceIds: [A] }, TEST_OPERATION_CONTEXT);

    expect(fleetDao.load).not.toHaveBeenCalled();
    expect(vi.mocked(ssmClient.send).mock.calls[0][0].constructor.name).toBe('RemoveTagsFromResourceCommand');
    expect(deviceDao.partialUpdate).toHaveBeenCalledWith({ instanceId: A }, { fleetId: undefined });
    expect(out.assignedInstanceIds).toEqual([A]);
  });

  it('continues on per-device failure: returns a structured error for the bad instance', async () => {
    vi.mocked(ssmClient.send)
      .mockRejectedValueOnce(Object.assign(new Error('InvalidInstanceId'), { name: 'InvalidInstanceId' })) // A fails
      .mockResolvedValue({} as never); // B succeeds

    const out = await BatchUpdateDeviceOperation({ instanceIds: [A, B], fleetId: FLEET }, TEST_OPERATION_CONTEXT);

    expect(out.assignedInstanceIds).toEqual([B]);
    expect(out.errors).toEqual([{ instanceId: A, code: 'InvalidInstanceId', message: 'InvalidInstanceId' }]);
  });

  it('returns 400 when the target fleet does not exist (and touches no device)', async () => {
    vi.spyOn(fleetDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no fleet' }));

    await expect(
      BatchUpdateDeviceOperation({ instanceIds: [A, B], fleetId: 'BAD' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
    expect(ssmClient.send).not.toHaveBeenCalled();
    expect(deviceDao.partialUpdate).not.toHaveBeenCalled();
  });

  it('rejects non-admin callers', async () => {
    mockIsUserAdmin.mockResolvedValueOnce(false);

    await expect(
      BatchUpdateDeviceOperation({ instanceIds: [A], fleetId: FLEET }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
    expect(ssmClient.send).not.toHaveBeenCalled();
  });
});
