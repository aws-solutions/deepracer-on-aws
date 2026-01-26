// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Logger } from '@aws-lambda-powertools/logger';
import { CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand } from '@aws-sdk/client-codebuild';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  CloudFormationCustomResourceEvent,
  CloudFormationCustomResourceResponse,
  CloudFormationCustomResourceUpdateEvent,
  CloudFormationCustomResourceDeleteEvent,
} from 'aws-lambda';

import { isCustomResourceEvent, isAPIGatewayEvent } from '../helpers/eventTypeGuards.js';

const PHYSICAL_RESOURCE_ID = 'ecr-image-downloader-trigger';

const logger = new Logger();
const codeBuildClient = new CodeBuildClient({});

// Type definitions for better type safety
type CustomResourceEventWithData = CloudFormationCustomResourceEvent & {
  Data?: {
    BuildId?: string;
    [key: string]: unknown;
  };
  ResourceProperties?: {
    BuildId?: string;
    [key: string]: unknown;
  };
  BuildId?: string;
};

interface IsCompleteResponse {
  IsComplete: boolean;
  Data?: {
    [key: string]: unknown;
  };
}

interface EcrDownloadResponse {
  message: string;
  buildId: string;
  buildStatus: string;
  projectName: string;
  additionalImages?: string[];
}

// Helper function to get PhysicalResourceId from CloudFormation event
const getPhysicalResourceId = (event: CloudFormationCustomResourceEvent): string => {
  // PhysicalResourceId only exists on Update and Delete events, not Create events
  if (event.RequestType === 'Create') {
    return PHYSICAL_RESOURCE_ID;
  }
  // For Update and Delete events, PhysicalResourceId should exist
  if (event.RequestType === 'Update' || event.RequestType === 'Delete') {
    return (
      (event as CloudFormationCustomResourceUpdateEvent | CloudFormationCustomResourceDeleteEvent).PhysicalResourceId ||
      PHYSICAL_RESOURCE_ID
    );
  }
  return PHYSICAL_RESOURCE_ID;
};

interface TriggerImageDownloadRequest {
  /**
   * Optional list of additional images to download
   * If not provided, will use the default images configured in the CodeBuild project
   */
  additionalImages?: string[];
}

// Main handler for onEvent calls (Create, Update, Delete)
export const onEventHandler = async (
  event: CloudFormationCustomResourceEvent,
): Promise<CloudFormationCustomResourceResponse> => {
  try {
    logger.info('Processing onEvent call', { event });

    // Only trigger on Create and Update events, not Delete
    if (event.RequestType === 'Delete') {
      logger.info('Skipping image download for Delete event');
      return {
        Status: 'SUCCESS',
        PhysicalResourceId: getPhysicalResourceId(event),
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: {
          Message: 'Delete event - no action taken',
        },
      };
    }

    const projectName = process.env.CODEBUILD_PROJECT_NAME;
    if (!projectName) {
      throw new Error('CODEBUILD_PROJECT_NAME environment variable is not set');
    }

    // Start the CodeBuild project
    const startBuildCommand = new StartBuildCommand({
      projectName,
    });

    const buildResult = await codeBuildClient.send(startBuildCommand);
    const buildId = buildResult.build?.id;

    if (!buildId) {
      throw new Error('Failed to start CodeBuild project - no build ID returned');
    }

    logger.info('CodeBuild project started successfully', {
      buildId,
      projectName,
    });

    // Return success with BuildId for isComplete to use
    return {
      Status: 'SUCCESS',
      PhysicalResourceId: getPhysicalResourceId(event),
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Data: {
        message: 'ECR image download triggered successfully',
        buildId,
        buildStatus: 'STARTED',
        projectName,
        BuildId: buildId, // This will be passed to isComplete handler
      },
    };
  } catch (error) {
    logger.error('Failed to process onEvent call', { error });
    return {
      Status: 'FAILED',
      PhysicalResourceId: getPhysicalResourceId(event),
      StackId: event.StackId,
      RequestId: event.RequestId,
      LogicalResourceId: event.LogicalResourceId,
      Reason: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const isCompleteHandler = async (event: CloudFormationCustomResourceEvent): Promise<IsCompleteResponse> => {
  try {
    logger.info('Checking build completion status', { event });

    // For Delete operations, we don't need to check any build status
    if (event.RequestType === 'Delete') {
      logger.info('Delete operation - marking as complete');
      return {
        IsComplete: true,
        Data: {
          Message: 'Delete operation completed',
        },
      };
    }

    // The Provider Framework passes the BuildId in the ResourceProperties or in the event data
    // Try multiple locations where BuildId might be stored
    let buildId: string | undefined;
    const eventWithData = event as CustomResourceEventWithData;

    // First, try to get BuildId from the event data (from previous onEvent response)
    if (eventWithData.Data?.BuildId) {
      buildId = eventWithData.Data.BuildId;
    }
    // If not found, try ResourceProperties (sometimes passed here)
    else if (eventWithData.ResourceProperties?.BuildId) {
      buildId = eventWithData.ResourceProperties.BuildId;
    }
    // Also check if it's in the root of the event
    else if (eventWithData.BuildId) {
      buildId = eventWithData.BuildId;
    }

    if (!buildId) {
      logger.warn('No BuildId found in event - this may indicate a failed onEvent call or rollback scenario', {
        eventData: eventWithData.Data,
        resourceProperties: eventWithData.ResourceProperties,
        eventKeys: Object.keys(event),
        requestType: event.RequestType,
      });

      // If there's no BuildId, we can't check build status, so we'll consider it complete
      // This handles cases where the onEvent handler failed and we're in a rollback scenario
      return {
        IsComplete: true,
        Data: {
          Message: 'No BuildId available - assuming operation complete (likely rollback scenario)',
        },
      };
    }

    logger.info('Found BuildId for status check', { buildId });

    const getBuildCommand = new BatchGetBuildsCommand({
      ids: [buildId],
    });

    const buildDetails = await codeBuildClient.send(getBuildCommand);
    const build = buildDetails.builds?.[0];

    if (!build) {
      throw new Error(`Build ${buildId} not found`);
    }

    const buildStatus = build.buildStatus;
    logger.info('Build status check', { buildId, buildStatus });

    if (['SUCCEEDED', 'FAILED', 'FAULT', 'STOPPED', 'TIMED_OUT'].includes(buildStatus || '')) {
      // Build completed - check if it was successful
      if (buildStatus === 'SUCCEEDED') {
        logger.info('CodeBuild completed successfully', { buildId });
        return {
          IsComplete: true,
          Data: {
            Message: 'ECR image download completed successfully',
            BuildId: buildId,
            BuildStatus: buildStatus,
          },
        };
      } else {
        // Build failed - throw error to trigger CloudFormation rollback
        const errorMessage = `CodeBuild failed with status: ${buildStatus}. Check CloudWatch logs: ${build.logs?.cloudWatchLogs?.groupName || 'N/A'}`;
        logger.error('CodeBuild failed', {
          buildId,
          buildStatus,
          buildLogs: build.logs?.cloudWatchLogs?.groupName,
          errorMessage,
        });
        throw new Error(errorMessage);
      }
    } else {
      // Build still in progress
      logger.info('Build still in progress', { buildId, buildStatus });
      return {
        IsComplete: false,
        // Note: Data is not allowed when IsComplete is false
      };
    }
  } catch (error) {
    logger.error('Failed to check build completion', { error });
    throw error; // Re-throw to trigger CloudFormation failure
  }
};

// Helper function to parse request body safely
const parseRequestBody = (body: string | null): TriggerImageDownloadRequest => {
  if (!body) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    logger.error('Failed to parse request body', { error, body });
    throw new Error('Invalid JSON in request body');
  }
};

// Helper function to start CodeBuild project
const startCodeBuildProject = async (
  projectName: string,
  additionalImages: string[] = [],
): Promise<{ buildId: string; projectName: string }> => {
  const environmentVariablesOverride =
    additionalImages.length > 0
      ? [
          {
            name: 'ADDITIONAL_PUBLIC_ECR_IMAGES',
            value: additionalImages.join(','),
          },
        ]
      : undefined;

  const startBuildCommand = new StartBuildCommand({
    projectName,
    environmentVariablesOverride,
  });

  const buildResult = await codeBuildClient.send(startBuildCommand);
  const buildId = buildResult.build?.id;

  if (!buildId) {
    throw new Error('Failed to start CodeBuild project - no build ID returned');
  }

  logger.info('CodeBuild project started successfully', {
    buildId,
    projectName,
    additionalImages: additionalImages.length > 0 ? additionalImages : 'none',
  });

  return { buildId, projectName };
};

// Helper function to create API Gateway response
const createApiGatewayResponse = (statusCode: number, data: object): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(data),
});

// Helper function to handle API Gateway events
const handleApiGatewayEvent = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const projectName = process.env.CODEBUILD_PROJECT_NAME;
  if (!projectName) {
    throw new Error('CODEBUILD_PROJECT_NAME environment variable is not set');
  }

  try {
    const requestBody = parseRequestBody(event.body);
    const { additionalImages = [] } = requestBody;

    const { buildId } = await startCodeBuildProject(projectName, additionalImages);

    const responseData = {
      message: 'ECR image download triggered successfully',
      buildId,
      buildStatus: 'STARTED',
      projectName,
      additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
    };

    return createApiGatewayResponse(200, responseData);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return createApiGatewayResponse(500, {
      message: 'Failed to trigger ECR image download',
      error: errorMessage,
    });
  }
};

// Helper function to handle direct Lambda invocation
const handleDirectInvocation = async (event: TriggerImageDownloadRequest): Promise<EcrDownloadResponse> => {
  const projectName = process.env.CODEBUILD_PROJECT_NAME;
  if (!projectName) {
    throw new Error('CODEBUILD_PROJECT_NAME environment variable is not set');
  }

  const { additionalImages = [] } = event;
  const { buildId } = await startCodeBuildProject(projectName, additionalImages);

  return {
    message: 'ECR image download triggered successfully',
    buildId,
    buildStatus: 'STARTED',
    projectName,
    additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
  };
};

// Legacy handler for backward compatibility and API Gateway calls
export const lambdaHandler = async (
  event: APIGatewayProxyEvent | CloudFormationCustomResourceEvent,
): Promise<APIGatewayProxyResult | CloudFormationCustomResourceResponse | IsCompleteResponse | EcrDownloadResponse> => {
  try {
    logger.info('Processing ECR image download request', { event });

    // For CloudFormation events, delegate to onEventHandler
    if (isCustomResourceEvent(event)) {
      return await onEventHandler(event);
    }

    // Handle API Gateway events (manual trigger)
    if (isAPIGatewayEvent(event)) {
      return await handleApiGatewayEvent(event);
    }

    // Direct Lambda invocation
    return await handleDirectInvocation(event as TriggerImageDownloadRequest);
  } catch (error) {
    logger.error('Failed to process ECR image download request', { error });
    throw error;
  }
};
