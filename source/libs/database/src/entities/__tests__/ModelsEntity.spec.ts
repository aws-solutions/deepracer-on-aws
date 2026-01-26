// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { getDbKeyRegex, RESOURCE_ID_REGEX } from '../../constants/regex.js';
import { ResourceType } from '../../constants/resourceTypes.js';
import { TEST_CREATE_MODEL_PARAMS, TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { generateResourceId } from '../../utils/resourceUtils.js';
import { s3PathHelper } from '../../utils/S3PathHelper.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { ModelItem, ModelsEntity } from '../ModelsEntity.js';

describe('ModelsEntity', () => {
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
  });
});
