// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceType } from '@deepracer-indy/database';
import type { AttributeValue, DynamoDBRecord } from 'aws-lambda';

/**
 * Car log stream routing for the BroadcastHandler.
 *
 * Fetch job rows and asset rows are turned into small "something changed" events pushed through
 * IoT Core so the Car Logs page can refresh. Topics are readable by every signed-in user (like the
 * device topics), so the events carry identifiers and status only: never keys, URLs, file or
 * racer names. The data itself is always read through the authorised API.
 */

type DDBImage = Record<string, AttributeValue>;

const JOB_PK_PREFIX = `${ResourceType.CAR_LOG_JOB}_`;
const ASSET_SK_PREFIX = `${ResourceType.CAR_LOG_ASSET}_`;

const attr = (image: DDBImage | undefined, key: string): string => image?.[key]?.S ?? '';

export type CarLogBroadcast =
  | { kind: 'job'; event: { eventType: 'CAR_LOG_JOB_UPDATED'; jobId: string; status: string; timestamp: string } }
  | {
      kind: 'asset';
      profileId: string;
      event: {
        eventType: 'CAR_LOG_ASSET_ADDED' | 'CAR_LOG_ASSET_DELETED';
        assetId: string;
        assetType: string;
        timestamp: string;
      };
    };

/** Builds the browser event for a car log job or asset stream record, or undefined if it is neither or needs none. */
export const buildCarLogBroadcast = (record: DynamoDBRecord): CarLogBroadcast | undefined => {
  const eventName = record.eventName;
  if (eventName !== 'INSERT' && eventName !== 'MODIFY' && eventName !== 'REMOVE') return undefined;

  const newImage = record.dynamodb?.NewImage as DDBImage | undefined;
  const oldImage = record.dynamodb?.OldImage as DDBImage | undefined;
  const image = newImage ?? oldImage;
  const timestamp = new Date().toISOString();

  if (attr(image, 'pk').startsWith(JOB_PK_PREFIX)) {
    const status = attr(newImage, 'status');
    if (eventName === 'REMOVE' || !status || (eventName === 'MODIFY' && status === attr(oldImage, 'status'))) {
      return undefined;
    }
    return {
      kind: 'job',
      event: { eventType: 'CAR_LOG_JOB_UPDATED', jobId: attr(newImage, 'jobId'), status, timestamp },
    };
  }

  if (attr(image, 'sk').startsWith(ASSET_SK_PREFIX)) {
    const profileId = attr(image, 'profileId');
    const assetId = attr(image, 'assetId');
    if (!profileId || !assetId) return undefined;
    return {
      kind: 'asset',
      profileId,
      event: {
        eventType: eventName === 'REMOVE' ? 'CAR_LOG_ASSET_DELETED' : 'CAR_LOG_ASSET_ADDED',
        assetId,
        assetType: attr(image, 'assetType'),
        timestamp,
      },
    };
  }

  return undefined;
};
