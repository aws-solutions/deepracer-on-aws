// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '../constants/itemAttributes.js';
import { EVENT_KEY_TEMPLATE, FLEET_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

/**
 * Join record assigning a fleet to an event (many-to-many).
 *
 */
export const FleetEventEntity = new Entity(
  {
    model: {
      entity: ResourceType.FLEET_EVENT,
      version: '1',
      service: ResourceType.FLEETS,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.EVENT_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.FLEET_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.ASSIGNED_AT]: {
        type: 'string',
        default: () => new Date().toISOString(),
        readOnly: true,
        required: true,
      },
    },
    indexes: {
      byEventId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.EVENT_ID],
          template: EVENT_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.FLEET_ID],
          template: FLEET_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      byFleetId: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [DynamoDBItemAttribute.FLEET_ID],
          template: FLEET_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI1_SK,
          composite: [DynamoDBItemAttribute.EVENT_ID],
          template: EVENT_KEY_TEMPLATE,
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

export type FleetEventEntity = typeof FleetEventEntity;
export type FleetEventItem = EntityItem<FleetEventEntity>;
