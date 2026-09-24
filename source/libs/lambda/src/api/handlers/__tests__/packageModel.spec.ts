// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { modelDao, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import {
  BadRequestError,
  InternalFailureError,
  ModelSource,
  ModelStatus,
  NotAuthorizedError,
  OptimizationStatus,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger } from '@deepracer-indy/utils';

import { lambdaClient } from '../../../utils/clients/lambdaClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { PackageModelOperation } from '../packageModel.js';

vi.mock('../../../utils/clients/lambdaClient.js', () => ({
  lambdaClient: { send: vi.fn().mockResolvedValue({}) },
}));

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);
vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const MODEL_OPTIMIZER_FUNCTION_NAME = 'test-model-optimizer-function';

beforeAll(() => {
  process.env.MODEL_OPTIMIZER_FUNCTION_NAME = MODEL_OPTIMIZER_FUNCTION_NAME;
});

afterAll(() => {
  delete process.env.MODEL_OPTIMIZER_FUNCTION_NAME;
});

describe('PackageModel operation', () => {
  beforeEach(() => {
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError for non-admin/facilitator users', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(
      PackageModelOperation(
        { modelId: TEST_MODEL_ITEM.modelId, profileId: TEST_MODEL_ITEM.profileId },
        TEST_OPERATION_CONTEXT,
      ),
    ).rejects.toThrow(NotAuthorizedError);
  });

  it('should invoke model optimizer and return modelId on success', async () => {
    const model = { ...TEST_MODEL_ITEM, status: ModelStatus.READY, modelSource: ModelSource.TRAINED };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);
    const logOptimizeSpy = vi.spyOn(metricsLogger, 'logOptimizeModel').mockImplementation(() => undefined);

    const output = await PackageModelOperation(
      { modelId: model.modelId, profileId: model.profileId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.modelId).toBe(model.modelId);
    expect(lambdaClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          FunctionName: MODEL_OPTIMIZER_FUNCTION_NAME,
          InvocationType: 'Event',
        }),
      }),
    );
    expect(logOptimizeSpy).toHaveBeenCalledWith({ optimizationType: 'virtual' });
  });

  it('should throw BadRequestError when model is not READY', async () => {
    const model = { ...TEST_MODEL_ITEM, status: ModelStatus.TRAINING };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    await expect(
      PackageModelOperation({ modelId: model.modelId, profileId: model.profileId }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when optimization is already IN_PROGRESS', async () => {
    const model = {
      ...TEST_MODEL_ITEM,
      status: ModelStatus.READY,
      optimizationStatus: OptimizationStatus.IN_PROGRESS,
    };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    await expect(
      PackageModelOperation({ modelId: model.modelId, profileId: model.profileId }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError for physical models', async () => {
    const model = {
      ...TEST_MODEL_ITEM,
      status: ModelStatus.READY,
      modelSource: ModelSource.IMPORTED_PHYSICAL,
    };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    await expect(
      PackageModelOperation({ modelId: model.modelId, profileId: model.profileId }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(BadRequestError);
  });

  it('should allow packaging when optimizationStatus is FAILED (re-trigger)', async () => {
    const model = {
      ...TEST_MODEL_ITEM,
      status: ModelStatus.READY,
      optimizationStatus: OptimizationStatus.FAILED,
      modelSource: ModelSource.TRAINED,
    };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    const output = await PackageModelOperation(
      { modelId: model.modelId, profileId: model.profileId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.modelId).toBe(model.modelId);
    expect(lambdaClient.send).toHaveBeenCalled();
  });

  it('should allow packaging when optimizationStatus is undefined (first time)', async () => {
    const model = {
      ...TEST_MODEL_ITEM,
      status: ModelStatus.READY,
      optimizationStatus: undefined,
      modelSource: ModelSource.TRAINED,
    };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    const output = await PackageModelOperation(
      { modelId: model.modelId, profileId: model.profileId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.modelId).toBe(model.modelId);
  });

  it('should allow re-invoke when model is already OPTIMIZED (optimizer handles as no-op)', async () => {
    const model = {
      ...TEST_MODEL_ITEM,
      status: ModelStatus.READY,
      optimizationStatus: OptimizationStatus.OPTIMIZED,
      modelSource: ModelSource.TRAINED,
    };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    const output = await PackageModelOperation(
      { modelId: model.modelId, profileId: model.profileId },
      TEST_OPERATION_CONTEXT,
    );

    expect(output.modelId).toBe(model.modelId);
    expect(lambdaClient.send).toHaveBeenCalled();
  });

  it('should throw when MODEL_OPTIMIZER_FUNCTION_NAME is not configured', async () => {
    delete process.env.MODEL_OPTIMIZER_FUNCTION_NAME;
    const model = { ...TEST_MODEL_ITEM, status: ModelStatus.READY, modelSource: ModelSource.TRAINED };
    vi.spyOn(modelDao, 'load').mockResolvedValue(model);

    await expect(
      PackageModelOperation({ modelId: model.modelId, profileId: model.profileId }, TEST_OPERATION_CONTEXT),
    ).rejects.toThrow(InternalFailureError);

    process.env.MODEL_OPTIMIZER_FUNCTION_NAME = MODEL_OPTIMIZER_FUNCTION_NAME;
  });
});
