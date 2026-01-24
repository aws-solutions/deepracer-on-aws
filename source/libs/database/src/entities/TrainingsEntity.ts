// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute, getWorkflowJobAttributes } from '../constants/itemAttributes.js';
import { JobType } from '../constants/jobType.js';
import { MODEL_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { JobName } from '../types/jobName.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { jobNameHelper } from '../utils/JobNameHelper.js';

export const TrainingsEntity = new Entity(
  {
    model: {
      entity: ResourceType.TRAINING,
      version: '1',
      service: ResourceType.MODEL,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      ...getWorkflowJobAttributes(true),
      [DynamoDBItemAttribute.NAME]: {
        type: CustomAttributeType<JobName<JobType.TRAINING>>('string'),
        required: true,
        readOnly: true,
        default: '',
        set: (_: string, { modelId }: { modelId: ResourceId }) => jobNameHelper.getJobName(JobType.TRAINING, modelId),
      },
    },
    indexes: {
      byModelId: {
        pk: {
          field: DynamoDBItemAttribute.PK,
          composite: [DynamoDBItemAttribute.MODEL_ID],
          template: MODEL_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.SK,
          composite: [],
          template: ResourceType.TRAINING,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type TrainingsEntity = typeof TrainingsEntity;
export type TrainingItem = EntityItem<TrainingsEntity>;
