// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus, ModelSource, OptimizationStatus } from '@deepracer-indy/typescript-server-client';

import { getDbKeyRegex, RESOURCE_ID_REGEX } from '../../constants/regex.js';
import { ResourceType } from '../../constants/resourceTypes.js';
import { TEST_CREATE_MODEL_PARAMS, TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { s3PathHelper } from '../../utils/S3PathHelper.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { ModelItem, ModelsEntity } from '../ModelsEntity.js';

describe('ModelsEntity', () => {
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

  describe('create()', () => {
    it('should create items with the correct properties and defaults', async () => {
      const modelName = 'testName1';
      const profileId = generateResourceId();

      await ModelsEntity.create({ ...TEST_CREATE_MODEL_PARAMS, name: modelName, profileId }).go();

      const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

      const modelItem = Items?.[0] as ModelItem;

      expect(modelItem).toEqual({
        ...TEST_CREATE_MODEL_PARAMS,
        assetS3Locations: {
          modelMetadataS3Location: s3PathHelper.getModelMetadataS3Location(modelItem.modelId, modelItem.profileId),
          modelRootS3Location: s3PathHelper.getModelRootS3Location(modelItem.modelId, modelItem.profileId),
          rewardFunctionS3Location: s3PathHelper.getRewardFunctionS3Location(modelItem.modelId, modelItem.profileId),
          sageMakerArtifactsS3Location: s3PathHelper.getSageMakerArtifactsS3Location(
            modelItem.modelId,
            modelItem.profileId,
          ),
        },
        metadata: TEST_CREATE_MODEL_PARAMS.metadata,
        name: modelName,
        modelId: expect.stringMatching(RESOURCE_ID_REGEX),
        profileId,
        fileSizeInBytes: 0,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        pk: expect.stringMatching(getDbKeyRegex(ResourceType.PROFILE)),
        sk: expect.stringMatching(getDbKeyRegex(ResourceType.MODEL)),
        version: 1,
        __edb_e__: ResourceType.MODEL,
        __edb_v__: '1',
      });
    });

    it('should create a model with optimizationStatus, modelSource, and optimizedArtifactsS3Prefix', async () => {
      const profileId = generateResourceId();

      const { data: created } = await ModelsEntity.create({
        ...TEST_CREATE_MODEL_PARAMS,
        name: 'Physical Import Model',
        profileId,
        optimizationStatus: OptimizationStatus.OPTIMIZED,
        modelSource: ModelSource.IMPORTED_PHYSICAL,
        optimizedArtifactsS3Prefix: `${profileId}/models/test-model/optimized/`,
      }).go();

      expect(created.optimizationStatus).toBe(OptimizationStatus.OPTIMIZED);
      expect(created.modelSource).toBe(ModelSource.IMPORTED_PHYSICAL);
      expect(created.optimizedArtifactsS3Prefix).toBe(`${profileId}/models/test-model/optimized/`);
    });

    it('should allow creating a model without optimization attributes (backward compatible)', async () => {
      const profileId = generateResourceId();

      const { data: created } = await ModelsEntity.create({
        ...TEST_CREATE_MODEL_PARAMS,
        name: 'Legacy Model',
        profileId,
      }).go();

      expect(created.optimizationStatus).toBeUndefined();
      expect(created.modelSource).toBeUndefined();
      expect(created.optimizedArtifactsS3Prefix).toBeUndefined();
    });
  });

  describe('patch() — optimization attributes', () => {
    it('should update optimizationStatus from undefined to IN_PROGRESS', async () => {
      const profileId = generateResourceId();
      const { data: created } = await ModelsEntity.create({
        ...TEST_CREATE_MODEL_PARAMS,
        name: 'Optimizing Model',
        profileId,
      }).go();

      const { data: patched } = await ModelsEntity.patch({ profileId, modelId: created.modelId })
        .set({ optimizationStatus: OptimizationStatus.IN_PROGRESS })
        .go({ response: 'all_new' });

      expect(patched.optimizationStatus).toBe(OptimizationStatus.IN_PROGRESS);
      expect(patched.status).toBe(ModelStatus.QUEUED); // model status unchanged
    });

    it('should update optimizationStatus to FAILED without affecting model status', async () => {
      const profileId = generateResourceId();
      const { data: created } = await ModelsEntity.create({
        ...TEST_CREATE_MODEL_PARAMS,
        name: 'Failed Opt Model',
        profileId,
        status: ModelStatus.READY,
        optimizationStatus: OptimizationStatus.IN_PROGRESS,
      }).go();

      const { data: patched } = await ModelsEntity.patch({ profileId, modelId: created.modelId })
        .set({ optimizationStatus: OptimizationStatus.FAILED })
        .go({ response: 'all_new' });

      expect(patched.optimizationStatus).toBe(OptimizationStatus.FAILED);
      expect(patched.status).toBe(ModelStatus.READY); // model status REMAINS READY on optimization failure
    });
  });
});
