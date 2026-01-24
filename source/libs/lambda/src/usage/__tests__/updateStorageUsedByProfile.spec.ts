// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { profileDao } from '@deepracer-indy/database';
import { InternalFailureError } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';
import { s3Client } from '@deepracer-indy/utils/src/clients/s3Client';
import { S3Event } from 'aws-lambda';
import { describe, expect, it, vi, beforeEach, Mock } from 'vitest';

import { UpdateStorageUsedByProfile, lambdaHandler } from '../../usage/updateStorageUsedByProfile';

vi.mock('@deepracer-indy/database', () => ({
  profileDao: {
    update: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@deepracer-indy/utils/src/clients/s3Client', () => ({
  s3Client: {
    send: vi.fn(),
  },
}));

vi.mock('#utils/instrumentation/instrumentHandler.js', () => ({
  instrumentHandler: vi.fn((handler) => handler),
}));

describe('updateStorageUsedByProfile', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.MODEL_STORAGE_BUCKET_NAME = 'test-bucket';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const createMockS3Event = (key: string): S3Event => ({
    Records: [
      {
        eventVersion: '2.1',
        eventSource: 'aws:s3',
        awsRegion: 'us-east-1',
        eventTime: '2025-09-02T12:00:00Z',
        eventName: 'ObjectCreated:Put',
        userIdentity: {
          principalId: 'AWS:AIDAEXAMPLE',
        },
        requestParameters: {
          sourceIPAddress: '192.168.1.1',
        },
        responseElements: {
          'x-amz-request-id': 'request-id-123',
          'x-amz-id-2': 'example-id',
        },
        s3: {
          s3SchemaVersion: '1.0',
          configurationId: 'config-id',
          bucket: {
            name: 'test-bucket',
            ownerIdentity: {
              principalId: 'EXAMPLE',
            },
            arn: 'arn:aws:s3:::test-bucket',
          },
          object: {
            key,
            size: 1024,
            eTag: 'etag123',
            sequencer: '0A1B2C3D4E5F',
          },
        },
      },
    ],
  });

  describe('UpdateStorageUsedByProfile', () => {
    it('should log the start of the handler with input event', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: [{ Size: 1000 }, { Size: 2000 }],
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 5,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(logger.info).toHaveBeenCalledWith('UpdateStorageUsedByProfile lambda start', { input: mockEvent });
    });

    it('should extract profile ID from S3 event key', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: [{ Size: 1000 }, { Size: 2000 }],
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 5,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(s3Client.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            Prefix: 'profile-123/',
          }),
        }),
      );
    });

    it('should calculate storage used by summing object sizes', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: [{ Size: 1000 }, { Size: 2000 }, { Size: 3000 }],
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 5,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: 'profile-123' },
        expect.objectContaining({
          modelStorageUsage: 6000,
        }),
      );
    });

    it('should handle pagination when listing objects', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock)
        .mockImplementationOnce(() => {
          return Promise.resolve({
            Contents: [{ Size: 1000 }, { Size: 2000 }],
            IsTruncated: true,
            NextContinuationToken: 'token123',
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            Contents: [{ Size: 3000 }, { Size: 4000 }],
            IsTruncated: false,
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            KeyCount: 5,
            IsTruncated: false,
          });
        });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(s3Client.send).toHaveBeenCalledTimes(3);

      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: 'profile-123' },
        expect.objectContaining({
          modelStorageUsage: 10000,
        }),
      );
    });

    it('should get model count from S3', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: [{ Size: 1000 }, { Size: 2000 }],
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 7,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: 'profile-123' },
        expect.objectContaining({
          modelCount: 7,
        }),
      );
    });

    it('should handle empty Contents array when calculating storage', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: null,
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 0,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: 'profile-123' },
        expect.objectContaining({
          modelStorageUsage: 0,
        }),
      );
    });

    it('should update profile with storage used and model count', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: [{ Size: 1000 }, { Size: 2000 }],
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 5,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      await UpdateStorageUsedByProfile(mockEvent);

      expect(profileDao.update).toHaveBeenCalledWith(
        { profileId: 'profile-123' },
        {
          modelStorageUsage: 3000,
          modelCount: 5,
        },
      );
    });

    it('should throw InternalFailureError when calculating storage fails', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockRejectedValueOnce(new Error('S3 error'));

      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(InternalFailureError);
      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(
        'Failed to get storage metrics for requested profile',
      );
      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(
        'Failed to get storage metrics for requested profile',
      );
    });

    it('should throw InternalFailureError when getting model count fails', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock)
        .mockImplementationOnce(() => {
          return Promise.resolve({
            Contents: [{ Size: 1000 }],
            IsTruncated: false,
          });
        })
        .mockRejectedValueOnce(new Error('S3 error'));

      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(InternalFailureError);
      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(
        'Failed to get storage metrics for requested profile',
      );
    });

    it('should throw InternalFailureError when updating profile fails', async () => {
      const mockEvent = createMockS3Event('profile-123/models/model1');
      (s3Client.send as Mock).mockImplementation((command: ListObjectsV2Command) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.Prefix === 'profile-123/') {
            return Promise.resolve({
              Contents: [{ Size: 1000 }],
              IsTruncated: false,
            });
          } else if (command.input.Prefix === 'profile-123/models/') {
            return Promise.resolve({
              KeyCount: 5,
              IsTruncated: false,
            });
          }
        }
        return Promise.resolve({});
      });

      (profileDao.update as Mock).mockRejectedValue(new Error('Database error'));

      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(InternalFailureError);
      await expect(UpdateStorageUsedByProfile(mockEvent)).rejects.toThrow(
        'Failed to get storage metrics for requested profile',
      );
    });
  });

  describe('lambdaHandler', () => {
    it('should be instrumented', () => {
      expect(lambdaHandler).toBeDefined();
    });
  });
});
