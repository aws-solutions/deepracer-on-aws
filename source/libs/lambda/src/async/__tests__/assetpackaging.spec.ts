// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Readable } from 'stream';

import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { modelDao, ResourceId, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { sdkStreamMixin } from '@smithy/util-stream';
import { mockClient } from 'aws-sdk-client-mock';

import { handler, removeSagemakerArtifacts } from '../assetpackaging.js';

describe('Asset Packaging lambdaHandler', () => {
  const mockS3Client = mockClient(S3Client);

  const testEvent = {
    sourcePrefix: 'testProfile/models/testModel/',
  };

  const mockContext = {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'testFunction',
    functionVersion: '$LATEST',
    memoryLimitInMB: '128',
    logGroupName: '/aws/lambda/testFunction',
    logStreamName: '2025/04/10/[$LATEST]abcdef1234567890',
    awsRequestId: '12345678-1234-1234-1234-123456789012',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:testFunction',
    getRemainingTimeInMillis: () => 30000,
    done: vi.fn(),
    fail: vi.fn(),
    succeed: vi.fn(),
  };

  beforeEach(() => {
    mockS3Client.reset();
    vi.clearAllMocks();

    mockS3Client.on(ListObjectsV2Command).resolves({
      Contents: [
        {
          Key: 'testProfile/models/testModel/model_metadata.json',
          Size: 10,
          LastModified: new Date(),
        },
      ],
    });

    const stream = new Readable({
      read() {
        this.push('test content');
        this.push(null);
      },
    });

    mockS3Client.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(stream),
      ContentLength: Buffer.from('test content').length,
      ContentType: 'application/octet-stream',
    });

    vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);
  });

  it('should successfully compress and update model', async () => {
    const output = await handler(testEvent, mockContext);
    const expectedKey = 's3://dest-bucket/testProfile/models/testModel/virtualmodel.zip';

    expect(output.virtualModelArtifactS3Location).toMatch(/^s3:\/\/.+/);
    expect(modelDao.update).toHaveBeenCalledWith(
      {
        profileId: 'testProfile' as ResourceId,
        modelId: 'testModel' as ResourceId,
      },
      {
        // Typecast to any is required due to an issue with ElectroDB's types
        ['assetS3Locations.virtualModelArtifactS3Location' as any]: expectedKey, // eslint-disable-line @typescript-eslint/no-explicit-any
        packagedAt: expect.any(String),
        packagingStatus: 'READY',
      },
    );
  });

  it('should throw error if no objects found in S3', async () => {
    mockS3Client.on(ListObjectsV2Command).resolves({
      Contents: [],
    });

    await expect(handler(testEvent, mockContext)).rejects.toThrow('No objects found in the specified directory');
  });

  it('should handle S3 ListObjects error', async () => {
    mockS3Client.on(ListObjectsV2Command).rejects(new Error('S3 List Error'));

    await expect(handler(testEvent, mockContext)).rejects.toThrow('S3 List Error');
  });

  it('should handle S3 GetObject error', async () => {
    mockS3Client.on(GetObjectCommand).rejects(new Error('S3 Get Error'));

    await expect(handler(testEvent, mockContext)).rejects.toThrow('S3 Get Error');
  });

  it('should handle stream error', async () => {
    const errorStream = new Readable({
      read() {
        this.emit('error', new Error('Stream Error'));
      },
    });

    mockS3Client.on(GetObjectCommand).resolves({
      Body: sdkStreamMixin(errorStream),
      ContentLength: Buffer.from('test content').length,
      ContentType: 'application/octet-stream',
    });

    await expect(handler(testEvent, mockContext)).rejects.toThrow('Stream Error');
  });

  it('should handle modelDao update error', async () => {
    vi.spyOn(modelDao, 'update').mockRejectedValue(new Error('Database Error'));

    await expect(handler(testEvent, mockContext)).rejects.toThrow('Database Error');
  });

  it('should skip files in excluded directories', async () => {
    const mockContents = [
      { Key: 'testProfile/models/testModel/model_metadata.json', Size: 10, LastModified: new Date() },
      { Key: 'testProfile/models/testModel/sim-trace/trace.csv', Size: 20, LastModified: new Date() },
      { Key: 'testProfile/models/testModel/videos/video.mp4', Size: 60, LastModified: new Date() },
      {
        Key: 'testProfile/models/testModel/output/model.tar.gz',
        Size: 40,
        LastModified: new Date(),
      },
    ];

    mockS3Client.on(ListObjectsV2Command).resolves({
      Contents: mockContents,
    });

    const createReadableStream = () =>
      new Readable({
        read() {
          this.push('test content');
          this.push(null);
        },
      });

    const getObjectCalls: Record<string, boolean> = {};
    mockS3Client.on(GetObjectCommand).callsFake((params) => {
      const key = params.Key as string;
      getObjectCalls[key] = true;

      return {
        Body: sdkStreamMixin(createReadableStream()),
        ContentLength: Buffer.from('test content').length,
        ContentType: 'application/octet-stream',
      };
    });

    await handler(testEvent, mockContext);

    const requestedKeys = Object.keys(getObjectCalls);

    // Should not request files in excluded directories
    expect(requestedKeys).not.toContainEqual(expect.stringContaining('trace.csv'));
    expect(requestedKeys).not.toContainEqual(expect.stringContaining('video.mp4'));
    expect(requestedKeys).not.toContainEqual(expect.stringContaining('model.tar.gz'));
    // Should request files that are not in excluded directories
    expect(requestedKeys).toContainEqual(expect.stringContaining('model_metadata.json'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockS3Client.reset();
    vi.resetModules();
  });
});

describe('Remove sagemaker-artifacts/ before exporting', () => {
  it('should remove sagemaker-artifacts/ from middle of path', () => {
    const input = 'some/path/sagemaker-artifacts/model/model_metadata.json';
    const expected = 'some/path/model/model_metadata.json';
    const result = removeSagemakerArtifacts(input);
    expect(result).toBe(expected);
  });

  it('should return unchanged path when sagemaker-artifacts/ is not present', () => {
    const input = 'model/reward_function.py';
    const expected = 'model/reward_function.py';
    const result = removeSagemakerArtifacts(input);
    expect(result).toBe(expected);
  });
});
