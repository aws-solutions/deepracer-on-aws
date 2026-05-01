// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from '@aws-sdk/client-s3';

import { getCustomUserAgent } from '#customUserAgent.js';
import { tracer } from '#powertools/powertools.js';

// `responseChecksumValidation` and `requestChecksumCalculation` are both set to
// 'WHEN_REQUIRED' to prevent the SDK from appending checksum parameters
// (`x-amz-checksum-mode`, `x-amz-checksum-crc32`, etc.) to presigned URLs.
// Those parameters are baked into the signature and cause 403s when browsers
// send Range requests for video streaming (S3 rejects partial-content responses
// that were signed with a full-object checksum).
export const s3Client = tracer.captureAWSv3Client(
  new S3Client({
    customUserAgent: getCustomUserAgent(),
    responseChecksumValidation: 'WHEN_REQUIRED',
    requestChecksumCalculation: 'WHEN_REQUIRED',
  }),
);
