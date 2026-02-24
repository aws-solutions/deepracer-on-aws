// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CreateTrainingJobCommand,
  DescribeTrainingJobCommandOutput,
  SageMakerClient,
  StopTrainingJobCommand,
  TrainingJobStatus,
} from '@aws-sdk/client-sagemaker';
import { TEST_TRAINING_ITEM, TEST_MODEL_ITEM } from '@deepracer-indy/database';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SageMakerHyperparameters } from '../../types/sageMakerHyperparameters.js';
import { sageMakerHelper } from '../SageMakerHelper.js';

describe('SageMakerHelper', () => {
  const mockSageMakerClient = mockClient(SageMakerClient);
  const testTrainingJobArn = 'testTrainingJobArn';

  beforeEach(() => {
    mockSageMakerClient.reset();
    // Set required environment variables
    process.env.SAGEMAKER_TRAINING_IMAGE =
      '123456789012.dkr.ecr.us-east-1.amazonaws.com/deepracer-on-aws-sim-app:latest';
  });

  describe('createTrainingJob()', () => {
    it('should create a sagemaker training job based on the given jobItem and modelItem', async () => {
      const spyOnGetSageMakerHyperparameters = vi
        .spyOn(sageMakerHelper, 'getSageMakerHyperparameters')
        .mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient
        .on(CreateTrainingJobCommand, {
          TrainingJobName: TEST_TRAINING_ITEM.name,
          OutputDataConfig: {
            S3OutputPath: TEST_MODEL_ITEM.assetS3Locations.sageMakerArtifactsS3Location,
          },
          StoppingCondition: {
            MaxRuntimeInSeconds: TEST_TRAINING_ITEM.terminationConditions.maxTimeInMinutes * 60,
          },
          HyperParameters: {},
        })
        .resolves({ TrainingJobArn: testTrainingJobArn });

      await expect(
        sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM }),
      ).resolves.toBe(testTrainingJobArn);
      expect(spyOnGetSageMakerHyperparameters).toHaveBeenCalledWith(TEST_TRAINING_ITEM, TEST_MODEL_ITEM);
    });

    it('should use SAGEMAKER_INSTANCE_TYPE from env var when set', async () => {
      process.env.SAGEMAKER_INSTANCE_TYPE = 'ml.g4dn.2xlarge';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.ResourceConfig?.InstanceType).toBe('ml.g4dn.2xlarge');

      delete process.env.SAGEMAKER_INSTANCE_TYPE;
    });

    it('should enable RemoteDebugConfig when DEPLOYMENT_MODE is dev', async () => {
      process.env.DEPLOYMENT_MODE = 'dev';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.RemoteDebugConfig?.EnableRemoteDebug).toBe(true);

      delete process.env.DEPLOYMENT_MODE;
    });

    it('should disable RemoteDebugConfig when DEPLOYMENT_MODE is not dev', async () => {
      process.env.DEPLOYMENT_MODE = 'prod';

      vi.spyOn(sageMakerHelper, 'getSageMakerHyperparameters').mockResolvedValueOnce({} as SageMakerHyperparameters);

      mockSageMakerClient.on(CreateTrainingJobCommand).resolves({ TrainingJobArn: testTrainingJobArn });

      await sageMakerHelper.createTrainingJob({ jobItem: TEST_TRAINING_ITEM, modelItem: TEST_MODEL_ITEM });

      const calls = mockSageMakerClient.commandCalls(CreateTrainingJobCommand);
      expect(calls).toHaveLength(1);
      expect(calls[0].args[0].input.RemoteDebugConfig?.EnableRemoteDebug).toBe(false);

      delete process.env.DEPLOYMENT_MODE;
    });
  });

  describe('stopQueuedJob()', () => {
    const testJobName = TEST_TRAINING_ITEM.name;

    it('should stop job when it transitions from not-found to IN_PROGRESS', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob')
        .mockRejectedValueOnce(new Error('Job not found'))
        .mockResolvedValueOnce({
          TrainingJobStatus: TrainingJobStatus.IN_PROGRESS,
          $metadata: {},
        } as Partial<DescribeTrainingJobCommandOutput> as DescribeTrainingJobCommandOutput);

      mockSageMakerClient.on(StopTrainingJobCommand).resolves({});

      await sageMakerHelper.stopQueuedJob(testJobName, 10000, 100);

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(1);
    });

    it('should not stop job if already in terminal state', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.COMPLETED,
        $metadata: {},
      } as Partial<DescribeTrainingJobCommandOutput> as DescribeTrainingJobCommandOutput);

      await sageMakerHelper.stopQueuedJob(testJobName, 10000, 100);

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(0);
    });

    it('should throw InternalFailureError if job does not start within timeout period', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockRejectedValue(new Error('Job not found'));

      await expect(sageMakerHelper.stopQueuedJob(testJobName, 500, 100)).rejects.toThrow(
        'Failed to cancel job. Please check with your administrator',
      );

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(0);
    });

    it('should throw InternalFailureError when timeout is reached and job is still pending', async () => {
      vi.spyOn(sageMakerHelper, 'getTrainingJob').mockResolvedValue({
        TrainingJobStatus: TrainingJobStatus.STOPPING,
        $metadata: {},
      } as Partial<DescribeTrainingJobCommandOutput> as DescribeTrainingJobCommandOutput);

      await expect(sageMakerHelper.stopQueuedJob(testJobName, 300, 100)).rejects.toThrow(
        'Failed to cancel job. Please check with your administrator',
      );

      expect(mockSageMakerClient.commandCalls(StopTrainingJobCommand)).toHaveLength(0);
    });
  });
});
