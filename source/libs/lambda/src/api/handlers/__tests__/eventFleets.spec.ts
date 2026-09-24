// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao, eventDao, fleetDao, fleetEventDao } from '@deepracer-indy/database';
import { BadRequestError, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { AssignEventFleetsOperation } from '../assignEventFleets.js';
import { ListEventDevicesOperation } from '../listEventDevices.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return {
    ...actual,
    isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args),
    isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args),
  };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);
const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);

const deviceItem = (instanceId: string, deviceType: string) => ({
  instanceId,
  name: instanceId,
  deviceType,
  status: 'ONLINE',
  activatedAt: '2026-01-01T00:00:00.000Z',
});

describe('AssignEventFleets operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(eventDao, 'load').mockResolvedValue({} as never);
    vi.spyOn(fleetDao, 'load').mockResolvedValue({} as never);
    vi.spyOn(fleetEventDao, 'listFleetsByEvent').mockResolvedValue([] as never);
    vi.spyOn(fleetEventDao, 'assign').mockResolvedValue({} as never);
  });

  it('assigns new fleets to the event', async () => {
    const out = await AssignEventFleetsOperation({ eventId: 'E1', fleetIds: ['F1', 'F2'] }, TEST_OPERATION_CONTEXT);
    expect(out.assignedFleetIds).toEqual(['F1', 'F2']);
    expect(fleetEventDao.assign).toHaveBeenCalledTimes(2);
  });

  it('skips already-assigned fleets (idempotent)', async () => {
    vi.spyOn(fleetEventDao, 'listFleetsByEvent').mockResolvedValue([{ eventId: 'E1', fleetId: 'F1' }] as never);
    await AssignEventFleetsOperation({ eventId: 'E1', fleetIds: ['F1', 'F2'] }, TEST_OPERATION_CONTEXT);
    expect(fleetEventDao.assign).toHaveBeenCalledTimes(1);
    expect(fleetEventDao.assign).toHaveBeenCalledWith({ eventId: 'E1', fleetId: 'F2' });
  });

  it('returns 404 when the event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no event' }));
    await expect(
      AssignEventFleetsOperation({ eventId: 'X', fleetIds: ['F1'] }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns 400 when a fleet does not exist', async () => {
    vi.spyOn(fleetDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no fleet' }));
    await expect(
      AssignEventFleetsOperation({ eventId: 'E1', fleetIds: ['BAD'] }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
  });

  it('persists no assignment when a later fleet in the batch is invalid (validate-then-assign is atomic)', async () => {
    // F1 is valid and appears before the invalid BAD. Validation must complete for the whole
    // batch before any assign runs, so the 400 leaves no partial assignment persisted.
    vi.spyOn(fleetDao, 'load').mockImplementation((params: unknown) => {
      const { fleetId } = params as { fleetId: string };
      return fleetId === 'BAD'
        ? Promise.reject(new NotFoundError({ message: 'no fleet' }))
        : (Promise.resolve({}) as never);
    });

    await expect(
      AssignEventFleetsOperation({ eventId: 'E1', fleetIds: ['F1', 'BAD'] }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);

    expect(fleetEventDao.assign).not.toHaveBeenCalled();
  });

  it('rejects callers who are neither admin nor facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);
    await expect(
      AssignEventFleetsOperation({ eventId: 'E1', fleetIds: ['F1'] }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
  });
});

describe('ListEventDevices operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
    vi.spyOn(eventDao, 'load').mockResolvedValue({} as never);
  });

  it('aggregates devices across all fleets assigned to the event', async () => {
    vi.spyOn(fleetEventDao, 'listFleetsByEvent').mockResolvedValue([{ fleetId: 'F1' }, { fleetId: 'F2' }] as never);
    vi.spyOn(deviceDao, 'listByFleet').mockImplementation(
      (fleetId: unknown) =>
        Promise.resolve(fleetId === 'F1' ? [deviceItem('mi-1', 'CAR')] : [deviceItem('mi-2', 'TIMER')]) as never,
    );

    const out = await ListEventDevicesOperation({ eventId: 'E1' }, TEST_OPERATION_CONTEXT);

    expect(out.devices.map((d) => d.instanceId).sort()).toEqual(['mi-1', 'mi-2']);
  });

  it('returns 404 when the event does not exist', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValue(new NotFoundError({ message: 'no event' }));
    await expect(ListEventDevicesOperation({ eventId: 'X' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotFoundError);
  });

  it('rejects callers who are neither admin nor facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);
    await expect(ListEventDevicesOperation({ eventId: 'E1' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });
});
