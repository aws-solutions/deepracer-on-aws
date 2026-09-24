// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeploymentStatus } from '@deepracer-indy/typescript-server-client';

import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { deploymentDao } from '../DeploymentDao.js';

function createDeploymentParams(overrides: Record<string, unknown> = {}) {
  return {
    modelId: generateResourceId(),
    profileId: generateResourceId(),
    carInstanceId: `mi-${generateResourceId()}`,
    status: DeploymentStatus.PENDING,
    modelName: `Model-${generateResourceId().slice(0, 6)}`,
    carName: `Car-${generateResourceId().slice(0, 6)}`,
    ...overrides,
  };
}

describe('DeploymentDao', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    if (Items?.length) {
      await Promise.all(
        Items.map((item) =>
          testDynamoDBDocumentClient.delete({ TableName: TEST_TABLE_NAME, Key: { pk: item.pk, sk: item.sk } }),
        ),
      );
    }
  });

  describe('create() and get()', () => {
    it('should round-trip a deployment by modelId + deploymentId', async () => {
      const params = createDeploymentParams();
      const created = await deploymentDao.create(params);

      const loaded = await deploymentDao.get({ modelId: params.modelId, deploymentId: created.deploymentId });

      expect(loaded).toMatchObject({
        modelId: params.modelId,
        carInstanceId: params.carInstanceId,
        status: DeploymentStatus.PENDING,
        modelName: params.modelName,
        carName: params.carName,
      });
    });

    it('should auto-generate deploymentId and timestamps', async () => {
      const params = createDeploymentParams();
      const created = await deploymentDao.create(params);

      expect(created.deploymentId).toBeDefined();
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('should store optional batchId and eventId when provided', async () => {
      const batchId = generateResourceId();
      const eventId = generateResourceId();
      const params = createDeploymentParams({ batchId, eventId });
      const created = await deploymentDao.create(params);

      const loaded = await deploymentDao.get({ modelId: params.modelId, deploymentId: created.deploymentId });

      expect(loaded?.batchId).toBe(batchId);
      expect(loaded?.eventId).toBe(eventId);
    });
  });

  describe('listByModel()', () => {
    it('should return only deployments for the specified model', async () => {
      const modelId = generateResourceId();
      const otherModelId = generateResourceId();

      await Promise.all([
        deploymentDao.create(createDeploymentParams({ modelId })),
        deploymentDao.create(createDeploymentParams({ modelId })),
        deploymentDao.create(createDeploymentParams({ modelId: otherModelId })),
      ]);

      const { data } = await deploymentDao.listByModel({ modelId });

      expect(data).toHaveLength(2);
      expect(data.every((d) => d.modelId === modelId)).toBe(true);
    });

    it('should return empty list when no deployments exist for model', async () => {
      const { data } = await deploymentDao.listByModel({ modelId: generateResourceId() });
      expect(data).toHaveLength(0);
    });
  });

  describe('listByBatch()', () => {
    it('should return only deployments for the specified batch', async () => {
      const batchId = generateResourceId();
      const otherBatchId = generateResourceId();

      await Promise.all([
        deploymentDao.create(createDeploymentParams({ batchId })),
        deploymentDao.create(createDeploymentParams({ batchId })),
        deploymentDao.create(createDeploymentParams({ batchId: otherBatchId })),
      ]);

      const { data } = await deploymentDao.listByBatch({ batchId });

      expect(data).toHaveLength(2);
      expect(data.every((d) => d.batchId === batchId)).toBe(true);
    });
  });

  describe('listByEvent()', () => {
    it('should return only deployments for the specified event', async () => {
      const eventId = generateResourceId();
      const otherEventId = generateResourceId();

      await Promise.all([
        deploymentDao.create(createDeploymentParams({ eventId })),
        deploymentDao.create(createDeploymentParams({ eventId })),
        deploymentDao.create(createDeploymentParams({ eventId: otherEventId })),
      ]);

      const { data } = await deploymentDao.listByEvent({ eventId });

      expect(data).toHaveLength(2);
      expect(data.every((d) => d.eventId === eventId)).toBe(true);
    });

    it('should not include deployments without eventId (sparse GSI)', async () => {
      const eventId = generateResourceId();

      await Promise.all([
        deploymentDao.create(createDeploymentParams({ eventId })),
        deploymentDao.create(createDeploymentParams()), // no eventId
      ]);

      const { data } = await deploymentDao.listByEvent({ eventId });

      expect(data).toHaveLength(1);
      expect(data[0].eventId).toBe(eventId);
    });
  });

  describe('updateStatus()', () => {
    it('should set status to IN_PROGRESS and record uploadStartedAt', async () => {
      const params = createDeploymentParams();
      const created = await deploymentDao.create(params);

      const updated = await deploymentDao.updateStatus({
        modelId: params.modelId,
        deploymentId: created.deploymentId,
        status: DeploymentStatus.IN_PROGRESS,
        expectedStatus: DeploymentStatus.PENDING,
      });

      expect(updated.status).toBe(DeploymentStatus.IN_PROGRESS);
      expect(updated.uploadStartedAt).toBeDefined();
      expect(updated.completedAt).toBeUndefined();
    });

    it('should set status to COMPLETED and record completedAt', async () => {
      const params = createDeploymentParams();
      const created = await deploymentDao.create(params);

      // First transition to IN_PROGRESS
      await deploymentDao.updateStatus({
        modelId: params.modelId,
        deploymentId: created.deploymentId,
        status: DeploymentStatus.IN_PROGRESS,
        expectedStatus: DeploymentStatus.PENDING,
      });

      const updated = await deploymentDao.updateStatus({
        modelId: params.modelId,
        deploymentId: created.deploymentId,
        status: DeploymentStatus.COMPLETED,
        expectedStatus: DeploymentStatus.IN_PROGRESS,
      });

      expect(updated.status).toBe(DeploymentStatus.COMPLETED);
      expect(updated.completedAt).toBeDefined();
    });

    it('should set status to FAILED with errorMessage and completedAt', async () => {
      const params = createDeploymentParams();
      const created = await deploymentDao.create(params);

      // First transition to IN_PROGRESS
      await deploymentDao.updateStatus({
        modelId: params.modelId,
        deploymentId: created.deploymentId,
        status: DeploymentStatus.IN_PROGRESS,
        expectedStatus: DeploymentStatus.PENDING,
      });

      const updated = await deploymentDao.updateStatus({
        modelId: params.modelId,
        deploymentId: created.deploymentId,
        status: DeploymentStatus.FAILED,
        expectedStatus: DeploymentStatus.IN_PROGRESS,
        errorMessage: 'SSM command timed out',
      });

      expect(updated.status).toBe(DeploymentStatus.FAILED);
      expect(updated.errorMessage).toBe('SSM command timed out');
      expect(updated.completedAt).toBeDefined();
    });

    it('should reject transition when expectedStatus does not match current status', async () => {
      const params = createDeploymentParams();
      const created = await deploymentDao.create(params);

      // Try to transition directly to COMPLETED from PENDING (should fail — expected IN_PROGRESS)
      await expect(
        deploymentDao.updateStatus({
          modelId: params.modelId,
          deploymentId: created.deploymentId,
          status: DeploymentStatus.COMPLETED,
          expectedStatus: DeploymentStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow();
    });
  });
});
