// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { fetchAuthSession } from 'aws-amplify/auth';

import { environmentConfig } from '../../utils/envUtils.js';

// Determines content type for DeepRacer model files
export function getDeepRacerFileType(fileName: string, fileExtension: string): string {
  if (fileName === 'done') return 'text/plain';

  const deepRacerTypes: Record<string, string> = {
    '.meta': 'application/octet-stream',
    '.ckpt': 'application/octet-stream',
    '.pb': 'application/octet-stream',
    '.ready': 'text/plain',
    '.json': 'application/json',
    '.yaml': 'application/x-yaml',
    '.yml': 'application/x-yaml',
    '.py': 'text/x-python',
    '.data': 'application/octet-stream',
    '.index': 'application/octet-stream',
  };

  return deepRacerTypes[fileExtension.toLowerCase()] || 'application/octet-stream';
}

// Uploads model files to S3 using MultiPartUpload and returns the S3 prefix using random UUID.
export async function uploadModelFiles(
  files: File[],
  onProgress?: (progress: number, completedFile?: string) => void,
): Promise<string> {
  const modelUuid = crypto.randomUUID();
  const basePrefix = 'uploads/models';
  const s3Path = `${basePrefix}/${modelUuid}`;

  // Function to check if a file should be excluded
  const shouldExcludeFile = (file: File): boolean => {
    const excludedFiles = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '._.DS_Store'];

    if (excludedFiles.includes(file.name)) {
      return true;
    }

    if (file.name.endsWith('.gz') || file.name.endsWith('.zip')) {
      return true;
    }

    return false;
  };

  // Calculate total bytes excluding filtered files
  const totalBytes = Array.from(files)
    .filter((file) => !shouldExcludeFile(file))
    .reduce((sum, file) => sum + file.size, 0);
  let uploadedBytes = 0;

  let s3Client;
  try {
    const session = await fetchAuthSession();
    if (!session.credentials) {
      throw new Error('Authentication failed');
    }

    s3Client = new S3Client({
      region: environmentConfig.region,
      credentials: session.credentials,
      forcePathStyle: false,
    });
  } catch (error) {
    console.error('Error getting auth session:', error);
    throw new Error('Authentication failed. Please sign in again.');
  }

  try {
    for (const file of files) {
      if (shouldExcludeFile(file)) {
        continue;
      }
      const fileExtension = `.${file.name.split('.').pop()}`;
      // Handle both directory uploads (webkitRelativePath) and single file uploads
      const relativePath = file.webkitRelativePath ? file.webkitRelativePath.split('/').slice(1).join('/') : file.name;
      const s3Key = `${s3Path}/${relativePath}`;
      const fileStartOffset = uploadedBytes;

      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: environmentConfig.uploadBucketName,
          Key: s3Key,
          Body: file,
          ContentType: getDeepRacerFileType(file.name, fileExtension),
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      });

      upload.on('httpUploadProgress', (progress) => {
        if (progress.loaded) {
          const totalProgress = Math.min(99, Math.round(((fileStartOffset + progress.loaded) / totalBytes) * 100));
          onProgress?.(totalProgress);
        }
      });

      await upload.done();
      uploadedBytes += file.size;
      onProgress?.(Math.min(99, Math.round((uploadedBytes / totalBytes) * 100)), file.name);
    }
    return s3Path;
  } catch (error) {
    console.error('Error uploading files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('Access denied') || errorMessage.includes('permission')) {
      throw new Error('You do not have permission to upload files. Please contact your administrator.');
    } else {
      throw new Error('Failed to upload files. Please try again later.');
    }
  }
}
