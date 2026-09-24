// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { deviceDao, type DeviceItem, type ResourceId } from '@deepracer-indy/database';
import {
  getListDevicesHandler,
  ListDevicesServerInput,
  ListDevicesServerOutput,
  NotAuthorizedError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdminOrFacilitator } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toDeviceResponse } from '../utils/toDeviceResponse.js';

/**
 * `GET /devices` — list devices, filterable by `deviceType`, `status`, and `fleetId`
 * Status is returned as persisted by the status poller; there is no live
 * `ssm:DescribeInstanceInformation` merge on the request path, avoiding SSM rate
 * limits.
 *
 * The most selective available index is queried (fleet → type → all). Type and all-devices
 * listings are cursor-paginated via the `token` in/out (@paginated); status (and, on the
 * fleet path, type) filters are applied in memory over each page. The fleet path returns the
 * complete membership in one response.
 *
 * Because those filters run in memory *after* a page is fetched, a page can be fully filtered
 * out — so `devices` may be empty while `token` is still non-null. Callers MUST keep paginating
 * until `token` is absent; an empty page does not imply there are no further matches.
 */
export const ListDevicesOperation: Operation<ListDevicesServerInput, ListDevicesServerOutput, HandlerContext> = async (
  input,
  context,
) => {
  const { profileId } = context;
  if (!(await isUserAdminOrFacilitator(profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId });
    throw new NotAuthorizedError({ message: 'Only administrators and facilitators can list devices.' });
  }

  const { deviceType, status, fleetId, token } = input;

  let items: DeviceItem[];
  let nextToken: string | undefined;
  if (fleetId) {
    // A fleet is a bounded subset; other callers (ListFleets counts, ListEventDevices) also
    // need the full membership, so this path returns the complete list in one response.
    items = await deviceDao.listByFleet(fleetId as ResourceId);
  } else if (deviceType) {
    const page = await deviceDao.listByType(deviceType, { cursor: token });
    items = page.data;
    nextToken = page.cursor ?? undefined;
  } else {
    const page = await deviceDao.listAll({ cursor: token });
    items = page.data;
    nextToken = page.cursor ?? undefined;
  }

  const devices = items
    .filter((item) => (!deviceType || item.deviceType === deviceType) && (!status || item.status === status))
    .map(toDeviceResponse);

  return { devices, token: nextToken } satisfies ListDevicesServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(getListDevicesHandler(instrumentOperation(ListDevicesOperation)));
