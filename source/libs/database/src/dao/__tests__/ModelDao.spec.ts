// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from 'node:crypto';

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
});
