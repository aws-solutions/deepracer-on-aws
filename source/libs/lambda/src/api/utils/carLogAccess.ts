// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ResourceId } from '@deepracer-indy/database';
import { InternalFailureError, UserGroups } from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { getUserGroups } from './apiGateway.js';

/**
 * What a caller may do with car logs:
 * - `manager`: administrators and facilitators — every racer's assets, fetch jobs, deletes.
 * - `viewer`: commentators — read-only access to every racer's assets (no downloads of raw bags).
 * - `racer`: everyone else — their own assets only.
 */
export type CarLogAccess = 'manager' | 'viewer' | 'racer';

export async function getCarLogAccess(profileId: ResourceId): Promise<CarLogAccess> {
  const groups = await getUserGroups(profileId);
  if (groups.includes(UserGroups.ADMIN) || groups.includes(UserGroups.RACE_FACILITATORS)) {
    return 'manager';
  }
  if (groups.includes(UserGroups.COMMENTATORS)) {
    return 'viewer';
  }
  return 'racer';
}

/** Reads a required environment variable, failing the request with a generic error when it is missing. */
export function requireCarLogEnv(name: 'DEVICE_LOGS_BUCKET_NAME' | 'CAR_LOG_STATE_MACHINE_ARN'): string {
  const value = process.env[name];
  if (!value) {
    logger.error('Missing required environment variable', { variable: name });
    throw new InternalFailureError({ message: 'Service configuration error.' });
  }
  return value;
}
