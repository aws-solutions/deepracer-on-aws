// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';

import { ModelStatus } from '@deepracer-indy/typescript-server-client';

import { DEFAULT_MAX_QUERY_RESULTS } from '../../constants/defaults.js';
import { DynamoDBItemAttribute } from '../../constants/itemAttributes.js';
import { RESOURCE_ID_REGEX } from '../../constants/regex.js';
import { TEST_CREATE_MODEL_PARAMS } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { s3PathHelper } from '../../utils/S3PathHelper.js';
import { modelDao } from '../ModelDao.js';

vi.mock('#constants/defaults.js', () => ({
  DEFAULT_MAX_QUERY_RESULTS: 1,
}));

describe('ModelDao', () => {
  describe('list()', () => {
    it('should return items up to maxResults and provide cursor for resuming query', async () => {
      const names = Array.from({ length: DEFAULT_MAX_QUERY_RESULTS + 1 }, () => randomUUID());
      const profileId = generateResourceId();

      await Promise.all(names.map((n) => modelDao.create({ ...TEST_CREATE_MODEL_PARAMS, name: n, profileId })));

      const defaultMaxResults = await modelDao.list({ profileId });
      const restResults = await modelDao.list({
        profileId,
        cursor: defaultMaxResults.cursor,
      });
      const allResults = [...defaultMaxResults.data, ...restResults.data];

      expect(defaultMaxResults.data).toHaveLength(DEFAULT_MAX_QUERY_RESULTS);
      expect(restResults.data).toHaveLength(names.length - defaultMaxResults.data.length);

      for (const result of allResults) {
        const modelId = result.modelId;

        expect(names).toContain(result.name);
        expect(result).toEqual({
          ...TEST_CREATE_MODEL_PARAMS,
          [DynamoDBItemAttribute.ASSET_S3_LOCATIONS]: {
            modelMetadataS3Location: s3PathHelper.getModelMetadataS3Location(modelId, profileId),
            modelRootS3Location: s3PathHelper.getModelRootS3Location(modelId, profileId),
            rewardFunctionS3Location: s3PathHelper.getRewardFunctionS3Location(modelId, profileId),
            sageMakerArtifactsS3Location: s3PathHelper.getSageMakerArtifactsS3Location(modelId, profileId),
          },
          [DynamoDBItemAttribute.PROFILE_ID]: profileId,
          [DynamoDBItemAttribute.NAME]: expect.any(String),
          [DynamoDBItemAttribute.FILE_SIZE_IN_BYTES]: 0,
          [DynamoDBItemAttribute.MODEL_ID]: expect.stringMatching(RESOURCE_ID_REGEX),
          [DynamoDBItemAttribute.CREATED_AT]: expect.any(String),
          [DynamoDBItemAttribute.UPDATED_AT]: expect.any(String),
        });
      }
    });
  });

  describe('setOptimizationFailed()', () => {
    it('should set optimizationStatus to FAILED when currently IN_PROGRESS', async () => {
      const profileId = generateResourceId();
      const created = await modelDao.create({
        ...TEST_CREATE_MODEL_PARAMS,
        profileId,
        optimizationStatus: 'IN_PROGRESS',
      });

      await modelDao.setOptimizationFailed({ modelId: created.modelId, profileId });

      const loaded = await modelDao.load({ modelId: created.modelId, profileId });
      expect(loaded.optimizationStatus).toBe('FAILED');
    });

    it('should throw when optimizationStatus is not IN_PROGRESS', async () => {
      const profileId = generateResourceId();
      const created = await modelDao.create({
        ...TEST_CREATE_MODEL_PARAMS,
        profileId,
        optimizationStatus: 'OPTIMIZED',
      });

      await expect(modelDao.setOptimizationFailed({ modelId: created.modelId, profileId })).rejects.toThrow();
    });

    it('should throw when model does not exist', async () => {
      await expect(
        modelDao.setOptimizationFailed({ modelId: generateResourceId(), profileId: generateResourceId() }),
      ).rejects.toThrow();
    });
  });

  describe('transitionStatus()', () => {
    it('should move the model to the new status and set statusMessage', async () => {
      const profileId = generateResourceId();
      const created = await modelDao.create({
        ...TEST_CREATE_MODEL_PARAMS,
        profileId,
        status: ModelStatus.WAITING_FOR_CAPACITY,
      });

      await modelDao.transitionStatus(
        { modelId: created.modelId, profileId },
        {
          from: ModelStatus.WAITING_FOR_CAPACITY,
          to: ModelStatus.WAITING_FOR_CAPACITY,
          statusMessage: 'no capacity',
        },
      );

      await expect(modelDao.load({ modelId: created.modelId, profileId })).resolves.toMatchObject({
        status: ModelStatus.WAITING_FOR_CAPACITY,
        statusMessage: 'no capacity',
      });
    });

    it('should clear statusMessage when none is supplied', async () => {
      const profileId = generateResourceId();
      const created = await modelDao.create({
        ...TEST_CREATE_MODEL_PARAMS,
        profileId,
        status: ModelStatus.WAITING_FOR_CAPACITY,
        statusMessage: 'no capacity',
      });

      await modelDao.transitionStatus(
        { modelId: created.modelId, profileId },
        { from: ModelStatus.WAITING_FOR_CAPACITY, to: ModelStatus.QUEUED },
      );

      const loaded = await modelDao.load({ modelId: created.modelId, profileId });
      expect(loaded.status).toBe(ModelStatus.QUEUED);
      expect(loaded.statusMessage).toBeUndefined();
    });

    it('should throw ConditionalCheckFailedException when the model is no longer in the from status', async () => {
      const profileId = generateResourceId();
      const created = await modelDao.create({
        ...TEST_CREATE_MODEL_PARAMS,
        profileId,
        status: ModelStatus.QUEUED,
      });

      // This is the concurrency gate: the loser of a concurrent retry must not send a message.
      await expect(
        modelDao.transitionStatus(
          { modelId: created.modelId, profileId },
          { from: ModelStatus.WAITING_FOR_CAPACITY, to: ModelStatus.QUEUED },
        ),
      ).rejects.toMatchObject({ cause: { name: 'ConditionalCheckFailedException' } });
    });
  });
});
