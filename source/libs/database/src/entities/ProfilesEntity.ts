// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute, AVATAR_ATTRIBUTE } from '../constants/itemAttributes.js';
import { PROFILE_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

export const ProfilesEntity = new Entity(
  {
    model: {
      entity: ResourceType.PROFILE,
      version: '1',
      service: ResourceType.PROFILES,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.ALIAS]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.EMAIL_ADDRESS]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        required: true,
        readOnly: true,
      },
      [DynamoDBItemAttribute.ROLE_NAME]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.AVATAR]: AVATAR_ATTRIBUTE,
      [DynamoDBItemAttribute.COMPUTE_MINUTES_USED]: {
        type: 'number',
        default: 0,
      },
      [DynamoDBItemAttribute.COMPUTE_MINUTES_QUEUED]: {
        type: 'number',
        default: 0,
      },
      [DynamoDBItemAttribute.MAX_TOTAL_COMPUTE_MINUTES]: {
        type: 'number',
      },
      [DynamoDBItemAttribute.MAX_MODEL_COUNT]: {
        type: 'number',
      },
      [DynamoDBItemAttribute.MODEL_STORAGE_USAGE]: {
        type: 'number',
      },
      [DynamoDBItemAttribute.MODEL_COUNT]: {
        type: 'number',
      },
      [DynamoDBItemAttribute.CREATED_AT]: {
        type: 'string',
      },
    },
    indexes: {
      byProfileId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.PROFILE_ID],
          template: PROFILE_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [],
          template: ResourceType.PROFILE,
          casing: 'none',
        },
      },
      bySortKey: {
        index: 'sk-index',
        pk: {
          field: DynamoDBItemAttribute.SK,
          composite: [],
          template: ResourceType.PROFILE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type ProfilesEntity = typeof ProfilesEntity;
export type ProfileItem = EntityItem<ProfilesEntity>;
