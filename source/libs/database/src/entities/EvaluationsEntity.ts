// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { EpisodeStatus } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import {
  METADATA_ATTRIBUTES,
  DynamoDBItemAttribute,
  RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE,
  getWorkflowJobAttributes,
} from '../constants/itemAttributes.js';
import { JobType } from '../constants/jobType.js';
import { MODEL_KEY_TEMPLATE, EVALUATION_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import { JobName } from '../types/jobName.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { jobNameHelper } from '../utils/JobNameHelper.js';
import { generateResourceId } from '../utils/resourceUtils.js';

export const EvaluationsEntity = new Entity(
  {
    model: {
      entity: ResourceType.EVALUATION,
      version: '1',
      service: ResourceType.MODEL,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      ...getWorkflowJobAttributes(false),
      [DynamoDBItemAttribute.EVALUATION_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.EVALUATION_NAME]: {
        type: 'string',
        required: true,
        readOnly: true,
      },
      [DynamoDBItemAttribute.METRICS]: {
        type: 'list',
        items: {
          type: 'map',
          properties: {
            [DynamoDBItemAttribute.TRIAL]: {
              type: 'number',
              required: true,
            },
            [DynamoDBItemAttribute.ELAPSED_TIME_IN_MILLISECONDS]: {
              type: 'number',
              required: true,
            },
            [DynamoDBItemAttribute.COMPLETION_PERCENTAGE]: {
              type: 'number',
              required: true,
            },
            [DynamoDBItemAttribute.EPISODE_STATUS]: {
              type: Object.values(EpisodeStatus),
              required: true,
            },
            [DynamoDBItemAttribute.RESET_COUNT]: {
              type: 'number',
              required: true,
            },
            [DynamoDBItemAttribute.OFF_TRACK_COUNT]: {
              type: 'number',
              required: true,
            },
            [DynamoDBItemAttribute.CRASH_COUNT]: {
              type: 'number',
              required: true,
            },
          },
        },
      },
      [DynamoDBItemAttribute.NAME]: {
        type: CustomAttributeType<JobName<JobType.EVALUATION>>('string'),
        required: true,
        readOnly: true,
        default: '',
        set: (_: string, { evaluationId }: { evaluationId: ResourceId }) =>
          jobNameHelper.getJobName(JobType.EVALUATION, evaluationId),
      },
      [DynamoDBItemAttribute.RESETTING_BEHAVIOR_CONFIG]: RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE,
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
          composite: [DynamoDBItemAttribute.EVALUATION_ID],
          template: EVALUATION_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type EvaluationsEntity = typeof EvaluationsEntity;
export type EvaluationItem = EntityItem<EvaluationsEntity>;
