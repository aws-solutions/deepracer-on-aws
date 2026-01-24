// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  APIName,
  CreateStreamCommand,
  DeleteStreamCommand,
  GetDataEndpointCommand,
  ResourceNotFoundException as KinesisVideoResourceNotFoundException,
} from '@aws-sdk/client-kinesis-video';
import {
  GetHLSStreamingSessionURLCommand,
  HLSPlaybackMode,
  ResourceNotFoundException as KinesisArchivedVideoResourceNotFoundException,
} from '@aws-sdk/client-kinesis-video-archived-media';
import { JobName, jobNameHelper } from '@deepracer-indy/database';
import { logger, logMethod } from '@deepracer-indy/utils';

import { getKvArchivedMediaClient, kvClient } from '../../utils/clients/kinesisVideoClient.js';
import { StreamDataRetentionInHours, KVS_MEDIA_TYPE } from '../constants/kvs.js';

class KinesisVideoStreamHelper {
  KINESIS_STREAMING_URL_MAX_EXPIRATION = 12 * 60 * 60; // 12 hours in seconds

  @logMethod
  async createStream(streamName: JobName) {
    try {
      const { StreamARN } = await kvClient.send(
        new CreateStreamCommand({
          StreamName: streamName,
          DataRetentionInHours: StreamDataRetentionInHours[jobNameHelper.getJobType(streamName)], // TODO: Assess if the values here make sense for indy
          MediaType: KVS_MEDIA_TYPE,
        }),
      );

      return StreamARN as string;
    } catch (error) {
      logger.error('Unable to create kinesis video stream', { streamName, error });
      throw error;
    }
  }

  @logMethod
  async getHlsStreamingSessionUrl(streamName: JobName) {
    try {
      const dataEndpoint = await this.getDataEndpoint(streamName, APIName.GET_HLS_STREAMING_SESSION_URL);
      const kvArchivedMediaClient = getKvArchivedMediaClient(dataEndpoint);

      const { HLSStreamingSessionURL } = await kvArchivedMediaClient.send(
        new GetHLSStreamingSessionURLCommand({
          StreamName: streamName,
          PlaybackMode: HLSPlaybackMode.LIVE,
          Expires: this.KINESIS_STREAMING_URL_MAX_EXPIRATION,
        }),
      );

      return HLSStreamingSessionURL;
    } catch (error) {
      if (error instanceof KinesisArchivedVideoResourceNotFoundException) {
        logger.warn('Kinesis video stream does not exist or is not streaming yet.', { streamName });
      } else {
        logger.error('Unable to get kinesis video stream HLS streaming session URL', { streamName, error });
      }
    }

    return null;
  }

  @logMethod
  async deleteStream(streamArn: string) {
    try {
      await kvClient.send(new DeleteStreamCommand({ StreamARN: streamArn }));
    } catch (error) {
      if (error instanceof KinesisVideoResourceNotFoundException) {
        logger.warn('Kinesis video stream was already deleted', { streamArn });
      } else {
        logger.error('Unable to delete kinesis video stream', { streamArn, error });
        throw error;
      }
    }
  }

  private async getDataEndpoint(streamName: JobName, apiName: APIName) {
    try {
      const { DataEndpoint } = await kvClient.send(
        new GetDataEndpointCommand({ APIName: apiName, StreamName: streamName }),
      );
      return DataEndpoint as string;
    } catch (error) {
      logger.error('Unable to get kinesis video stream data endpoint', { apiName, streamName, error });
      throw error;
    }
  }
}

export const kinesisVideoStreamHelper = new KinesisVideoStreamHelper();
