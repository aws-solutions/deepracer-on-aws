// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from '@aws-sdk/client-s3';

import { getCustomUserAgent } from '#customUserAgent.js';
import { tracer } from '#powertools/powertools.js';

// `responseChecksumValidation` is set to 'WHEN_REQUIRED' to stop the SDK from adding
// checksum-mode response parameters (`x-amz-checksum-mode`, etc.) to presigned GET URLs.
// Those params are baked into the signature and cause 403s when browsers send Range
// requests for video streaming (S3 rejects partial-content responses signed with a
// full-object checksum). Only response validation is changed — `requestChecksumCalculation`
// is left at its default so upload data-integrity (writeToS3, copyObject) is preserved.
export const s3Client = tracer.captureAWSv3Client(
  new S3Client({
    customUserAgent: getCustomUserAgent(),
    responseChecksumValidation: 'WHEN_REQUIRED',
  }),
);
