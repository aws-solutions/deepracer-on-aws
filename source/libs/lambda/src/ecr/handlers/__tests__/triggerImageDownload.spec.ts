// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand } from '@aws-sdk/client-codebuild';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { onEventHandler, isCompleteHandler, lambdaHandler } from '../triggerImageDownload.js';

const codeBuildMock = mockClient(CodeBuildClient);

describe('triggerImageDownload', () => {
  beforeEach(() => {
    codeBuildMock.reset();
    vi.clearAllMocks();
    process.env.CODEBUILD_PROJECT_NAME = 'test-project';
  });

  describe('onEventHandler', () => {
    it('starts CodeBuild project on Create event', async () => {
      codeBuildMock.on(StartBuildCommand).resolves({
        build: { id: 'test-build-id' },
      });

      const event = {
        RequestType: 'Create',
        StackId: 'test-stack',
        RequestId: 'test-request',
        LogicalResourceId: 'test-resource',
        ResourceType: 'Custom::EcrImageDownloader',
        ResourceProperties: {},
      };

      const result = await onEventHandler(event);

      expect(result.Status).toBe('SUCCESS');
      expect(result.Data?.buildId).toBe('test-build-id');
    });

    it('skips action on Delete event', async () => {
      const event = {
        RequestType: 'Delete',
        StackId: 'test-stack',
        RequestId: 'test-request',
        LogicalResourceId: 'test-resource',
        ResourceType: 'Custom::EcrImageDownloader',
        ResourceProperties: {},
        PhysicalResourceId: 'test-physical-id',
      };

      const result = await onEventHandler(event);

      expect(result.Status).toBe('SUCCESS');
      expect(result.Data?.Message).toBe('Delete event - no action taken');
    });

    it('returns FAILED status on error', async () => {
      codeBuildMock.on(StartBuildCommand).rejects(new Error('CodeBuild error'));

      const event = {
        RequestType: 'Create',
        StackId: 'test-stack',
        RequestId: 'test-request',
        LogicalResourceId: 'test-resource',
        ResourceType: 'Custom::EcrImageDownloader',
        ResourceProperties: {},
      };

      const result = await onEventHandler(event);

      expect(result.Status).toBe('FAILED');
      expect(result.Reason).toBe('CodeBuild error');
    });
  });

  describe('isCompleteHandler', () => {
    it('returns complete for Delete event', async () => {
      const event = {
        RequestType: 'Delete',
        StackId: 'test-stack',
        RequestId: 'test-request',
        LogicalResourceId: 'test-resource',
        ResourceType: 'Custom::EcrImageDownloader',
        ResourceProperties: {},
        PhysicalResourceId: 'test-physical-id',
      };

      const result = await isCompleteHandler(event);

      expect(result.IsComplete).toBe(true);
    });

    it('returns complete when build succeeds', async () => {
      codeBuildMock.on(BatchGetBuildsCommand).resolves({
        builds: [{ buildStatus: 'SUCCEEDED' }],
      });

      const event = {
        RequestType: 'Create',
        StackId: 'test-stack',
        RequestId: 'test-request',
        LogicalResourceId: 'test-resource',
        ResourceType: 'Custom::EcrImageDownloader',
        ResourceProperties: {},
        Data: { BuildId: 'test-build-id' },
      };

      const result = await isCompleteHandler(event);

      expect(result.IsComplete).toBe(true);
    });

    it('returns incomplete when build is in progress', async () => {
      codeBuildMock.on(BatchGetBuildsCommand).resolves({
        builds: [{ buildStatus: 'IN_PROGRESS' }],
      });

      const event = {
        RequestType: 'Create',
        StackId: 'test-stack',
        RequestId: 'test-request',
        LogicalResourceId: 'test-resource',
        ResourceType: 'Custom::EcrImageDownloader',
        ResourceProperties: {},
        Data: { BuildId: 'test-build-id' },
      };

      const result = await isCompleteHandler(event);

      expect(result.IsComplete).toBe(false);
    });
  });

  describe('lambdaHandler', () => {
    it('handles API Gateway event', async () => {
      codeBuildMock.on(StartBuildCommand).resolves({
        build: { id: 'test-build-id' },
      });

      const event = {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({ additionalImages: ['test-image'] }),
      };

      const result = await lambdaHandler(event);

      expect(result).toHaveProperty('statusCode', 200);
    });

    it('handles direct Lambda invocation', async () => {
      codeBuildMock.on(StartBuildCommand).resolves({
        build: { id: 'test-build-id' },
      });

      const event = { additionalImages: ['test-image'] };

      const result = await lambdaHandler(event);

      expect(result).toHaveProperty('buildId', 'test-build-id');
    });
  });
});
