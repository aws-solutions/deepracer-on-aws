// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { DescribeInstanceInformationCommand, type InstanceInformation } from '@aws-sdk/client-ssm';
import { logger, metrics } from '@deepracer-indy/utils';
import type { EventBridgeHandler } from 'aws-lambda';

import { ssmClient } from '#utils/clients/ssmClient.js';

import { syncInstance } from './deviceSync.js';
import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

/**
 * Scheduled device status poller.
 */
/** Sync one instance and report whether it counted toward the total and whether it is offline. */
const tallyInstance = async (info: InstanceInformation): Promise<{ synced: boolean; offline: boolean }> => {
  if (!(await syncInstance(info))) {
    return { synced: false, offline: false };
  }
  return { synced: true, offline: info.PingStatus !== 'Online' };
};

const publishOfflineRate = (offline: number, synced: number): void => {
  if (synced === 0) return;
  try {
    metrics.addMetric('DeviceOfflineRate', MetricUnit.Percent, (offline / synced) * 100);
  } catch (metricError) {
    logger.warn('Failed to publish DeviceOfflineRate metric', { metricError });
  }
};

export const PollDeviceStatus: EventBridgeHandler<'Scheduled Event', Record<string, never>, void> = async () => {
  let nextToken: string | undefined;
  let synced = 0;
  let seen = 0;
  let offline = 0;

  do {
    const response = await ssmClient.send(
      new DescribeInstanceInformationCommand({ NextToken: nextToken, MaxResults: 50 }),
    );

    for (const info of response.InstanceInformationList ?? []) {
      seen += 1;
      try {
        const tally = await tallyInstance(info);
        if (tally.synced) synced += 1;
        if (tally.offline) offline += 1;
      } catch (error) {
        logger.warn('Failed to sync managed instance during poll', { instanceId: info.InstanceId, error });
      }
    }

    nextToken = response.NextToken;
  } while (nextToken);

  publishOfflineRate(offline, synced);
  logger.info('Device status poll complete', { seen, synced, offline });
};

export const lambdaHandler = instrumentHandler(PollDeviceStatus);
