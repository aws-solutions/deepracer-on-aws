// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InvocationType, InvokeCommand, InvokeCommandOutput } from '@aws-sdk/client-lambda';
import {
  BadRequestError,
  RewardFunctionError,
  RewardFunctionErrorType,
  TestRewardFunctionInput,
  TrackDirection,
  TrackId,
} from '@deepracer-indy/typescript-server-client';
import { mockClient } from 'aws-sdk-client-mock';
import { MockInstance } from 'vitest';

import { lambdaClient } from '../../../utils/clients/lambdaClient.js';
import { trackHelper } from '../../../utils/TrackHelper.js';
import {
  CLOCKWISE_TRACK_SUFFIX,
  COUNTER_CLOCKWISE_TRACK_SUFFIX,
  rewardFunctionValidator,
} from '../RewardFunctionValidator.js';

describe('RewardFunctionValidator', () => {
  describe('validateRewardFunction', () => {
    const mockLambdaClient = mockClient(lambdaClient);
    let hasSingleEnabledDirectionSpy: MockInstance<(typeof trackHelper)['hasSingleEnabledDirection']>;

    const mockEmptyErrors: RewardFunctionError[] = [];
    const mockErrors: RewardFunctionError[] = [
      { type: RewardFunctionErrorType.SYNTAX_ERROR, message: 'Failure', line: '5', lineNumber: 10 },
    ];
    const mockInputCW: TestRewardFunctionInput = {
      rewardFunction: 'def reward_function(params): return 1.0',
      trackConfig: {
        trackId: TrackId.ACE_SPEEDWAY,
        trackDirection: TrackDirection.CLOCKWISE,
      },
    };
    const mockInputCCW: TestRewardFunctionInput = {
      rewardFunction: 'def reward_function(params): return 1.0',
      trackConfig: {
        trackId: TrackId.ACE_SPEEDWAY,
        trackDirection: TrackDirection.COUNTER_CLOCKWISE,
      },
    };

    beforeEach(() => {
      mockLambdaClient.reset();
      hasSingleEnabledDirectionSpy = vi.spyOn(trackHelper, 'hasSingleEnabledDirection');
    });

    it('should return a list of errors when throwOnRewardFunctionErrors is false', async () => {
      hasSingleEnabledDirectionSpy.mockReturnValueOnce(true);
      mockLambdaClient.on(InvokeCommand).resolvesOnce({
        Payload: new TextEncoder().encode(
          JSON.stringify({ statusCode: 200, body: JSON.stringify(mockErrors) }),
        ) as InvokeCommandOutput['Payload'],
      });

      await expect(rewardFunctionValidator.validateRewardFunction(mockInputCCW, false)).resolves.toEqual({
        errors: mockErrors,
      });

      expect(mockLambdaClient).toHaveReceivedCommandWith(InvokeCommand, {
        FunctionName: process.env.REWARD_FUNCTION_VALIDATION_LAMBDA_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify({
          reward_function: mockInputCCW.rewardFunction,
          track_name: mockInputCCW.trackConfig.trackId,
        }),
      });
      expect(hasSingleEnabledDirectionSpy).toHaveBeenCalledWith(mockInputCCW.trackConfig.trackId);
    });

    it('should return an empty errors list when throwOnRewardFunctionErrors is true and reward function has no errors', async () => {
      hasSingleEnabledDirectionSpy.mockReturnValueOnce(false);
      mockLambdaClient.on(InvokeCommand).resolvesOnce({
        Payload: new TextEncoder().encode(
          JSON.stringify({ statusCode: 200, body: JSON.stringify(mockEmptyErrors) }),
        ) as InvokeCommandOutput['Payload'],
      });

      await expect(rewardFunctionValidator.validateRewardFunction(mockInputCW, true)).resolves.toEqual({
        errors: mockEmptyErrors,
      });

      expect(mockLambdaClient).toHaveReceivedCommandWith(InvokeCommand, {
        FunctionName: process.env.REWARD_FUNCTION_VALIDATION_LAMBDA_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify({
          reward_function: mockInputCW.rewardFunction,
          track_name: `${mockInputCW.trackConfig.trackId}${CLOCKWISE_TRACK_SUFFIX}`,
        }),
      });
      expect(hasSingleEnabledDirectionSpy).toHaveBeenCalledWith(mockInputCW.trackConfig.trackId);
    });

    it('should throw a BadRequestException when throwOnRewardFunctionErrors is true and reward function has errors', async () => {
      hasSingleEnabledDirectionSpy.mockReturnValueOnce(false);
      mockLambdaClient.on(InvokeCommand).resolvesOnce({
        Payload: new TextEncoder().encode(
          JSON.stringify({ statusCode: 200, body: JSON.stringify(mockErrors) }),
        ) as InvokeCommandOutput['Payload'],
      });

      await expect(rewardFunctionValidator.validateRewardFunction(mockInputCCW, true)).rejects.toThrow(BadRequestError);

      expect(mockLambdaClient).toHaveReceivedCommandWith(InvokeCommand, {
        FunctionName: process.env.REWARD_FUNCTION_VALIDATION_LAMBDA_NAME,
        InvocationType: InvocationType.RequestResponse,
        Payload: JSON.stringify({
          reward_function: mockInputCCW.rewardFunction,
          track_name: `${mockInputCCW.trackConfig.trackId}${COUNTER_CLOCKWISE_TRACK_SUFFIX}`,
        }),
      });
      expect(hasSingleEnabledDirectionSpy).toHaveBeenCalledWith(mockInputCCW.trackConfig.trackId);
    });

    it('should handle Python exception response (single object) and throw BadRequestException', async () => {
      hasSingleEnabledDirectionSpy.mockReturnValueOnce(false);
      const pythonException = [{ date: '2026-01-13T23:47:04.753520+00:00', message: 'Python exception occurred' }];
      mockLambdaClient.on(InvokeCommand).resolvesOnce({
        Payload: new TextEncoder().encode(
          JSON.stringify({ statusCode: 200, body: JSON.stringify(pythonException) }),
        ) as InvokeCommandOutput['Payload'],
      });

      await expect(rewardFunctionValidator.validateRewardFunction(mockInputCW, true)).rejects.toThrow(BadRequestError);
    });
  });
});
