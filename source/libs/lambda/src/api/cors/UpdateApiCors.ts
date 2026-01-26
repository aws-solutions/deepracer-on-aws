// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetRestApiCommand,
  GetResourcesCommand,
  GetIntegrationResponseCommand,
  PutIntegrationResponseCommand,
  CreateDeploymentCommand,
} from '@aws-sdk/client-api-gateway';
import { logger } from '@deepracer-indy/utils';
import { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda/trigger/cdk-custom-resource';

import { apiGatewayClient } from '../../utils/clients/apiGatewayClient.js';

interface UpdateCorsProperties {
  apiId: string;
  allowedOrigin: string;
}

export async function lambdaHandler(event: CdkCustomResourceEvent): Promise<CdkCustomResourceResponse> {
  logger.info('UpdateApiCors handler invoked', { event });

  const { RequestType, ResourceProperties } = event;
  const { apiId, allowedOrigin } = ResourceProperties as unknown as UpdateCorsProperties;

  if (RequestType === 'Delete') {
    logger.info('Delete request - no action needed');
    return {
      Status: 'SUCCESS',
      PhysicalResourceId: 'update-cors-' + apiId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    };
  }

  try {
    logger.info(`Updating CORS for API ${apiId} with origin ${allowedOrigin}`);

    // Get the current API definition to verify it exists
    const getCommand = new GetRestApiCommand({ restApiId: apiId });
    const apiResponse = await apiGatewayClient.send(getCommand);

    logger.debug('API found', { apiId: apiResponse.id, name: apiResponse.name });

    const getResourcesCommand = new GetResourcesCommand({ restApiId: apiId });
    const resourcesResponse = await apiGatewayClient.send(getResourcesCommand);

    if (!resourcesResponse.items) {
      throw new Error('No resources found in API');
    }

    logger.debug('Found API resources', { resourceCount: resourcesResponse.items.length });

    let updatedCount = 0;

    for (const resource of resourcesResponse.items) {
      if (!resource.id) continue;

      const resourceMethods = resource.resourceMethods || {};
      logger.debug(`Checking resource ${resource.pathPart || 'root'}`, {
        resourceId: resource.id,
        path: resource.path,
        methods: Object.keys(resourceMethods),
      });

      if ('OPTIONS' in resourceMethods) {
        logger.debug(`Found OPTIONS method for resource ${resource.path}`, { resourceId: resource.id });

        try {
          const getCurrentResponse = await apiGatewayClient.send(
            new GetIntegrationResponseCommand({
              restApiId: apiId,
              resourceId: resource.id,
              httpMethod: 'OPTIONS',
              statusCode: '200',
            }),
          );

          const existingResponseParameters = getCurrentResponse.responseParameters || {};
          const currentOrigin = existingResponseParameters['method.response.header.Access-Control-Allow-Origin'];
          const newOrigin = `'${allowedOrigin}'`;

          if (currentOrigin === newOrigin) {
            logger.debug(`CORS origin already set to ${allowedOrigin} for resource ${resource.path}`, {
              resourceId: resource.id,
              currentOrigin,
            });
            continue;
          }

          const updatedResponseParameters = {
            ...existingResponseParameters,
            'method.response.header.Access-Control-Allow-Origin': newOrigin,
          };

          const response = await apiGatewayClient.send(
            new PutIntegrationResponseCommand({
              restApiId: apiId,
              resourceId: resource.id,
              httpMethod: 'OPTIONS',
              statusCode: '200',
              responseParameters: updatedResponseParameters,
              responseTemplates: getCurrentResponse.responseTemplates,
            }),
          );

          logger.debug(`Updated CORS for resource ${resource.path}`, {
            resourceId: resource.id,
            previousOrigin: currentOrigin,
            newOrigin: allowedOrigin,
            response,
          });
          updatedCount++;
        } catch (error) {
          logger.warn(`Failed to update CORS for resource ${resource.path}`, {
            resourceId: resource.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    if (updatedCount > 0) {
      logger.info(`Updated ${updatedCount} CORS configurations`);
      logger.info('Deploying API to apply CORS changes');
      await apiGatewayClient.send(
        new CreateDeploymentCommand({
          restApiId: apiId,
          stageName: 'prod',
          description: `CORS update deployment - Updated ${updatedCount} resources`,
        }),
      );
      logger.info('Successfully updated API Gateway');
    } else {
      logger.info('No CORS Updates needed');
    }

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: 'update-cors-' + apiId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        success: true,
        updatedCount,
        apiId,
        allowedOrigin,
      },
    };
  } catch (error) {
    logger.error('Error updating CORS', { error });

    return {
      Status: 'FAILED',
      Reason: error instanceof Error ? error.message : 'Unknown error occurred',
      PhysicalResourceId: 'update-cors-' + apiId,
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
    };
  }
}
