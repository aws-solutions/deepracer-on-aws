// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PassThrough } from 'node:stream';

import { CompleteMultipartUploadCommandOutput } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { AmazonS3URI, s3Client, s3Helper } from '@deepracer-indy/utils';
import archiver from 'archiver';
// @ts-expect-error archiver types incomplete
import ArchiverError from 'archiver/lib/error.js';

import { FileToArchive, s3Archiver } from '../S3Archiver.js';

vi.mock('@aws-sdk/lib-storage');
vi.mock('archiver');

vi.mock('@deepracer-indy/utils', async (importOriginal) => ({
  ...(await importOriginal()),
  s3Helper: {
    getReadableObjectFromS3: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  AmazonS3URI: vi.fn(() => ({
    bucket: 'test-bucket',
    key: 'archive.tar.gz',
  })),
}));

describe('S3Archiver', () => {
  let mockArchive: archiver.Archiver;
  let mockUpload: Upload;

  beforeEach(() => {
    mockArchive = {
      pipe: vi.fn(),
      on: vi.fn(),
      append: vi.fn(),
      finalize: vi.fn(() => Promise.resolve(undefined)),
    } as unknown as archiver.Archiver;

    mockUpload = {
      on: vi.fn(),
      done: vi.fn().mockResolvedValue({ Location: 's3://bucket/archive.tar.gz' }),
    } as unknown as Upload;

    vi.mocked(archiver).mockReturnValue(mockArchive);
    vi.mocked(Upload).mockReturnValue(mockUpload);
  });

  const mockFilesToArchive: FileToArchive[] = [
    { filename: 'file1.txt', s3Location: 's3://bucket/file1.txt' },
    { filename: 'file2.txt', s3Location: 's3://bucket/file2.txt' },
    { filename: 'file3.txt', s3Location: 's3://bucket/file3.txt' },
    { filename: 'file4.txt', s3Location: 's3://bucket/file4.txt' },
    { filename: 'file5.txt', s3Location: 's3://bucket/file5.txt' },
  ];
  const mockArchiveS3Destination = 's3://test-bucket/archive.tar.gz';

  describe('createS3Archive', () => {
    it('should create archive successfully', async () => {
      const mockStream = new PassThrough();
      const mockUploadResponse = {
        Bucket: 'test-bucket',
        Key: 'archive.tar.gz',
      } as CompleteMultipartUploadCommandOutput;
      vi.mocked(s3Helper.getReadableObjectFromS3).mockResolvedValue(mockStream);
      vi.mocked(mockUpload.done).mockResolvedValue(mockUploadResponse);

      const result = await s3Archiver.createS3Archive(mockFilesToArchive, mockArchiveS3Destination);

      expect(archiver).toHaveBeenCalledWith('tar', {
        gzip: true,
        gzipOptions: {
          level: 6,
        },
      });
      expect(mockArchive.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockArchive.on).toHaveBeenCalledWith('warning', expect.any(Function));
      expect(mockArchive.on).toHaveBeenCalledWith('progress', expect.any(Function));
      expect(AmazonS3URI).toHaveBeenCalledWith(mockArchiveS3Destination);
      expect(Upload).toHaveBeenCalledWith({
        client: s3Client,
        params: {
          Bucket: 'test-bucket',
          Key: 'archive.tar.gz',
          Body: expect.any(PassThrough),
          ContentType: 'application/gzip',
        },
      });
      expect(mockUpload.on).toHaveBeenCalledWith('httpUploadProgress', expect.any(Function));
      mockFilesToArchive.forEach((mockFile) => {
        expect(s3Helper.getReadableObjectFromS3).toHaveBeenCalledWith(mockFile.s3Location);
        expect(mockArchive.append).toHaveBeenCalledWith(mockStream, { name: mockFile.filename });
      });
      expect(mockArchive.finalize).toHaveBeenCalled();
      expect(result).toEqual(mockUploadResponse);
    });

    it('should handle archive errors', async () => {
      const mockError = new Error('Archive error');
      vi.mocked(mockArchive.on).mockImplementation((event: string, callback: (error: unknown) => void) => {
        if (event === 'error') {
          callback(mockError);
        }
        return {} as archiver.Archiver;
      });

      await expect(s3Archiver.createS3Archive(mockFilesToArchive, mockArchiveS3Destination)).rejects.toThrow(mockError);
    });

    it('should handle archive warnings', async () => {
      const mockWarningError = new ArchiverError('ENOENT', { message: 'File not found' });
      vi.mocked(mockArchive.on).mockImplementation((event: string, callback: (error: ArchiverError) => void) => {
        if (event === 'warning') {
          callback(mockWarningError);
        }
        return {} as archiver.Archiver;
      });

      const mockStream = new PassThrough();
      vi.mocked(s3Helper.getReadableObjectFromS3).mockResolvedValue(mockStream);

      await expect(s3Archiver.createS3Archive(mockFilesToArchive, mockArchiveS3Destination)).resolves.not.toThrow();
    });

    it('should handle non-ENOENT warnings as errors', async () => {
      const mockWarningError = new ArchiverError('OTHER_ERROR', { message: 'Other Error' });
      vi.mocked(mockArchive.on).mockImplementation((event: string, callback: (error: ArchiverError) => void) => {
        if (event === 'warning') {
          callback(mockWarningError);
        }
        return {} as archiver.Archiver;
      });

      await expect(s3Archiver.createS3Archive(mockFilesToArchive, mockArchiveS3Destination)).rejects.toThrow(
        mockWarningError,
      );
    });

    it('should handle S3 download errors', async () => {
      const mockError = new Error('S3 download error');
      vi.mocked(s3Helper.getReadableObjectFromS3).mockRejectedValue(mockError);

      await expect(s3Archiver.createS3Archive(mockFilesToArchive, mockArchiveS3Destination)).rejects.toThrow(mockError);
    });

    it('should handle upload errors', async () => {
      const mockStream = new PassThrough();
      vi.mocked(s3Helper.getReadableObjectFromS3).mockResolvedValue(mockStream);

      const mockError = new Error('Upload error');
      vi.mocked(mockUpload.done).mockRejectedValue(mockError);

      await expect(s3Archiver.createS3Archive(mockFilesToArchive, mockArchiveS3Destination)).rejects.toThrow(mockError);
    });
  });
});
