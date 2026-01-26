// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Operation } from '@aws-smithy/server-common';
import {
  getUpdateGlobalSettingHandler,
  InternalFailureError,
  UpdateGlobalSettingServerInput,
  UpdateGlobalSettingServerOutput,
} from '@deepracer-indy/typescript-server-client';

import { globalSettingsHelper } from '../../utils/GlobalSettingsHelper.js';
import { globalSettingsValidator } from '../../utils/GlobalSettingsValidator.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export const UpdateGlobalSettingOperation: Operation<
  UpdateGlobalSettingServerInput,
  UpdateGlobalSettingServerOutput,
  HandlerContext
> = async (input, _context) => {
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
