// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { KinesisVideoClient } from '@aws-sdk/client-kinesis-video';
import { KinesisVideoArchivedMediaClient } from '@aws-sdk/client-kinesis-video-archived-media';
import { KinesisVideoMediaClient } from '@aws-sdk/client-kinesis-video-media';
import { logger, tracer } from '@deepracer-indy/utils';
import { getCustomUserAgent } from '@deepracer-indy/utils/src/customUserAgent';

export const kvClient = tracer.captureAWSv3Client(
  new KinesisVideoClient({ logger, customUserAgent: getCustomUserAgent() }),
);

export const getKvArchivedMediaClient = (endpoint: string) =>
  tracer.captureAWSv3Client(
    new KinesisVideoArchivedMediaClient({ endpoint, logger, customUserAgent: getCustomUserAgent() }),
  );

export const getKvMediaClient = (endpoint: string) =>
  tracer.captureAWSv3Client(new KinesisVideoMediaClient({ endpoint, logger, customUserAgent: getCustomUserAgent() }));
