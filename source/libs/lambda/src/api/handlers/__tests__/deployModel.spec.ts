// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { deploymentDao, deviceDao, modelDao, profileDao, TEST_PROFILE_ID_1 } from '@deepracer-indy/database';
import {
  BadRequestError,
  CarType,
  DeploymentStatus,
  InternalFailureError,
  ModelStatus,
  NotAuthorizedError,
  OptimizationStatus,
} from '@deepracer-indy/typescript-server-client';
import { metricsLogger, s3Helper } from '@deepracer-indy/utils';

import { sfnClient } from '../../../utils/clients/sfnClient.js';
import { ssmClient } from '../../../utils/clients/ssmClient.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { DeployModelOperation } from '../deployModel.js';

vi.mock('../../../utils/clients/sfnClient.js', () => ({
  sfnClient: { send: vi.fn() },
}));

vi.mock('../../../utils/clients/ssmClient.js', () => ({
  ssmClient: { send: vi.fn() },
}));

vi.mock('../../utils/apiGateway.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/apiGateway.js')>();
  return { ...actual, isUserAdminOrFacilitator: (...args: unknown[]) => mockIsUserAdminOrFacilitator(...args) };
});

const mockIsUserAdminOrFacilitator = vi.fn().mockResolvedValue(true);

const TEST_MODEL = {
  modelId: 'model-1',
  profileId: TEST_PROFILE_ID_1,
  name: 'My Model',
  status: ModelStatus.READY,
  optimizationStatus: OptimizationStatus.OPTIMIZED,
  optimizedArtifactsS3Prefix: 'p1/models/model-1/optimized/',
};

const TEST_DEVICE = {
  instanceId: 'i-1234567890',
  name: 'My Car',
  carType: CarType.DEEPRACER_RPI,
  deviceType: 'CAR',
  status: 'ACTIVE',
};

const validInput = {
  modelId: 'model-1',
  profileId: TEST_PROFILE_ID_1,
  carInstanceId: 'i-1234567890',
  eventId: 'event-1',
};

beforeAll(() => {
  process.env.MODEL_DATA_BUCKET_NAME = 'test-model-bucket';
  process.env.PUSH_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:push-sf';
});

afterAll(() => {
  delete process.env.MODEL_DATA_BUCKET_NAME;
  delete process.env.PUSH_STATE_MACHINE_ARN;
});

describe('DeployModel operation', () => {
  beforeEach(() => {
    vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL as never);
    vi.spyOn(deviceDao, 'load').mockResolvedValue(TEST_DEVICE as never);
    vi.spyOn(profileDao, 'load').mockResolvedValue({ alias: 'TestRacer' } as never);
    vi.spyOn(deploymentDao, 'listAllByModel').mockResolvedValue([] as never);
    vi.spyOn(deploymentDao, 'create').mockResolvedValue({} as never);
    vi.spyOn(deploymentDao, 'updateStatus').mockResolvedValue({} as never);
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue('https://presigned-url.example.com');
    vi.mocked(ssmClient.send).mockResolvedValue({
      InstanceInformationList: [{ PingStatus: 'Online' }],
    } as never);
    vi.mocked(sfnClient.send).mockResolvedValue({} as never);
    mockIsUserAdminOrFacilitator.mockResolvedValue(true);
  });

  it('should throw NotAuthorizedError when caller is not admin or facilitator', async () => {
    mockIsUserAdminOrFacilitator.mockResolvedValueOnce(false);

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(NotAuthorizedError);
  });

  it('should create deployment and start step function on success', async () => {
    const logDeploySpy = vi.spyOn(metricsLogger, 'logDeployModel').mockImplementation(() => undefined);

    const output = await DeployModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(output.deploymentId).toBeDefined();
    expect(output.modelId).toBe('model-1');
    expect(output.carInstanceId).toBe('i-1234567890');
    expect(output.status).toBe(DeploymentStatus.PENDING);
    expect(sfnClient.send).toHaveBeenCalled();
    expect(deploymentDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'model-1',
        carInstanceId: 'i-1234567890',
        status: DeploymentStatus.PENDING,
      }),
    );
    expect(logDeploySpy).toHaveBeenCalledWith();
  });

  it('should pass the model owner alias as racerName to the step function', async () => {
    await DeployModelOperation(validInput, TEST_OPERATION_CONTEXT);

    const command = vi.mocked(sfnClient.send).mock.calls[0][0] as { input: { input: string } };
    expect(JSON.parse(command.input.input)).toEqual(expect.objectContaining({ racerName: 'TestRacer' }));
  });

  it('should select rpi-model.tar.gz for DEEPRACER_RPI carType', async () => {
    await DeployModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(expect.stringContaining('rpi-model.tar.gz'), 600);
  });

  it('should select openvino-model.tar.gz for DEEPRACER_CUSTOM carType', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ ...TEST_DEVICE, carType: CarType.DEEPRACER_CUSTOM } as never);

    await DeployModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(expect.stringContaining('openvino-model.tar.gz'), 600);
  });

  it('should select pb-only-model.tar.gz for DEEPRACER (stock) carType', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ ...TEST_DEVICE, carType: CarType.DEEPRACER } as never);

    await DeployModelOperation(validInput, TEST_OPERATION_CONTEXT);

    expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(expect.stringContaining('pb-only-model.tar.gz'), 600);
  });

  it('should throw BadRequestError when model is not OPTIMIZED', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL, optimizationStatus: undefined } as never);

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when car is offline', async () => {
    vi.mocked(ssmClient.send).mockResolvedValueOnce({
      InstanceInformationList: [{ PingStatus: 'ConnectionLost' }],
    } as never);

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when carType is not set', async () => {
    vi.spyOn(deviceDao, 'load').mockResolvedValue({ ...TEST_DEVICE, carType: undefined } as never);

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when deployment already in progress', async () => {
    vi.spyOn(deploymentDao, 'listAllByModel').mockResolvedValue([
      { carInstanceId: 'i-1234567890', status: DeploymentStatus.IN_PROGRESS },
    ] as never);

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should throw BadRequestError when optimizedArtifactsS3Prefix is missing', async () => {
    vi.spyOn(modelDao, 'load').mockResolvedValue({ ...TEST_MODEL, optimizedArtifactsS3Prefix: undefined } as never);

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(BadRequestError);
  });

  it('should throw when MODEL_DATA_BUCKET_NAME is not configured', async () => {
    delete process.env.MODEL_DATA_BUCKET_NAME;

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);

    process.env.MODEL_DATA_BUCKET_NAME = 'test-model-bucket';
  });

  it('should throw when PUSH_STATE_MACHINE_ARN is not configured', async () => {
    delete process.env.PUSH_STATE_MACHINE_ARN;
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue('https://presigned-url.example.com');

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow(InternalFailureError);

    process.env.PUSH_STATE_MACHINE_ARN = 'arn:aws:states:us-east-1:123456789012:stateMachine:push-sf';
  });

  it('should mark deployment FAILED when Step Function start fails', async () => {
    vi.mocked(sfnClient.send).mockRejectedValueOnce(new Error('AccessDeniedException'));

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow('AccessDeniedException');

    expect(deploymentDao.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DeploymentStatus.FAILED,
        expectedStatus: DeploymentStatus.PENDING,
        errorMessage: 'Failed to start deployment execution',
      }),
    );
  });

  it('should still throw original SFN error when rollback updateStatus also fails', async () => {
    vi.mocked(sfnClient.send).mockRejectedValueOnce(new Error('AccessDeniedException'));
    vi.spyOn(deploymentDao, 'updateStatus').mockRejectedValueOnce(new Error('DDB throttle'));

    await expect(DeployModelOperation(validInput, TEST_OPERATION_CONTEXT)).rejects.toThrow('AccessDeniedException');
  });
});
