// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { S3Client } from '@aws-sdk/client-s3';

import { getCustomUserAgent } from '#customUserAgent.js';
import { tracer } from '#powertools/powertools.js';

export const s3Client = tracer.captureAWSv3Client(new S3Client({ customUserAgent: getCustomUserAgent() }));
