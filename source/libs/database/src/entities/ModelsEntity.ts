// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deepRacerIndyAppConfig } from '@deepracer-indy/config';
import { ModelMetadata, ModelStatus, CarCustomization } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, Entity, EntityItem } from 'electrodb';

import { METADATA_ATTRIBUTES, DynamoDBItemAttribute } from '../constants/itemAttributes.js';
import { PROFILE_KEY_TEMPLATE, MODEL_KEY_TEMPLATE } from '../constants/keyTemplates.js';
import { ResourceType } from '../constants/resourceTypes.js';
import type { ResourceId } from '../types/resource.js';
import { dynamoDBClient } from '../utils/dynamoDBClient.js';
import { generateResourceId } from '../utils/resourceUtils.js';
import { s3PathHelper } from '../utils/S3PathHelper.js';

export const ModelsEntity = new Entity(
  {
    model: {
      entity: ResourceType.MODEL,
      version: '1',
      service: ResourceType.MODEL,
    },
    attributes: {
      ...METADATA_ATTRIBUTES,
      [DynamoDBItemAttribute.ASSET_S3_LOCATIONS]: {
        type: 'map',
        readOnly: true,
        required: true,
        default: {
          [DynamoDBItemAttribute.MODEL_METADATA_S3_LOCATION]: '',
          [DynamoDBItemAttribute.MODEL_ROOT_S3_LOCATION]: '',
          [DynamoDBItemAttribute.REWARD_FUNCTION_S3_LOCATION]: '',
          [DynamoDBItemAttribute.SAGEMAKER_ARTIFACTS_S3_LOCATION]: '',
        },
        set: (_, { modelId, profileId }) => ({
          [DynamoDBItemAttribute.MODEL_METADATA_S3_LOCATION]: s3PathHelper.getModelMetadataS3Location(
            modelId,
            profileId,
          ),
          [DynamoDBItemAttribute.MODEL_ROOT_S3_LOCATION]: s3PathHelper.getModelRootS3Location(modelId, profileId),
          [DynamoDBItemAttribute.REWARD_FUNCTION_S3_LOCATION]: s3PathHelper.getRewardFunctionS3Location(
            modelId,
            profileId,
          ),
          [DynamoDBItemAttribute.SAGEMAKER_ARTIFACTS_S3_LOCATION]: s3PathHelper.getSageMakerArtifactsS3Location(
            modelId,
            profileId,
          ),
        }),
        properties: {
          [DynamoDBItemAttribute.MODEL_ARTIFACT_S3_LOCATION]: {
            type: 'string',
          },
          [DynamoDBItemAttribute.MODEL_METADATA_S3_LOCATION]: {
            type: 'string',
            readOnly: true,
            required: true,
          },
          [DynamoDBItemAttribute.MODEL_ROOT_S3_LOCATION]: {
            type: 'string',
            readOnly: true,
            required: true,
          },
          [DynamoDBItemAttribute.REWARD_FUNCTION_S3_LOCATION]: {
            type: 'string',
            readOnly: true,
            required: true,
          },
          [DynamoDBItemAttribute.SAGEMAKER_ARTIFACTS_S3_LOCATION]: {
            type: 'string',
            readOnly: true,
            required: true,
          },
          [DynamoDBItemAttribute.VIRTUAL_MODEL_ARTIFACT_S3_LOCATION]: {
            type: 'string',
            required: false,
          },
        },
      },
      [DynamoDBItemAttribute.MODEL_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        default: () => generateResourceId(),
        readOnly: true,
        required: true,
      },
      [DynamoDBItemAttribute.PROFILE_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        required: true,
        readOnly: true,
      },
      [DynamoDBItemAttribute.CLONED_FROM_MODEL_ID]: {
        type: CustomAttributeType<ResourceId>('string'),
        readOnly: true,
      },
      [DynamoDBItemAttribute.CAR_CUSTOMIZATION]: {
        type: CustomAttributeType<CarCustomization>('any'),
        required: true,
      },
      [DynamoDBItemAttribute.METADATA]: {
        type: CustomAttributeType<ModelMetadata>('any'),
        required: true,
      },
      [DynamoDBItemAttribute.DESCRIPTION]: {
        type: 'string',
        required: true,
        default: '',
      },
      [DynamoDBItemAttribute.FILE_SIZE_IN_BYTES]: {
        type: 'number',
        default: 0,
        required: true,
      },
      [DynamoDBItemAttribute.NAME]: {
        type: 'string',
        required: true,
      },
      [DynamoDBItemAttribute.STATUS]: {
        type: Object.values(ModelStatus),
        required: true,
      },
      [DynamoDBItemAttribute.PACKAGING_STATUS]: {
        type: Object.values(ModelStatus),
        required: false,
      },
      [DynamoDBItemAttribute.PACKAGING_ERROR_REQUEST_ID]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.PACKAGED_AT]: {
        type: 'string',
        required: false,
      },
      [DynamoDBItemAttribute.IMPORT_ERROR_MESSAGE]: {
        type: 'string',
        required: false,
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
          composite: [DynamoDBItemAttribute.MODEL_ID],
          template: MODEL_KEY_TEMPLATE,
          casing: 'none',
        },
      },
    },
  },
  { client: dynamoDBClient, table: deepRacerIndyAppConfig.dynamoDB.tableName },
);

export type ModelsEntity = typeof ModelsEntity;
export type ModelItem = EntityItem<ModelsEntity>;
