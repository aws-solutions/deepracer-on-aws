// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@deepracer-indy/utils';
import {
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from 'aws-lambda';

import { instrumentHandler } from '#utils/instrumentation/instrumentHandler.js';

const cloudFrontClient = new CloudFrontClient({});

const getPhysicalResourceId = (event: CloudFormationCustomResourceEvent, namespace?: string): string => {
  const baseId = 'website-env-file-creator';

  if (event.RequestType === 'Create') {
    return namespace ? `${baseId}-${namespace}` : baseId;
  }

  if (event.RequestType === 'Update' || event.RequestType === 'Delete') {
    return (
      (event as CloudFormationCustomResourceUpdateEvent | CloudFormationCustomResourceDeleteEvent).PhysicalResourceId ||
      (namespace ? `${baseId}-${namespace}` : baseId)
    );
  }

  return namespace ? `${baseId}-${namespace}` : baseId;
};

export const CreateWebsiteEnvFile = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  const { RequestType, ResourceProperties } = event;
  const {
    bucketName,
    fileName = 'env.js',
    fileContent = 'window.EnvironmentConfig = {};',
    namespace,
    distributionId,
  } = ResourceProperties;

  const physicalResourceId = getPhysicalResourceId(event, namespace as string | undefined);

  try {
    console.log('Processing custom resource request', {
      requestType: RequestType,
      physicalResourceId,
      namespace: namespace || 'default',
      bucketName,
      fileName,
      stackId: event.StackId,
      logicalResourceId: event.LogicalResourceId,
    });

    if (RequestType === 'Delete') {
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: physicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: {
          Message: 'Delete event received; no cleanup needed',
        },
      };
    }

    if (!bucketName) {
      throw new Error('bucketName is required in ResourceProperties');
    }

    const putObjectCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
      ContentType: 'application/javascript',
    });

    await s3Client.send(putObjectCommand);

    console.log('Successfully created env file', {
      bucketName,
      fileName,
      physicalResourceId,
      namespace: namespace || 'default',
    });

    if (distributionId) {
      try {
        const invalidationPath = `/${fileName}`;
        const invalidationCommand = new CreateInvalidationCommand({
          DistributionId: distributionId as string,
          InvalidationBatch: {
            Paths: {
              Quantity: 1,
              Items: [invalidationPath],
            },
            CallerReference: `${physicalResourceId}-${Date.now()}`,
          },
        });

        const invalidationResponse = await cloudFrontClient.send(invalidationCommand);
        console.log('Successfully created CloudFront invalidation', {
          distributionId,
          invalidationPath,
          invalidationId: invalidationResponse.Invalidation?.Id,
        });
      } catch (invalidationError) {
        console.warn('Failed to invalidate CloudFront cache, but continuing', {
          distributionId,
          fileName,
          error: invalidationError,
        });
      }
    }

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        bucketName,
        fileName,
        message: 'Successfully created env file',
      },
    };
  } catch (error) {
    console.error('Failed to create env file', {
      error,
      physicalResourceId,
      namespace: namespace || 'default',
    });

    return {
      Status: 'FAILED',
      PhysicalResourceId: physicalResourceId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Reason: 'Failed to create env file',
    };
  }
};

export const lambdaHandler = instrumentHandler(CreateWebsiteEnvFile);
