// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  TrackId,
  TrackDirection,
  RewardFunctionError,
  RewardFunctionErrorType,
  TestRewardFunctionInput,
} from '@deepracer-indy/typescript-server-client';

import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { rewardFunctionValidator } from '../../utils/RewardFunctionValidator.js';
import { TestRewardFunctionOperation } from '../testRewardFunction.js';

describe('TestRewardFunction operation', () => {
  const mockInput: TestRewardFunctionInput = {
    rewardFunction: 'def reward_function(params): return 1.0',
    trackConfig: {
      trackDirection: TrackDirection.CLOCKWISE,
      trackId: TrackId.ACE_SPEEDWAY,
    },
  };

  it('should return a list of reward function errors', async () => {
    const mockErrors: RewardFunctionError[] = [
      { type: RewardFunctionErrorType.IMPORT_ERROR, message: 'Invalid', line: '5', lineNumber: 10 },
    ];
    const validateRewardFunctionSpy = vi
      .spyOn(rewardFunctionValidator, 'validateRewardFunction')
      .mockResolvedValueOnce({ errors: mockErrors });

    await expect(TestRewardFunctionOperation(mockInput, TEST_OPERATION_CONTEXT)).resolves.toEqual({
      errors: mockErrors,
    });

    expect(validateRewardFunctionSpy).toHaveBeenCalledWith(mockInput, false);
  });

  it('should re-throw errors from rewardFunctionValidator', async () => {
    const mockLambdaError = new Error('Lambda error');
    const validateRewardFunctionSpy = vi
      .spyOn(rewardFunctionValidator, 'validateRewardFunction')
      .mockRejectedValueOnce(mockLambdaError);

    await expect(TestRewardFunctionOperation(mockInput, TEST_OPERATION_CONTEXT)).rejects.toEqual(mockLambdaError);

    expect(validateRewardFunctionSpy).toHaveBeenCalledWith(mockInput, false);
  });
});
