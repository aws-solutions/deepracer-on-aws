// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  APIGatewayClient,
  GetRestApiCommand,
  GetResourcesCommand,
  GetIntegrationResponseCommand,
  PutIntegrationResponseCommand,
  CreateDeploymentCommand,
} from '@aws-sdk/client-api-gateway';
import type { CdkCustomResourceEvent, CdkCustomResourceResponse } from 'aws-lambda/trigger/cdk-custom-resource';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('UpdateApiCors Lambda Handler', () => {
  const apiGatewayMock = mockClient(APIGatewayClient);
  let lambdaHandler: (event: CdkCustomResourceEvent) => Promise<CdkCustomResourceResponse>;

  beforeEach(async () => {
    vi.clearAllMocks();
    apiGatewayMock.reset();
    // Import after mocks are set up
    const module = await import('../UpdateApiCors.js');
    lambdaHandler = module.lambdaHandler;
  });

  const createMockEvent = (
    requestType: 'Create' | 'Update' | 'Delete' = 'Create',
    properties: Record<string, string> = {},
  ): CdkCustomResourceEvent => {
    const baseEvent = {
      RequestType: requestType,
      ResponseURL: 'https://example.com/response',
      StackId: 'arn:aws:cloudformation:us-east-1:123456789012:stack/test-stack/12345678',
      RequestId: 'test-request-id',
      LogicalResourceId: 'TestResource',
      ResourceType: 'Custom::UpdateApiCors',
      ServiceToken: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
      ResourceProperties: {
        ServiceToken: 'arn:aws:lambda:us-east-1:123456789012:function:test-function',
        apiId: 'test-api-id',
        allowedOrigin: 'https://example.com',
        ...properties,
      },
    };

    if (requestType === 'Delete') {
      return {
        ...baseEvent,
        PhysicalResourceId: 'update-cors-test-api-id',
      } as CdkCustomResourceEvent;
    }

    return baseEvent as CdkCustomResourceEvent;
  };

  describe('Delete requests', () => {
    it('should return success for delete requests without making API calls', async () => {
      const event = createMockEvent('Delete');
      const result = await lambdaHandler(event);

      expect(result.Status).toBe('SUCCESS');
      expect(result.PhysicalResourceId).toBe('update-cors-test-api-id');
      expect(apiGatewayMock.calls()).toHaveLength(0);
    });
  });

  describe('Create/Update requests', () => {
    const mockApiResponse = {
      id: 'test-api-id',
      name: 'Test API',
    };

    const mockResourcesResponse = {
      items: [
        {
          id: 'resource-1',
          path: '/test',
          pathPart: 'test',
          resourceMethods: {
            OPTIONS: {},
            GET: {},
          },
        },
      ],
    };

    const mockIntegrationResponse = {
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization'",
        'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
      },
      responseTemplates: {
        'application/json': '',
      },
    };

    it('should successfully update CORS headers for resources with OPTIONS method', async () => {
      apiGatewayMock.on(GetRestApiCommand).resolves(mockApiResponse);
      apiGatewayMock.on(GetResourcesCommand).resolves(mockResourcesResponse);
      apiGatewayMock.on(GetIntegrationResponseCommand).resolves(mockIntegrationResponse);
      apiGatewayMock.on(PutIntegrationResponseCommand).resolves({});
      apiGatewayMock.on(CreateDeploymentCommand).resolves({});

      const event = createMockEvent('Create');
      const result = await lambdaHandler(event);

      expect(result.Status).toBe('SUCCESS');
      expect(result.Data).toEqual({
        success: true,
        updatedCount: 1,
        apiId: 'test-api-id',
        allowedOrigin: 'https://example.com',
      });

      expect(apiGatewayMock.commandCalls(GetRestApiCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(GetResourcesCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(GetIntegrationResponseCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(PutIntegrationResponseCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(CreateDeploymentCommand)).toHaveLength(1);
    });

    it('should skip resources where origin is already set correctly', async () => {
      const mockIntegrationResponseWithCorrectOrigin = {
        responseParameters: {
          'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization'",
          'method.response.header.Access-Control-Allow-Methods': "'GET,POST,OPTIONS'",
          'method.response.header.Access-Control-Allow-Origin': "'https://example.com'",
        },
        responseTemplates: {
          'application/json': '',
        },
      };

      apiGatewayMock.on(GetRestApiCommand).resolves(mockApiResponse);
      apiGatewayMock.on(GetResourcesCommand).resolves(mockResourcesResponse);
      apiGatewayMock.on(GetIntegrationResponseCommand).resolves(mockIntegrationResponseWithCorrectOrigin);

      const event = createMockEvent('Create');
      const result = await lambdaHandler(event);

      expect(result.Status).toBe('SUCCESS');
      expect(result.Data?.updatedCount).toBe(0);

      // Should not call PutIntegrationResponse or deployment since origin is already correct
      expect(apiGatewayMock.commandCalls(GetRestApiCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(GetResourcesCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(GetIntegrationResponseCommand)).toHaveLength(1);
      expect(apiGatewayMock.commandCalls(PutIntegrationResponseCommand)).toHaveLength(0);
      expect(apiGatewayMock.commandCalls(CreateDeploymentCommand)).toHaveLength(0);
    });

    it('should handle API Gateway errors gracefully', async () => {
      apiGatewayMock.on(GetRestApiCommand).rejects(new Error('API not found'));

      const event = createMockEvent('Create');
      const result = await lambdaHandler(event);

      expect(result.Status).toBe('FAILED');
      expect(result.Reason).toBe('API not found');
    });
  });

  describe('Error handling', () => {
    it('should return proper error response format', async () => {
      apiGatewayMock.on(GetRestApiCommand).rejects(new Error('Test error'));

      const event = createMockEvent('Create');
      const result = await lambdaHandler(event);

      expect(result).toEqual({
        Status: 'FAILED',
        Reason: 'Test error',
        PhysicalResourceId: 'update-cors-test-api-id',
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
      });
    });

    it('should handle unknown errors', async () => {
      apiGatewayMock.on(GetRestApiCommand).rejects('Unknown error');

      const event = createMockEvent('Create');
      const result = await lambdaHandler(event);

      expect(result.Status).toBe('FAILED');
      expect(result.Reason).toBe('Unknown error');
    });
  });
});
