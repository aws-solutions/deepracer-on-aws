// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type {
  CloudFormationCustomResourceCreateEvent,
  CloudFormationCustomResourceDeleteEvent,
  CloudFormationCustomResourceUpdateEvent,
} from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CreateWebsiteEnvFile } from '../createWebsiteEnvFile';

interface CustomResourceProperties {
  ServiceToken: string;
  bucketName: string;
  fileName?: string;
  fileContent?: string;
  namespace?: string;
  distributionId?: string;
}

describe('CreateWebsiteEnvFile Lambda', () => {
  const s3Mock = mockClient(S3Client);
  const cloudFrontMock = mockClient(CloudFrontClient);
  const baseEvent = {
    ServiceToken: 'token',
    ResponseURL: 'https://example.com',
    StackId: 'stack-id',
    RequestId: 'request-id',
    LogicalResourceId: 'resource-id',
    ResourceType: 'Custom::CreateWebsiteEnvFile',
  };

  beforeEach(() => {
    s3Mock.reset();
    cloudFrontMock.reset();
    vi.clearAllMocks();
  });

  describe('when handling Create events', () => {
    const createEvent: CloudFormationCustomResourceCreateEvent = {
      RequestType: 'Create',
      ...baseEvent,
      ResourceProperties: {
        ServiceToken: 'token',
        bucketName: 'test-bucket',
      } as CustomResourceProperties,
    };

    it('creates env file with default values successfully', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(createEvent);

      // Verify S3 API call with default values
      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.calls()[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: 'env.js',
        Body: 'window.EnvironmentConfig = {};',
        ContentType: 'application/javascript',
      });

      // Verify the Lambda response
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'test-bucket',
          fileName: 'env.js',
          message: 'Successfully created env file',
        },
      });
    });

    it('creates env file with namespace in PhysicalResourceId', async () => {
      const namespaceEvent: CloudFormationCustomResourceCreateEvent = {
        RequestType: 'Create',
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          namespace: 'dev',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(namespaceEvent);

      // Verify S3 API call
      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.calls()[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: 'env.js',
        Body: 'window.EnvironmentConfig = {};',
        ContentType: 'application/javascript',
      });

      // Verify the PhysicalResourceId includes namespace
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator-dev',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'test-bucket',
          fileName: 'env.js',
          message: 'Successfully created env file',
        },
      });
    });

    it('creates env file with custom fileName and fileContent', async () => {
      const customEvent = {
        ...createEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          fileName: 'custom-env.js',
          fileContent: 'window.CustomConfig = { api: "https://api.example.com" };',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(customEvent);

      // Verify S3 API call with custom values
      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.calls()[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: 'custom-env.js',
        Body: 'window.CustomConfig = { api: "https://api.example.com" };',
        ContentType: 'application/javascript',
      });

      // Verify the Lambda response
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'test-bucket',
          fileName: 'custom-env.js',
          message: 'Successfully created env file',
        },
      });
    });

    it('returns failure response when bucketName is missing', async () => {
      const invalidEvent = {
        ...createEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          // bucketName is missing
        } as CustomResourceProperties,
      };

      const result = await CreateWebsiteEnvFile(invalidEvent);

      // Verify no S3 API calls were made
      expect(s3Mock.calls()).toHaveLength(0);

      // Verify the failure response
      expect(result).toEqual({
        Status: 'FAILED',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Reason: 'Failed to create env file',
      });
    });

    it('returns failure response when S3 put operation fails', async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 operation failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* intentionally empty */
      });

      const result = await CreateWebsiteEnvFile(createEvent);

      // Verify S3 API call was attempted
      expect(s3Mock.calls()).toHaveLength(1);

      // Verify error was logged with enhanced logging
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create env file', {
        error: expect.any(Error),
        physicalResourceId: 'website-env-file-creator',
        namespace: 'default',
      });

      // Verify the failure response
      expect(result).toEqual({
        Status: 'FAILED',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Reason: 'Failed to create env file',
      });
    });

    it('creates env file and invalidates CloudFront when distributionId provided', async () => {
      const eventWithDistribution: CloudFormationCustomResourceCreateEvent = {
        RequestType: 'Create',
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          distributionId: 'E12345SAMPLE',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});
      cloudFrontMock.on(CreateInvalidationCommand).resolves({
        Invalidation: {
          Id: 'I12345SAMPLE',
          Status: 'InProgress',
          CreateTime: new Date(),
          InvalidationBatch: {
            Paths: { Quantity: 1, Items: ['/env.js'] },
            CallerReference: 'test-ref',
          },
        },
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        /* intentionally empty */
      });

      const result = await CreateWebsiteEnvFile(eventWithDistribution);

      // Verify S3 API call was made
      expect(s3Mock.calls()).toHaveLength(1);

      // Verify CloudFront invalidation was called
      expect(cloudFrontMock.calls()).toHaveLength(1);
      const invalidationCall = cloudFrontMock.calls()[0];
      expect(invalidationCall.args[0].input).toMatchObject({
        DistributionId: 'E12345SAMPLE',
        InvalidationBatch: {
          Paths: {
            Quantity: 1,
            Items: ['/env.js'],
          },
          CallerReference: expect.stringMatching(/^website-env-file-creator-\d+$/),
        },
      });

      // Verify invalidation success was logged
      expect(consoleSpy).toHaveBeenCalledWith('Successfully created CloudFront invalidation', {
        distributionId: 'E12345SAMPLE',
        invalidationPath: '/env.js',
        invalidationId: 'I12345SAMPLE',
      });

      // Verify successful response
      expect(result.Status).toBe('SUCCESS');
    });

    it('continues successfully even when CloudFront invalidation fails', async () => {
      const eventWithDistribution: CloudFormationCustomResourceCreateEvent = {
        RequestType: 'Create',
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          distributionId: 'E12345SAMPLE',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});
      cloudFrontMock.on(CreateInvalidationCommand).rejects(new Error('CloudFront error'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
        /* intentionally empty */
      });

      const result = await CreateWebsiteEnvFile(eventWithDistribution);

      // Verify S3 API call was made
      expect(s3Mock.calls()).toHaveLength(1);

      // Verify CloudFront invalidation was attempted
      expect(cloudFrontMock.calls()).toHaveLength(1);

      // Verify warning was logged for invalidation failure
      expect(consoleWarnSpy).toHaveBeenCalledWith('Failed to invalidate CloudFront cache, but continuing', {
        distributionId: 'E12345SAMPLE',
        fileName: 'env.js',
        error: expect.any(Error),
      });

      // Verify successful response (despite invalidation failure)
      expect(result.Status).toBe('SUCCESS');
    });

    it('logs success message after successful file creation', async () => {
      s3Mock.on(PutObjectCommand).resolves({});
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {
        /* intentionally empty */
      });

      await CreateWebsiteEnvFile(createEvent);

      // Verify success was logged with enhanced logging
      expect(consoleSpy).toHaveBeenCalledWith('Successfully created env file', {
        bucketName: 'test-bucket',
        fileName: 'env.js',
        physicalResourceId: 'website-env-file-creator',
        namespace: 'default',
      });
    });
  });

  describe('when handling Update events', () => {
    const updateEvent: CloudFormationCustomResourceUpdateEvent = {
      RequestType: 'Update',
      ...baseEvent,
      PhysicalResourceId: 'website-env-file-creator',
      ResourceProperties: {
        ServiceToken: 'token',
        bucketName: 'updated-bucket',
        fileName: 'updated-env.js',
        fileContent: 'window.UpdatedConfig = {};',
      } as CustomResourceProperties,
      OldResourceProperties: {
        ServiceToken: 'token',
        bucketName: 'old-bucket',
        fileName: 'old-env.js',
        fileContent: 'window.OldConfig = {};',
      } as CustomResourceProperties,
    };

    it('creates env file with updated values successfully', async () => {
      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(updateEvent);

      // Verify S3 API call with updated values
      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.calls()[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'updated-bucket',
        Key: 'updated-env.js',
        Body: 'window.UpdatedConfig = {};',
        ContentType: 'application/javascript',
      });

      // Verify the Lambda response
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'updated-bucket',
          fileName: 'updated-env.js',
          message: 'Successfully created env file',
        },
      });
    });

    it('returns failure response when S3 put operation fails during update', async () => {
      s3Mock.on(PutObjectCommand).rejects(new Error('S3 update failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        /* intentionally empty */
      });

      const result = await CreateWebsiteEnvFile(updateEvent);

      // Verify S3 API call was attempted
      expect(s3Mock.calls()).toHaveLength(1);

      // Verify error was logged with enhanced logging
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create env file', {
        error: expect.any(Error),
        physicalResourceId: 'website-env-file-creator',
        namespace: 'default',
      });

      // Verify the failure response
      expect(result).toEqual({
        Status: 'FAILED',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Reason: 'Failed to create env file',
      });
    });

    it('handles Update events with namespace in PhysicalResourceId', async () => {
      const namespacedUpdateEvent: CloudFormationCustomResourceUpdateEvent = {
        RequestType: 'Update',
        ...baseEvent,
        PhysicalResourceId: 'website-env-file-creator-prod',
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'prod-bucket',
          namespace: 'prod',
        } as CustomResourceProperties,
        OldResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'old-prod-bucket',
          namespace: 'prod',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(namespacedUpdateEvent);

      // Verify the PhysicalResourceId uses the existing one from the event
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator-prod',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'prod-bucket',
          fileName: 'env.js',
          message: 'Successfully created env file',
        },
      });
    });
  });

  describe('when handling Delete events', () => {
    const deleteEvent: CloudFormationCustomResourceDeleteEvent = {
      RequestType: 'Delete',
      ...baseEvent,
      PhysicalResourceId: 'website-env-file-creator',
      ResourceProperties: {
        ServiceToken: 'token',
        bucketName: 'test-bucket',
      } as CustomResourceProperties,
    };

    it('returns success without making any S3 calls', async () => {
      const result = await CreateWebsiteEnvFile(deleteEvent);

      // Verify no S3 API calls were made
      expect(s3Mock.calls()).toHaveLength(0);

      // Verify the Lambda response
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          Message: 'Delete event received; no cleanup needed',
        },
      });
    });

    it('handles Delete events with namespace in PhysicalResourceId', async () => {
      const namespacedDeleteEvent: CloudFormationCustomResourceDeleteEvent = {
        RequestType: 'Delete',
        ...baseEvent,
        PhysicalResourceId: 'website-env-file-creator-staging',
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'staging-bucket',
          namespace: 'staging',
        } as CustomResourceProperties,
      };

      const result = await CreateWebsiteEnvFile(namespacedDeleteEvent);

      // Verify no S3 API calls were made
      expect(s3Mock.calls()).toHaveLength(0);

      // Verify the Lambda response maintains the existing PhysicalResourceId
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator-staging',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          Message: 'Delete event received; no cleanup needed',
        },
      });
    });

    it('handles Delete events without PhysicalResourceId in event (fallback scenario)', async () => {
      const deleteEventWithoutPhysicalId = {
        RequestType: 'Delete',
        ...baseEvent,
        // PhysicalResourceId is missing, should fallback to constructed ID
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          namespace: 'prod',
        } as CustomResourceProperties,
      } as unknown as CloudFormationCustomResourceDeleteEvent;

      const result = await CreateWebsiteEnvFile(deleteEventWithoutPhysicalId);

      // Verify no S3 API calls were made
      expect(s3Mock.calls()).toHaveLength(0);

      // Verify the fallback PhysicalResourceId is constructed with namespace
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator-prod',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          Message: 'Delete event received; no cleanup needed',
        },
      });
    });
  });

  describe('fallback PhysicalResourceId scenarios', () => {
    it('handles Update events without PhysicalResourceId in event (fallback scenario)', async () => {
      const updateEventWithoutPhysicalId = {
        RequestType: 'Update',
        ...baseEvent,
        // PhysicalResourceId is missing, should fallback to constructed ID
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'updated-bucket',
          namespace: 'test',
        } as CustomResourceProperties,
        OldResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'old-bucket',
        } as CustomResourceProperties,
      } as unknown as CloudFormationCustomResourceUpdateEvent;

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(updateEventWithoutPhysicalId);

      // Verify the fallback PhysicalResourceId is constructed with namespace
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator-test',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'updated-bucket',
          fileName: 'env.js',
          message: 'Successfully created env file',
        },
      });
    });

    it('handles Update events without PhysicalResourceId and without namespace (baseId only)', async () => {
      const updateEventWithoutPhysicalId = {
        RequestType: 'Update',
        ...baseEvent,
        // PhysicalResourceId is missing, should fallback to constructed ID without namespace
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'updated-bucket',
          // namespace is missing
        } as CustomResourceProperties,
        OldResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'old-bucket',
        } as CustomResourceProperties,
      } as unknown as CloudFormationCustomResourceUpdateEvent;

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(updateEventWithoutPhysicalId);

      // Verify the fallback PhysicalResourceId is just the baseId (no namespace)
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          bucketName: 'updated-bucket',
          fileName: 'env.js',
          message: 'Successfully created env file',
        },
      });
    });

    it('handles Delete events without PhysicalResourceId and without namespace (baseId only)', async () => {
      const deleteEventWithoutPhysicalId = {
        RequestType: 'Delete',
        ...baseEvent,
        // PhysicalResourceId is missing, should fallback to constructed ID without namespace
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          // namespace is missing
        } as CustomResourceProperties,
      } as unknown as CloudFormationCustomResourceDeleteEvent;

      const result = await CreateWebsiteEnvFile(deleteEventWithoutPhysicalId);

      // Verify no S3 API calls were made
      expect(s3Mock.calls()).toHaveLength(0);

      // Verify the fallback PhysicalResourceId is just the baseId (no namespace)
      expect(result).toEqual({
        Status: 'SUCCESS',
        PhysicalResourceId: 'website-env-file-creator',
        StackId: 'stack-id',
        RequestId: 'request-id',
        LogicalResourceId: 'resource-id',
        Data: {
          Message: 'Delete event received; no cleanup needed',
        },
      });
    });
  });

  describe('getPhysicalResourceId edge cases', () => {
    it('handles unknown RequestType by falling back to constructed ID', async () => {
      const unknownRequestTypeEvent = {
        RequestType: 'Unknown' as 'Create', // Cast to valid type for testing edge case
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          namespace: 'edge-case',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(unknownRequestTypeEvent);

      // Verify the fallback PhysicalResourceId is constructed
      expect(result.PhysicalResourceId).toBe('website-env-file-creator-edge-case');
      expect(result.Status).toBe('SUCCESS');
    });

    it('handles unknown RequestType without namespace (baseId only)', async () => {
      const unknownRequestTypeEvent = {
        RequestType: 'Unknown' as 'Create', // Cast to valid type for testing edge case
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          // namespace is missing - should test line 32
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(unknownRequestTypeEvent);

      // Verify the fallback PhysicalResourceId is just the baseId (no namespace)
      expect(result.PhysicalResourceId).toBe('website-env-file-creator');
      expect(result.Status).toBe('SUCCESS');
    });
  });

  describe('edge cases', () => {
    it('handles empty string values for fileName and fileContent', async () => {
      const eventWithEmptyStrings: CloudFormationCustomResourceCreateEvent = {
        RequestType: 'Create',
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'test-bucket',
          fileName: '',
          fileContent: '',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(eventWithEmptyStrings);

      // Verify S3 API call uses empty strings as provided
      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.calls()[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'test-bucket',
        Key: '',
        Body: '',
        ContentType: 'application/javascript',
      });

      // Verify successful response
      expect(result.Status).toBe('SUCCESS');
      expect(result.Data?.fileName).toBe('');
    });

    it('handles bucketName with special characters', async () => {
      const eventWithSpecialBucket: CloudFormationCustomResourceCreateEvent = {
        RequestType: 'Create',
        ...baseEvent,
        ResourceProperties: {
          ServiceToken: 'token',
          bucketName: 'my-bucket-with-dashes_and_underscores.123',
        } as CustomResourceProperties,
      };

      s3Mock.on(PutObjectCommand).resolves({});

      const result = await CreateWebsiteEnvFile(eventWithSpecialBucket);

      // Verify S3 API call uses the bucket name as provided
      expect(s3Mock.calls()).toHaveLength(1);
      const call = s3Mock.calls()[0];
      expect(call.args[0].input).toEqual({
        Bucket: 'my-bucket-with-dashes_and_underscores.123',
        Key: 'env.js',
        Body: 'window.EnvironmentConfig = {};',
        ContentType: 'application/javascript',
      });

      // Verify successful response
      expect(result.Status).toBe('SUCCESS');
      expect(result.Data?.bucketName).toBe('my-bucket-with-dashes_and_underscores.123');
    });
  });
});
