// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  getUpdateGlobalSettingHandler,
  InternalFailureError,
  NotAuthorizedError,
  UpdateGlobalSettingServerInput,
  UpdateGlobalSettingServerOutput,
} from '@deepracer-indy/typescript-server-client';
import { logger } from '@deepracer-indy/utils';

import { globalSettingsHelper } from '../../utils/GlobalSettingsHelper.js';
import { globalSettingsValidator } from '../../utils/GlobalSettingsValidator.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler, isUserAdmin } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const UpdateGlobalSettingOperation: Operation<
  UpdateGlobalSettingServerInput,
  UpdateGlobalSettingServerOutput,
  HandlerContext
> = async (input, context) => {
  if (!(await isUserAdmin(context.profileId))) {
    logger.warn('Admin auth failure', { action: 'ADMIN_AUTH_FAILURE', profileId: context.profileId });
    throw new NotAuthorizedError({ message: 'Not authorized.' });
  }

  globalSettingsValidator.validate(input.key, input.value);
  try {
    await globalSettingsHelper.setGlobalSetting(input.key, input.value);
    return { status: 200 };
  } catch (error) {
    throw new InternalFailureError({ message: 'Failed to update setting' });
  }
};

export const lambdaHandler = getApiGatewayHandler(
  getUpdateGlobalSettingHandler(instrumentOperation(UpdateGlobalSettingOperation)),
);
