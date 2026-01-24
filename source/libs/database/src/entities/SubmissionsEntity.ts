// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { GlobalSecondaryIndex } from '../constants/indexes.js';
import {
  METADATA_ATTRIBUTES,
  DynamoDBItemAttribute,
  RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE,
  getWorkflowJobAttributes,
  getSubmissionAndRankingSharedAttributes,
} from '../constants/itemAttributes.js';
import { JobType } from '../constants/jobType.js';
import {
  CREATED_AT_KEY_TEMPLATE,
  PROFILE_KEY_TEMPLATE,
  SUBMISSION_GSI1_KEY_TEMPLATE,
  SUBMISSION_KEY_TEMPLATE,
} from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { JobName } from '../types/jobName.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { jobNameHelper } from '../utils/JobNameHelper.js';

export const SubmissionsEntity = new Entity(
  {
    model: {
      entity: ResourceType.SUBMISSION,
      version: '1',
      service: ResourceType.LEADERBOARD,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      ...getWorkflowJobAttributes(false),
      ...getSubmissionAndRankingSharedAttributes(false),
      [DynamoDBItemAttribute.NAME]: {
        type: CustomAttributeType<JobName<JobType.SUBMISSION>>('string'),
        required: true,
        readOnly: true,
        default: '',
        set: (_: string, { submissionId }: { submissionId: ResourceId }) =>
          jobNameHelper.getJobName(JobType.SUBMISSION, submissionId),
      },
      [DynamoDBItemAttribute.RESETTING_BEHAVIOR_CONFIG]: RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE,
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
          composite: [DynamoDBItemAttribute.LEADERBOARD_ID, DynamoDBItemAttribute.SUBMISSION_ID],
          template: SUBMISSION_KEY_TEMPLATE,
          casing: 'none',
        },
      },
      sortedByCreatedAt: {
        index: GlobalSecondaryIndex.GSI1,
        pk: {
          field: DynamoDBItemAttribute.GSI1_PK,
          composite: [DynamoDBItemAttribute.PROFILE_ID, DynamoDBItemAttribute.LEADERBOARD_ID],
          template: SUBMISSION_GSI1_KEY_TEMPLATE,
          casing: 'none',
        },
        sk: {
          field: DynamoDBItemAttribute.GSI1_SK,
          composite: [DynamoDBItemAttribute.CREATED_AT],
          template: CREATED_AT_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type SubmissionsEntity = typeof SubmissionsEntity;
export type SubmissionItem = EntityItem<SubmissionsEntity>;
