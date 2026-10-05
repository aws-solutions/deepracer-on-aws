// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import { carLogAssetDao, type ResourceId } from '@deepracer-indy/database';
import {
  getListCarLogAssetsHandler,
  ListCarLogAssetsServerInput,
  ListCarLogAssetsServerOutput,
} from '@deepracer-indy/typescript-server-client';

import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { getCarLogAccess } from '../utils/carLogAccess.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';
import { toCarLogAssetResponse } from '../utils/toCarLogResponse.js';

/**
 * `GET /car-logs/assets` — list bags and videos.
 *
 * Racers always get their own assets (a `profileId` parameter is ignored); administrators,
 * facilitators and commentators get every racer's assets, or one racer's when `profileId` is given.
 * The `type` filter is applied in memory over each page, so a page can be empty while `token` is
 * still set — callers keep paginating until `token` is absent.
 */
export const ListCarLogAssetsOperation: Operation<
  ListCarLogAssetsServerInput,
  ListCarLogAssetsServerOutput,
  HandlerContext
> = async (input, context) => {
  const access = await getCarLogAccess(context.profileId);
  const { type, token, maxResults } = input;

  const targetProfileId = access === 'racer' ? context.profileId : (input.profileId as ResourceId | undefined);
  const page = targetProfileId
    ? await carLogAssetDao.listByProfile({ profileId: targetProfileId, cursor: token, maxResults })
    : await carLogAssetDao.listAll({ cursor: token, maxResults });

  return {
    assets: page.data.filter((asset) => !type || asset.assetType === type).map(toCarLogAssetResponse),
    token: page.cursor ?? undefined,
  } satisfies ListCarLogAssetsServerOutput;
};

export const lambdaHandler = getApiGatewayHandler(
  getListCarLogAssetsHandler(instrumentOperation(ListCarLogAssetsOperation)),
);
