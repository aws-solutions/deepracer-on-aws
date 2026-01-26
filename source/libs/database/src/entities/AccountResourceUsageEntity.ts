// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { ACCOUNT_RESOURCE_USAGE_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

export const AccountResourceUsageEntity = new Entity(
  {
    model: {
      entity: ResourceType.ACCOUNT_RESOURCE_USAGE,
      version: '1',
      service: ResourceType.ACCOUNT_RESOURCE_USAGE,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_YEAR]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_MONTH]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.ACCOUNT_RESOURCE_COMPUTE_MINUTES_USED]: {
        type: 'number',
        required: true,
      },
      [DynamoDBItemAttribute.ACCOUNT_RESOURCE_COMPUTE_MINUTES_QUEUED]: {
        type: 'number',
        required: true,
      },
    },
    indexes: {
      byYearMonth: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [
            DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_YEAR,
            DynamoDBItemAttribute.ACCOUNT_RESOURCE_USAGE_MONTH,
          ],
          template: ACCOUNT_RESOURCE_USAGE_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [],
          template: ResourceType.ACCOUNT_RESOURCE_USAGE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type AccountResourceUsageEntity = typeof AccountResourceUsageEntity;
export type AccountResourceUsageItem = EntityItem<AccountResourceUsageEntity>;
