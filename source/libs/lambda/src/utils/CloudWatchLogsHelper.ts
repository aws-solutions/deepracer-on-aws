// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Readable } from 'node:stream';

import { DescribeLogStreamsCommand, GetLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import { logger, logMethod, s3Helper } from '@deepracer-indy/utils';

import { cloudWatchLogsClient } from './clients/cloudWatchLogsClient.js';

class CloudWatchLogsHelper {
  /**
   * Uploads logs from a CloudWatch log stream to an s3 location.
   *
   * @param logGroupName Name of the log group
   * @param logStreamNamePrefix Prefix of the log stream name
   * @param s3Location S3 location to upload logs to
   * @returns A promise that resolves when the upload is complete
   */
  @logMethod
  async writeLogStreamToS3(logGroupName: string, logStreamNamePrefix: string, s3Location: string) {
    try {
      const describeLogStreamResponse = await cloudWatchLogsClient.send(
        new DescribeLogStreamsCommand({ logStreamNamePrefix, logGroupName }),
      );

      const logStreamName = describeLogStreamResponse.logStreams?.[0]?.logStreamName;

      if (!logStreamName) {
        throw new Error(`No logs found for logGroupName: ${logGroupName}, logStreamNamePrefix: ${logStreamNamePrefix}`);
      }

      const logEventsReadableStream = new LogEventsReadableStream(logGroupName, logStreamName);
      logEventsReadableStream.on('error', (error) => {
        throw error;
      });

      await s3Helper.writeToS3(logEventsReadableStream, s3Location);
    } catch (error) {
      logger.error('Failed to write log messages to S3.', { error });
      throw error;
    }
  }
}

// Exported for testing
export class LogEventsReadableStream extends Readable {
  private nextToken: string | undefined;
  private logGroupName: string;
  private logStreamName: string;

  constructor(logGroupName: string, logStreamName: string) {
    super();
    this.logGroupName = logGroupName;
    this.logStreamName = logStreamName;
  }

  async _read() {
    try {
      const getLogEventsResponse = await cloudWatchLogsClient.send(
        new GetLogEventsCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
          nextToken: this.nextToken,
          startFromHead: true,
        }),
      );

      const logEvents = getLogEventsResponse.events;

      if (logEvents?.length) {
        logger.info(`Found ${logEvents?.length} log events for upload`);

        const logMessages = logEvents.map((event) => event.message).join('\n') + '\n';
        this.push(logMessages);

        this.nextToken = getLogEventsResponse.nextForwardToken;
      } else {
        // End stream when no log events are found
        this.push(null);
      }
    } catch (error) {
      logger.error('Error getting log events', { error });
      this.destroy(error as Error);
    }
  }
}

export const cloudWatchLogsHelper = new CloudWatchLogsHelper();
