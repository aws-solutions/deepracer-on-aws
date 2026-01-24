// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  getGetGlobalSettingHandler,
  GetGlobalSettingServerInput,
  GetGlobalSettingServerOutput,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { globalSettingsHelper } from '../../utils/GlobalSettingsHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const GetGlobalSettingOperation: Operation<
  GetGlobalSettingServerInput,
  GetGlobalSettingServerOutput,
  HandlerContext
> = async (input, _context) => {
  try {
    const setting = await globalSettingsHelper.getGlobalSetting(input.key);
    return {
      value: setting,
    };
  } catch (err) {
    logger.error(`Error fetching global setting: ${err}`);
    throw new NotFoundError({ message: 'Failed to retrieve global setting for provided key.' });
  }
};

export const lambdaHandler = getApiGatewayHandler(
  getGetGlobalSettingHandler(instrumentOperation(GetGlobalSettingOperation)),
);
