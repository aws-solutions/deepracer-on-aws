// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deploymentDao, eventDao, ResourceId } from '@deepracer-indy/database';
import { DeploymentStatus, NotAuthorizedError, NotFoundError } from '@deepracer-indy/typescript-server-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { GetDeploymentOperation } from '../getDeployment.js';
import { ListDeploymentsOperation } from '../listDeployments.js';
import { ListDeploymentsByBatchOperation } from '../listDeploymentsByBatch.js';
import { ListDeploymentsByEventOperation } from '../listDeploymentsByEvent.js';

vi.mock('@deepracer-indy/database');

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const TEST_DEPLOYMENT = {
  deploymentId: 'deploy-1' as ResourceId,
  modelId: 'model-1' as ResourceId,
  modelName: 'my-model',
  carInstanceId: 'i-abc123',
  carName: 'car-alpha',
  eventId: 'event-1' as ResourceId,
  profileId: 'profile-1' as ResourceId,
  batchId: 'batch-1' as ResourceId,
  status: DeploymentStatus.COMPLETED,
  errorMessage: undefined,
  createdAt: '2026-08-01T10:00:00.000Z',
  uploadStartedAt: '2026-08-01T10:00:05.000Z',
  completedAt: '2026-08-01T10:01:00.000Z',
};

const TEST_DEPLOYMENT_2 = {
  ...TEST_DEPLOYMENT,
  deploymentId: 'deploy-2' as ResourceId,
  carInstanceId: 'i-def456',
  carName: 'car-beta',
  status: DeploymentStatus.IN_PROGRESS,
  completedAt: undefined,
};

describe('GetDeployment operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(
      GetDeploymentOperation({ modelId: 'model-1', deploymentId: 'deploy-1' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should return full deployment detail', async () => {
    vi.spyOn(deploymentDao, 'get').mockResolvedValue(TEST_DEPLOYMENT as never);

    const output = await GetDeploymentOperation(
      { modelId: 'model-1', deploymentId: 'deploy-1' },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.deployment.deploymentId).toBe('deploy-1');
    expect(output.deployment.modelId).toBe('model-1');
    expect(output.deployment.eventId).toBe('event-1');
    expect(output.deployment.profileId).toBe('profile-1');
    expect(output.deployment.errorMessage).toBeUndefined();
    expect(output.deployment.createdAt).toEqual(new Date('2026-08-01T10:00:00.000Z'));
    expect(output.deployment.uploadStartedAt).toEqual(new Date('2026-08-01T10:00:05.000Z'));
    expect(output.deployment.completedAt).toEqual(new Date('2026-08-01T10:01:00.000Z'));
  });

  it('should throw NotFoundError when deployment does not exist', async () => {
    vi.spyOn(deploymentDao, 'get').mockResolvedValue(null as never);

    await expect(
      GetDeploymentOperation({ modelId: 'model-1', deploymentId: 'missing' }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('ListDeployments operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(ListDeploymentsOperation({ modelId: 'model-1' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('should return deployments for a model', async () => {
    vi.spyOn(deploymentDao, 'listByModel').mockResolvedValue({
      data: [TEST_DEPLOYMENT, TEST_DEPLOYMENT_2] as never[],
      cursor: null,
    });

    const output = await ListDeploymentsOperation({ modelId: 'model-1' }, TEST_OPERATION_CONTEXT);

    expect(output.deployments).toHaveLength(2);
    expect(output.deployments[0].deploymentId).toBe('deploy-1');
    expect(output.deployments[1].deploymentId).toBe('deploy-2');
    expect(output.token).toBeUndefined();
  });

  it('should pass pagination cursor', async () => {
    vi.spyOn(deploymentDao, 'listByModel').mockResolvedValue({
      data: [TEST_DEPLOYMENT] as never[],
      cursor: 'next-page-token',
    });

    const output = await ListDeploymentsOperation({ modelId: 'model-1', token: 'prev-token' }, TEST_OPERATION_CONTEXT);

    expect(deploymentDao.listByModel).toHaveBeenCalledWith({
      modelId: 'model-1',
      cursor: 'prev-token',
      maxResults: undefined,
    });
    expect(output.token).toBe('next-page-token');
  });
});

describe('ListDeploymentsByBatch operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(ListDeploymentsByBatchOperation({ batchId: 'batch-1' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('should return deployments for a batch', async () => {
    vi.spyOn(deploymentDao, 'listByBatch').mockResolvedValue({
      data: [TEST_DEPLOYMENT, TEST_DEPLOYMENT_2] as never[],
      cursor: null,
    });

    const output = await ListDeploymentsByBatchOperation({ batchId: 'batch-1' }, TEST_OPERATION_CONTEXT);

    expect(output.batchId).toBe('batch-1');
    expect(output.deployments).toHaveLength(2);
    expect(output.deployments[0].modelName).toBe('my-model');
    expect(output.deployments[0].carName).toBe('car-alpha');
    expect(output.token).toBeUndefined();
  });

  it('should return empty list for unknown batchId', async () => {
    vi.spyOn(deploymentDao, 'listByBatch').mockResolvedValue({ data: [], cursor: null });

    const output = await ListDeploymentsByBatchOperation({ batchId: 'unknown' }, TEST_OPERATION_CONTEXT);

    expect(output.deployments).toHaveLength(0);
  });
});

describe('ListDeploymentsByEvent operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(ListDeploymentsByEventOperation({ eventId: 'event-1' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotAuthorizedError,
    );
  });

  it('should reject reads for an event hidden by DELETING status', async () => {
    const hiddenEventError = new NotFoundError({ message: 'Event not found.' });
    vi.spyOn(eventDao, 'load').mockRejectedValue(hiddenEventError);
    const listSpy = vi.spyOn(deploymentDao, 'listByEvent');

    await expect(ListDeploymentsByEventOperation({ eventId: 'event-1' }, TEST_OPERATION_CONTEXT)).rejects.toStrictEqual(
      hiddenEventError,
    );
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('should return deployments for an event', async () => {
    vi.spyOn(deploymentDao, 'listByEvent').mockResolvedValue({
      data: [TEST_DEPLOYMENT] as never[],
      cursor: null,
    });

    const output = await ListDeploymentsByEventOperation({ eventId: 'event-1' }, TEST_OPERATION_CONTEXT);

    expect(output.eventId).toBe('event-1');
    expect(output.deployments).toHaveLength(1);
    expect(output.deployments[0].status).toBe(DeploymentStatus.COMPLETED);
  });

  it('should reject an unrecognized eventId', async () => {
    vi.spyOn(eventDao, 'load').mockRejectedValue(new NotFoundError({ message: 'Event not found.' }));

    await expect(ListDeploymentsByEventOperation({ eventId: 'nonexistent' }, TEST_OPERATION_CONTEXT)).rejects.toThrow(
      NotFoundError,
    );
    expect(deploymentDao.listByEvent).not.toHaveBeenCalled();
  });

  it('should pass maxResults and pagination token', async () => {
    vi.spyOn(deploymentDao, 'listByEvent').mockResolvedValue({
      data: [TEST_DEPLOYMENT] as never[],
      cursor: 'page-2',
    });

    const output = await ListDeploymentsByEventOperation(
      { eventId: 'event-1', maxResults: 10, token: 'page-1' },
      TEST_OPERATION_CONTEXT,
    );

    expect(deploymentDao.listByEvent).toHaveBeenCalledWith({
      eventId: 'event-1',
      cursor: 'page-1',
      maxResults: 10,
    });
    expect(output.token).toBe('page-2');
  });
});
