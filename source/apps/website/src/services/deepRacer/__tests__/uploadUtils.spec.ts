// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fetchAuthSession } from 'aws-amplify/auth';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { getDeepRacerFileType, uploadModelFiles } from '#services/deepRacer/uploadUtils';

vi.mock('@aws-sdk/client-s3');
vi.mock('@aws-sdk/lib-storage');
vi.mock('aws-amplify/auth');
vi.mock('#utils/envUtils', () => ({
  environmentConfig: {
    region: 'us-west-2',
    uploadBucketName: 'test-bucket',
  },
}));

describe('getDeepRacerFileType', () => {
  it('should return text/plain for done file', () => {
    expect(getDeepRacerFileType('done', '')).toBe('text/plain');
  });

  it('should return correct content type for known file extensions', () => {
    const testCases = [
      { fileName: 'model.meta', ext: '.meta', expected: 'application/octet-stream' },
      { fileName: 'model.ckpt', ext: '.ckpt', expected: 'application/octet-stream' },
      { fileName: 'model.pb', ext: '.pb', expected: 'application/octet-stream' },
      { fileName: 'file.ready', ext: '.ready', expected: 'text/plain' },
      { fileName: 'config.json', ext: '.json', expected: 'application/json' },
      { fileName: 'config.yaml', ext: '.yaml', expected: 'application/x-yaml' },
      { fileName: 'config.yml', ext: '.yml', expected: 'application/x-yaml' },
      { fileName: 'script.py', ext: '.py', expected: 'text/x-python' },
      { fileName: 'model.data', ext: '.data', expected: 'application/octet-stream' },
      { fileName: 'model.index', ext: '.index', expected: 'application/octet-stream' },
    ];

    testCases.forEach(({ fileName, ext, expected }) => {
      expect(getDeepRacerFileType(fileName, ext)).toBe(expected);
    });
  });

  it('should return application/octet-stream for unknown file extensions', () => {
    expect(getDeepRacerFileType('test.unknown', '.unknown')).toBe('application/octet-stream');
  });

  it('should handle case-insensitive file extensions', () => {
    expect(getDeepRacerFileType('test.JSON', '.JSON')).toBe('application/json');
    expect(getDeepRacerFileType('test.YAML', '.YAML')).toBe('application/x-yaml');
  });
});

describe('uploadModelFiles', () => {
  const mockS3Client = {
    send: vi.fn(),
  };

  interface MockUpload {
    done: Mock;
    on: Mock;
  }

  let mockUpload: MockUpload;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpload = {
      done: vi.fn().mockResolvedValue({}),
      on: vi.fn().mockReturnThis(),
    };
    vi.mocked(S3Client).mockImplementation(() => mockS3Client as unknown as S3Client);
    vi.mocked(Upload).mockImplementation(() => mockUpload as unknown as Upload);
    vi.mocked(fetchAuthSession).mockResolvedValue({
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
      },
    });
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789012');
  });

  it('should successfully upload files with correct content types', async () => {
    const files = [
      new File(['content1'], 'model/model.pb', { type: 'application/octet-stream' }),
      new File(['content2'], 'model/checkpoint.meta', { type: 'application/octet-stream' }),
    ];

    const onProgress = vi.fn();
    const result = await uploadModelFiles(files, onProgress);

    expect(result).toBe('uploads/models/12345678-1234-1234-1234-123456789012');
    expect(Upload).toHaveBeenCalledTimes(2);
    expect(Upload).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          ContentType: 'application/octet-stream',
          Bucket: 'test-bucket',
        }),
      }),
    );
    expect(onProgress).toHaveBeenCalled();
  });

  it('should handle authentication failures', async () => {
    vi.mocked(fetchAuthSession).mockRejectedValueOnce(new Error('Authentication failed'));

    const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
    await expect(uploadModelFiles(files)).rejects.toThrow('Authentication failed. Please sign in again.');
  });

  it('should handle missing credentials', async () => {
    vi.mocked(fetchAuthSession).mockResolvedValueOnce({});

    const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
    await expect(uploadModelFiles(files)).rejects.toThrow('Authentication failed. Please sign in again.');
  });

  it('should handle access denied errors', async () => {
    const error = new Error('Access denied');
    mockUpload.done.mockRejectedValueOnce(error);

    const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
    await expect(uploadModelFiles(files)).rejects.toThrow(
      'You do not have permission to upload files. Please contact your administrator.',
    );
  });

  it('should filter out excluded system files', async () => {
    const files = [
      new File(['content'], '.DS_Store', { type: 'application/octet-stream' }),
      new File(['content'], 'Thumbs.db', { type: 'application/octet-stream' }),
      new File(['content'], 'desktop.ini', { type: 'application/octet-stream' }),
      new File(['content'], '._.DS_Store', { type: 'application/octet-stream' }),
      new File(['content'], 'model.pb', { type: 'application/octet-stream' }),
    ];

    await uploadModelFiles(files);
    expect(Upload).toHaveBeenCalledTimes(1);
    expect(Upload).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          Key: expect.stringContaining('model.pb'),
        }),
      }),
    );
  });

  it('should filter out compressed files', async () => {
    const files = [
      new File(['content'], 'model/archive.zip', { type: 'application/zip' }),
      new File(['content'], 'model/data.gz', { type: 'application/gzip' }),
      new File(['content'], 'model/model.pb', { type: 'application/octet-stream' }),
    ];

    await uploadModelFiles(files);
    expect(Upload).toHaveBeenCalledTimes(1);
    expect(Upload).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          Key: expect.stringContaining('model.pb'),
        }),
      }),
    );
  });

  it('should calculate and report progress correctly', async () => {
    const files = [
      new File(['content1'], 'model/file1.pb', { type: 'application/octet-stream' }),
      new File(['content2'], 'model/file2.pb', { type: 'application/octet-stream' }),
    ];

    const onProgress = vi.fn();
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    mockUpload.on.mockImplementation((event: string, callback: (progress: unknown) => void) => {
      if (event === 'httpUploadProgress') {
        // Simulate progress for each file
        callback({ loaded: files[0].size });
        callback({ loaded: files[1].size });
      }
      return mockUpload;
    });

    await uploadModelFiles(files, onProgress);

    const expectedProgress = Math.min(99, Math.round((files[0].size / totalBytes) * 100));
    expect(onProgress).toHaveBeenCalledWith(expectedProgress);
    expect(onProgress).toHaveBeenCalledWith(99);
  });

  it('should handle upload errors gracefully', async () => {
    const files = [new File(['content'], 'model/model.pb', { type: 'application/octet-stream' })];
    mockUpload.done.mockRejectedValueOnce(new Error('Network error'));

    await expect(uploadModelFiles(files)).rejects.toThrow('Failed to upload files. Please try again later.');
  });
});
