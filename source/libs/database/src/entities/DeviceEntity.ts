// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CarType, DeviceStatus, DeviceType } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import { DynamoDBItemAttribute, METADATA_ATTRIBUTES } from '../constants/itemAttributes.js';
import { DEVICE_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';

/**
 * A physical Race Manager device (a DeepRacer car or a Raspberry Pi timer).
 *
 */
export const DeviceEntity = new Entity(
  {
    model: {
      entity: ResourceType.DEVICE,
      version: '1',
      service: ResourceType.DEVICES,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.INSTANCE_ID]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.NAME]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.DEVICE_TYPE]: {
        type: Object.values(DeviceType),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.CAR_TYPE]: {
        // Only meaningful for CAR devices; timers leave this unset.
        type: Object.values(CarType),
      },
      [DynamoDBItemAttribute.FLEET_ID]: {
        // Nullable — a device may be unassigned.
        type: CustomAttributeType<ResourceId>('string'),
      },
      [DynamoDBItemAttribute.STATUS]: {
        type: Object.values(DeviceStatus),
        required: true,
      },
      [DynamoDBItemAttribute.ACTIVATED_AT]: {
        type: 'string',
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.LAST_SEEN_AT]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.IP_ADDRESS]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.TTL]: {
        type: 'number',
      },
      [DynamoDBItemAttribute.LAST_COMMAND_ID]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.LAST_COMMAND_STATUS]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.LAST_COMMAND_AT]: {
        type: 'string',
      },
      [DynamoDBItemAttribute.METADATA]: {
        type: 'map',
        properties: {
          [DynamoDBItemAttribute.SSID]: {
            type: 'string',
          },
          [DynamoDBItemAttribute.GPIO_PINS]: {
            type: 'list',
            items: { type: 'number' },
          },
        },
      },
    },
    indexes: {
      byInstanceId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.INSTANCE_ID],
          template: DEVICE_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [DynamoDBItemAttribute.INSTANCE_ID],
          template: DEVICE_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      byDeviceType: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [DynamoDBItemAttribute.DEVICE_TYPE],
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI1_SK,
          composite: [DynamoDBItemAttribute.ACTIVATED_AT],
          casing: 'none',
        },
      },
      byFleetId: {
        index: GlobalSecondaryIndex.GSI2,
        pk: {
          field: DynamoDBItemAttribute.GSI2_PK,
          composite: [DynamoDBItemAttribute.FLEET_ID],
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI2_SK,
          composite: [DynamoDBItemAttribute.NAME],
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

export type DeviceEntity = typeof DeviceEntity;
export type DeviceItem = EntityItem<DeviceEntity>;
