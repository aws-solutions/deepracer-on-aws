// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deviceDao, fleetDao, fleetEventDao } from '@deepracer-indy/database';
import { ConflictError, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { CreateFleetOperation } from '../createFleet.js';
import { DeleteFleetOperation } from '../deleteFleet.js';
import { ListFleetsOperation } from '../listFleets.js';
import { UpdateFleetOperation } from '../updateFleet.js';

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdmin(...args) };
});

const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

const fleetItem = {
  fleetId: 'FLEET0000000001',
  name: 'London',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Fleet CRUD handlers', () => {
  beforeEach(() => mockIsUserAdmin.mockResolvedValue(true));

  describe('CreateFleet', () => {
    it('creates a fleet and returns its id', async () => {
      vi.spyOn(fleetDao, 'create').mockResolvedValue(fleetItem as never);
      const out = await CreateFleetOperation({ fleetDefinition: { name: 'London' } }, TEST_OPERATION_CONTEXT);
      expect(out.fleetId).toBe('FLEET0000000001');
      expect(fleetDao.create).toHaveBeenCalledWith({ name: 'London' });
    });

    it('rejects non-admins', async () => {
      mockIsUserAdmin.mockResolvedValueOnce(false);
      await expect(CreateFleetOperation({ fleetDefinition: { name: 'x' } }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
        NotAuthorizedError,
      );
    });
  });

  describe('ListFleets', () => {
    it('lists fleets with device counts and Date timestamps', async () => {
      vi.spyOn(fleetDao, 'list').mockResolvedValue({ data: [fleetItem], cursor: null } as never);
      vi.spyOn(deviceDao, 'listByFleet').mockResolvedValue([{}, {}] as never);

      const out = await ListFleetsOperation({}, TEST_OPERATION_CONTEXT);

      expect(out.fleets).toHaveLength(1);
      expect(out.fleets[0].deviceCount).toBe(2);
      expect(out.fleets[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('UpdateFleet', () => {
    it('updates and returns the fleet', async () => {
      vi.spyOn(fleetDao, 'load').mockResolvedValue(fleetItem as never);
      vi.spyOn(fleetDao, 'partialUpdate').mockResolvedValue({ ...fleetItem, name: 'Paris' } as never);

      const out = await UpdateFleetOperation({ fleetId: 'FLEET0000000001', name: 'Paris' }, TEST_OPERATION_CONTEXT);

      expect(out.fleet.name).toBe('Paris');
      expect(fleetDao.partialUpdate).toHaveBeenCalledWith({ fleetId: 'FLEET0000000001' }, { name: 'Paris' });
    });

    it('propagates 404 when the fleet is missing', async () => {
      vi.spyOn(fleetDao, 'load').mockRejectedValue(new NotFoundError({ message: 'not found' }));
      await expect(UpdateFleetOperation({ fleetId: 'missing' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotFoundError);
    });
  });

  describe('DeleteFleet', () => {
    it('deletes a fleet that is not assigned to any event', async () => {
      vi.spyOn(fleetDao, 'load').mockResolvedValue(fleetItem as never);
      vi.spyOn(fleetEventDao, 'listEventsByFleet').mockResolvedValue([] as never);
      const del = vi.spyOn(fleetDao, 'delete').mockResolvedValue({} as never);

      await DeleteFleetOperation({ fleetId: 'FLEET0000000001' }, TEST_OPERATION_CONTEXT);

      expect(del).toHaveBeenCalledWith({ fleetId: 'FLEET0000000001' });
    });

    it('rejects with 409 Conflict when the fleet is assigned to an event', async () => {
      vi.spyOn(fleetDao, 'load').mockResolvedValue(fleetItem as never);
      vi.spyOn(fleetEventDao, 'listEventsByFleet').mockResolvedValue([
        { eventId: 'E1', fleetId: 'FLEET0000000001' },
      ] as never);
      const del = vi.spyOn(fleetDao, 'delete').mockResolvedValue({} as never);

      await expect(DeleteFleetOperation({ fleetId: 'FLEET0000000001' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
        ConflictError,
      );
      expect(del).not.toHaveBeenCalled();
    });

    it('propagates 404 when the fleet is missing', async () => {
      vi.spyOn(fleetDao, 'load').mockRejectedValue(new NotFoundError({ message: 'not found' }));
      await expect(DeleteFleetOperation({ fleetId: 'missing' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotFoundError);
    });
  });
});
