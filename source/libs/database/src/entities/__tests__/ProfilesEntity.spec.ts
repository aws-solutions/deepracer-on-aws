// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DEFAULT_AVATAR } from '@deepracer-indy/config';

import { RESOURCE_ID_REGEX } from '../../constants/regex.js';
import { ResourceType } from '../../constants/resourceTypes.js';
import { TEST_TABLE_NAME } from '../../constants/testConstants.js';
import { testDynamoDBDocumentClient } from '../../utils/testUtils.js';
import { ProfilesEntity } from '../ProfilesEntity.js';

describe('ProfilesEntity', () => {
  beforeEach(async () => {
    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    if (Items && Items.length > 0) {
      await Promise.all(
        Items.map((item) =>
          testDynamoDBDocumentClient.delete({
            TableName: TEST_TABLE_NAME,
            Key: { pk: item.pk, sk: item.sk },
          }),
        ),
      );
    }
  });

  it('should create profile items with the correct properties and defaults', async () => {
    const testAliases = ['testAlias1', 'testAlias2', 'testAlias3'];

    await Promise.all(testAliases.map((alias) => ProfilesEntity.create({ alias }).go()));

    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

    for (const alias of testAliases) {
      const profileItem = Items?.find((item) => item.alias === alias);
      expect(profileItem).toBeDefined();
      expect(profileItem).toMatchObject({
        alias,
        avatar: DEFAULT_AVATAR,
        profileId: expect.stringMatching(RESOURCE_ID_REGEX),
        computeMinutesUsed: 0,
        computeMinutesQueued: 0,
        pk: expect.stringContaining(`${ResourceType.PROFILE}_`),
        sk: ResourceType.PROFILE,
        updatedAt: expect.any(String),
      });
    }
  });

  it('should create profile items with custom attributes', async () => {
    const now = new Date().toISOString();
    const profileData = {
      alias: 'customProfile',
      roleName: 'admin',
      maxTotalComputeMinutes: 120,
      maxModelCount: 5,
      modelStorageUsage: 10,
      modelCount: 2,
      createdAt: now,
    };

    await ProfilesEntity.create(profileData).go();

    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });

    expect(Items).toContainEqual(
      expect.objectContaining({
        alias: profileData.alias,
        roleName: profileData.roleName,
        maxTotalComputeMinutes: profileData.maxTotalComputeMinutes,
        maxModelCount: profileData.maxModelCount,
        modelStorageUsage: profileData.modelStorageUsage,
        modelCount: profileData.modelCount,
        createdAt: profileData.createdAt,
        avatar: DEFAULT_AVATAR,
        computeMinutesUsed: 0,
        computeMinutesQueued: 0,
      }),
    );
  });

  it('should update profile attributes', async () => {
    const createResult = await ProfilesEntity.create({ alias: 'updateTest' }).go();
    const profileId = createResult.data.profileId;

    const updatedValues = {
      roleName: 'developer',
      maxTotalComputeMinutes: 240,
      maxModelCount: 10,
      modelStorageUsage: 20,
      modelCount: 3,
      computeMinutesUsed: 30,
      computeMinutesQueued: 15,
    };

    await ProfilesEntity.update({ profileId }).set(updatedValues).go();

    const { Items } = await testDynamoDBDocumentClient.scan({ TableName: TEST_TABLE_NAME });
    const updatedProfile = Items?.find((item) => item.profileId === profileId);

    expect(updatedProfile).toEqual(
      expect.objectContaining({
        ...updatedValues,
        alias: 'updateTest',
        avatar: DEFAULT_AVATAR,
        profileId,
        pk: expect.stringContaining(`${ResourceType.PROFILE}_`),
        sk: ResourceType.PROFILE,
        updatedAt: expect.any(String),
      }),
    );
  });

  it('should retrieve profiles by profileId', async () => {
    const createResult = await ProfilesEntity.create({
      alias: 'retrieveTest',
      roleName: 'user',
      maxTotalComputeMinutes: 60,
    }).go();

    const profileId = createResult.data.profileId;

    const getResult = await ProfilesEntity.get({ profileId }).go();

    expect(getResult.data).toEqual(
      expect.objectContaining({
        alias: 'retrieveTest',
        roleName: 'user',
        maxTotalComputeMinutes: 60,
        avatar: DEFAULT_AVATAR,
        profileId,
        computeMinutesUsed: 0,
        computeMinutesQueued: 0,
        updatedAt: expect.any(String),
      }),
    );
  });
});
