// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from 'stream';

import {
  GetObjectCommand,
  GetObjectCommandOutput,
  CompleteMultipartUploadCommandOutput,
  ListObjectsV2Command,
  ListObjectsV2CommandOutput,
  DeleteObjectsCommand,
  CopyObjectCommand,
  CopyObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mockClient } from 'aws-sdk-client-mock';

import { s3Client } from '#clients/s3Client.js';
import { AmazonS3URI } from '#s3/AmazonS3URI.js';

import { s3Helper } from '../S3Helper.js';

vi.mock('@aws-sdk/lib-storage');

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(),
}));

describe('S3Helper', () => {
  const mockS3Client = mockClient(s3Client);
  const mockBucket = 'test-bucket';
  const mockKey = 'test-key.txt';
  const mockS3Uri = `s3://${mockBucket}/${mockKey}`;
  const mockContent = { metrics: [] };

  describe('getObjectAsStringFromS3()', () => {
    beforeEach(() => {
      mockS3Client.reset();
    });

    it('should retrieve an object from S3 as a string when given a raw S3 path', async () => {
      const expectedResult = JSON.stringify(mockContent);

      mockS3Client.on(GetObjectCommand).resolves({
        Body: {
          transformToString() {
            return Promise.resolve(expectedResult);
          },
        },
      } as GetObjectCommandOutput);

      const result = await s3Helper.getObjectAsStringFromS3(mockS3Uri);

      expect(mockS3Client).toHaveReceivedCommandWith(GetObjectCommand, { Bucket: mockBucket, Key: mockKey });
      expect(result).toEqual(expectedResult);
    });

    it('should retrieve an object from S3 as a string when given an AmazonS3URI instance', async () => {
      const mockAmazonS3Uri = new AmazonS3URI(mockS3Uri);
      const expectedResult = JSON.stringify(mockContent);

      mockS3Client.on(GetObjectCommand).resolves({
        Body: {
          transformToString() {
            return Promise.resolve(expectedResult);
          },
        },
      } as GetObjectCommandOutput);

      const result = await s3Helper.getObjectAsStringFromS3(mockAmazonS3Uri);

      expect(mockS3Client).toHaveReceivedCommandWith(GetObjectCommand, { Bucket: mockBucket, Key: mockKey });
      expect(result).toEqual(expectedResult);
    });

    it('should throw an error if the S3 object cannot be retrieved', async () => {
      const mockError = new Error('S3 Error');

      mockS3Client.on(GetObjectCommand).rejects(mockError);

      await expect(s3Helper.getObjectAsStringFromS3(mockS3Uri)).rejects.toThrow(mockError);
    });
  });

  describe('getPresignedUrl', () => {
    const mockPresignedUrl = 'https://mock-presigned-url';

    it('should generate a presigned URL for the given S3 URI', async () => {
      vi.mocked(getSignedUrl).mockResolvedValueOnce(mockPresignedUrl);

      const result = await s3Helper.getPresignedUrl(mockS3Uri);

      expect(result).toEqual(mockPresignedUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(s3Client, expect.any(GetObjectCommand), {
        expiresIn: s3Helper.DEFAULT_PRESIGNED_URL_EXPIRE_TIME,
      });
    });

    it('should generate a presigned URL for the given S3 URI and expiresIn time', async () => {
      const mockExpiresIn = 5000;
      vi.mocked(getSignedUrl).mockResolvedValueOnce(mockPresignedUrl);

      const result = await s3Helper.getPresignedUrl(mockS3Uri, mockExpiresIn);

      expect(result).toEqual(mockPresignedUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(s3Client, expect.any(GetObjectCommand), {
        expiresIn: mockExpiresIn,
      });
    });

    it('should include ResponseContentDisposition when downloadFilename is provided', async () => {
      const mockExpiresIn = 300;
      const mockFilename = 'model.tar.gz';
      vi.mocked(getSignedUrl).mockResolvedValueOnce(mockPresignedUrl);

      const result = await s3Helper.getPresignedUrl(mockS3Uri, mockExpiresIn, mockFilename);

      expect(result).toEqual(mockPresignedUrl);
      expect(getSignedUrl).toHaveBeenCalledWith(
        s3Client,
        expect.objectContaining({
          input: expect.objectContaining({
            Bucket: mockBucket,
            Key: mockKey,
            ResponseContentDisposition: `attachment; filename="${mockFilename}"`,
          }),
        }),
        { expiresIn: mockExpiresIn },
      );
    });

    it('should sanitize dangerous characters from downloadFilename', async () => {
      const mockExpiresIn = 300;
      const maliciousFilename = 'model\r\nX-Injected: header"\\;test.tar.gz';
      vi.mocked(getSignedUrl).mockResolvedValueOnce(mockPresignedUrl);

      await s3Helper.getPresignedUrl(mockS3Uri, mockExpiresIn, maliciousFilename);

      expect(getSignedUrl).toHaveBeenCalledWith(
        s3Client,
        expect.objectContaining({
          input: expect.objectContaining({
            ResponseContentDisposition: 'attachment; filename="model__X-Injected: header___test.tar.gz"',
          }),
        }),
        { expiresIn: mockExpiresIn },
      );
    });
  });

  describe('writeToS3()', () => {
    const mockUploadDoneResponse = {
      Location: mockS3Uri,
      Bucket: mockBucket,
      Key: mockKey,
      $metadata: {},
    } as CompleteMultipartUploadCommandOutput;

    beforeEach(() => {
      vi.mocked(Upload).mockReturnValueOnce({
        done: () => Promise.resolve(mockUploadDoneResponse),
        on: vi.fn(),
      } as unknown as Upload);
    });

    it('should create a new upload and wait for completion when given an s3 URI', async () => {
      const writeContent = JSON.stringify(mockContent);

      const response = await s3Helper.writeToS3(writeContent, mockS3Uri);

      expect(Upload).toHaveBeenCalledWith({
        client: s3Client,
        params: { Bucket: mockBucket, Key: mockKey, Body: writeContent },
      });
      expect(response).toEqual(mockUploadDoneResponse);
    });

    it('should create a new upload and wait for completion when given an instance of AmazonS3URI', async () => {
      const writeContent = JSON.stringify(mockContent);

      const response = await s3Helper.writeToS3(writeContent, new AmazonS3URI(mockS3Uri));

      expect(Upload).toHaveBeenCalledWith({
        client: s3Client,
        params: { Bucket: mockBucket, Key: mockKey, Body: writeContent },
      });
      expect(response).toEqual(mockUploadDoneResponse);
    });
  });

  describe('getReadableObjectFromS3()', () => {
    beforeEach(() => {
      mockS3Client.reset();
    });

    const mockReadable = new Readable();
    mockReadable.push('test data');
    mockReadable.push(null);

    it('should retrieve an object from S3 as a Readable stream when given a raw S3 path', async () => {
      mockS3Client.on(GetObjectCommand).resolves({
        Body: mockReadable,
      } as GetObjectCommandOutput);

      const result = await s3Helper.getReadableObjectFromS3(mockS3Uri);

      expect(mockS3Client).toHaveReceivedCommandWith(GetObjectCommand, { Bucket: mockBucket, Key: mockKey });
      expect(result).toBe(mockReadable);
    });

    it('should retrieve an object from S3 as a Readable stream when given an AmazonS3URI instance', async () => {
      const mockAmazonS3Uri = new AmazonS3URI(mockS3Uri);
      mockS3Client.on(GetObjectCommand).resolves({
        Body: mockReadable,
      } as GetObjectCommandOutput);

      const result = await s3Helper.getReadableObjectFromS3(mockAmazonS3Uri);

      expect(mockS3Client).toHaveReceivedCommandWith(GetObjectCommand, { Bucket: mockBucket, Key: mockKey });
      expect(result).toBe(mockReadable);
    });

    it('should throw an error if the S3 object cannot be retrieved', async () => {
      const mockError = new Error('S3 Error');
      mockS3Client.on(GetObjectCommand).rejects(mockError);

      await expect(s3Helper.getReadableObjectFromS3(mockS3Uri)).rejects.toThrow(mockError);
    });

    it('should throw an error if the S3 object has no body', async () => {
      mockS3Client.on(GetObjectCommand).resolves({} as GetObjectCommandOutput);

      await expect(s3Helper.getReadableObjectFromS3(mockS3Uri)).rejects.toThrow(
        `No body received from S3 object at ${mockBucket}/${mockKey}`,
      );
    });
  });

  describe('listObjects()', () => {
    beforeEach(() => {
      mockS3Client.reset();
    });

    it('should list objects from S3 with the specified bucket and prefix', async () => {
      const mockObjects = [
        { Key: 'test-key-1.txt', Size: 100 },
        { Key: 'test-key-2.txt', Size: 200 },
      ];
      const mockListResponse: ListObjectsV2CommandOutput = {
        Contents: mockObjects,
        $metadata: {},
      };

      mockS3Client.on(ListObjectsV2Command).resolves(mockListResponse);

      const result = await s3Helper.listObjects(mockBucket, 'test-key');

      expect(mockS3Client).toHaveReceivedCommandWith(ListObjectsV2Command, {
        Bucket: mockBucket,
        Prefix: 'test-key',
      });
      expect(result).toEqual(mockListResponse);
      expect(result.Contents).toEqual(mockObjects);
    });

    it('should throw an error if the list operation fails', async () => {
      const mockError = new Error('S3 List Error');
      mockS3Client.on(ListObjectsV2Command).rejects(mockError);

      await expect(s3Helper.listObjects(mockBucket, 'test-key')).rejects.toThrow(mockError);
    });
  });

  describe('copyObject()', () => {
    beforeEach(() => {
      mockS3Client.reset();
    });

    const sourceBucket = 'source-bucket';
    const sourceKey = 'source-key.txt';
    const destBucket = 'dest-bucket';
    const destKey = 'dest-key.txt';
    const mockCopyResponse: CopyObjectCommandOutput = {
      CopyObjectResult: {},
      $metadata: {},
    };

    it('should copy an object from source to destination', async () => {
      mockS3Client.on(CopyObjectCommand).resolves(mockCopyResponse);

      const result = await s3Helper.copyObject(sourceBucket, sourceKey, destBucket, destKey);

      expect(mockS3Client).toHaveReceivedCommandWith(CopyObjectCommand, {
        CopySource: `${sourceBucket}/${sourceKey}`,
        Bucket: destBucket,
        Key: destKey,
      });
      expect(result).toEqual(mockCopyResponse);
    });

    it('should throw an error if the copy operation fails', async () => {
      const mockError = new Error('S3 Copy Error');
      mockS3Client.on(CopyObjectCommand).rejects(mockError);

      await expect(s3Helper.copyObject(sourceBucket, sourceKey, destBucket, destKey)).rejects.toThrow(mockError);
    });
  });

  describe('deleteS3Location()', () => {
    beforeEach(() => {
      mockS3Client.reset();
    });

    it('should delete objects at the specified S3 location', async () => {
      mockS3Client.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: `${mockKey}/file1.txt` }, { Key: `${mockKey}/file2.txt` }],
        $metadata: {},
      });

      mockS3Client.on(DeleteObjectsCommand).resolves({
        $metadata: {},
      });

      await s3Helper.deleteS3Location(mockS3Uri);

      expect(mockS3Client).toHaveReceivedCommandWith(ListObjectsV2Command, {
        Bucket: mockBucket,
        Prefix: mockKey,
      });

      expect(mockS3Client).toHaveReceivedCommandWith(DeleteObjectsCommand, {
        Bucket: mockBucket,
        Delete: {
          Objects: [{ Key: `${mockKey}/file1.txt` }, { Key: `${mockKey}/file2.txt` }],
        },
      });
    });

    it('should throw an error if the delete operation fails', async () => {
      mockS3Client.on(ListObjectsV2Command).resolves({
        Contents: [{ Key: `${mockKey}/file1.txt` }],
        $metadata: {},
      });

      const mockError = new Error('S3 Delete Error');
      mockS3Client.on(DeleteObjectsCommand).rejects(mockError);

      await expect(s3Helper.deleteS3Location(mockS3Uri)).rejects.toThrow(mockError);
    });
  });
});
