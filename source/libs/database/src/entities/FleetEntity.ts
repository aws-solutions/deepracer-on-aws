// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '../constants/itemAttributes.js';
import { FLEET_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';

/**
 * A fleet groups devices together and is the unit assigned to events.
 *
 */
export const FleetEntity = new Entity(
  {
    model: {
      entity: ResourceType.FLEET,
      version: '1',
      service: ResourceType.FLEETS,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.FLEET_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.NAME]: {
        type: 'string',
        required: true,
      },
    },
    indexes: {
      byFleetId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.FLEET_ID],
          template: FLEET_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.FLEET_ID],
          template: FLEET_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  {
    client: dynamoDBClient,
    table: deepRacerIndyAppConfig.dynamoDB.tableName,
  },
);

export type FleetEntity = typeof FleetEntity;
export type FleetItem = EntityItem<FleetEntity>;
