// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InvocationType, InvokeCommand } from '@aws-sdk/client-lambda';
import {
  BadRequestError,
  RewardFunctionError,
  TestRewardFunctionServerInput,
  TestRewardFunctionServerOutput,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { logger, logMethod } from '@deepracer-indy/utils';

import { lambdaClient } from '../../utils/clients/lambdaClient.js';
import { trackHelper } from '../../utils/TrackHelper.js';

export const CLOCKWISE_TRACK_SUFFIX = '_cw';
export const COUNTER_CLOCKWISE_TRACK_SUFFIX = '_ccw';

interface RewardFunctionValidationInput {
  reward_function: string;
  track_name: TrackId | `${TrackId}${typeof CLOCKWISE_TRACK_SUFFIX | typeof COUNTER_CLOCKWISE_TRACK_SUFFIX}`;
}

interface RewardFunctionValidationResponse {
  statusCode: 200;
  body: string;
}

class RewardFunctionValidator {
  @logMethod
  async validateRewardFunction(input: TestRewardFunctionServerInput, throwOnRewardFunctionErrors = true) {
    const { rewardFunction, trackConfig } = input;
    const { trackDirection, trackId } = trackConfig;

    const trackNameSuffix = trackHelper.hasSingleEnabledDirection(trackConfig.trackId)
      ? ''
      : trackDirection === TrackDirection.CLOCKWISE
        ? CLOCKWISE_TRACK_SUFFIX
        : COUNTER_CLOCKWISE_TRACK_SUFFIX;

    const rewardFunctionValidationInput: RewardFunctionValidationInput = {
      reward_function: rewardFunction,
      track_name: `${trackId}${trackNameSuffix}`,
    };

    logger.info('Reward function validation input', { rewardFunctionValidationInput });

    const { Payload } = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: process.env.REWARD_FUNCTION_VALIDATION_LAMBDA_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify(rewardFunctionValidationInput),
      }),
    );

    const rewardFunctionValidationResponse: RewardFunctionValidationResponse = JSON.parse(
      Buffer.from(Payload as Uint8Array).toString('utf-8'),
    );

    logger.info('Reward function validation response', { rewardFunctionValidationResponse });

    const rewardFunctionErrors: RewardFunctionError[] = JSON.parse(rewardFunctionValidationResponse.body);

    if (throwOnRewardFunctionErrors && rewardFunctionErrors.length) {
      throw new BadRequestError({
        message: 'The reward function is not valid. Address the reported issues and try again.',
      });
    }

    return {
      errors: rewardFunctionErrors,
    } satisfies TestRewardFunctionServerOutput;
  }
}

export const rewardFunctionValidator = new RewardFunctionValidator();
