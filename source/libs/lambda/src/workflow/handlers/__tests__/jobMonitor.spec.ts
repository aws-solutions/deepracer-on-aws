// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DescribeTrainingJobCommandOutput, TrainingJobStatus } from '@aws-sdk/client-sagemaker';
import { TEST_SUBMISSION_ITEM, TEST_TRAINING_ITEM } from '@deepracer-indy/database';
import { JobStatus } from '@deepracer-indy/typescript-server-client';
import { logger, s3Helper } from '@deepracer-indy/utils';
import { MockInstance } from 'vitest';

import { SimulationJobStatus } from '../../constants/simulation.js';
import { SimulationHeartbeatFile } from '../../types/simulationHeartbeatFile.js';
import type { WorkflowContext } from '../../types/workflowContext.js';
import { kinesisVideoStreamHelper } from '../../utils/KinesisVideoStreamHelper.js';
import { sageMakerHelper } from '../../utils/SageMakerHelper.js';
import { workflowHelper } from '../../utils/WorkflowHelper.js';
import { jobMonitor } from '../jobMonitor.js';

const MOCK_WORKFLOW_CONTEXT = {
  modelId: TEST_TRAINING_ITEM.modelId,
  jobName: TEST_TRAINING_ITEM.name,
  profileId: TEST_TRAINING_ITEM.profileId,
  simulationJob: {
    heartbeatS3Location: TEST_TRAINING_ITEM.assetS3Locations.simulationHeartbeatS3Location,
  },
  trainingJob: {
    name: TEST_TRAINING_ITEM.name,
    arn: TEST_TRAINING_ITEM.sageMakerJobArn,
    status: TrainingJobStatus.IN_PROGRESS,
  },
  videoStream: {
    arn: 'arn:aws:kinesisvideo:us-east-1:accountid:stream/streamname',
    name: TEST_TRAINING_ITEM.name,
  },
} satisfies WorkflowContext;

describe('JobMonitor', () => {
  const mockVideoStreamUrl = 'https://mock-hls-streaming-session-url';
  const mockVideoStreamUrl2 = 'https://mock-hls-streaming-session-url-2';
  const mockUrlExpirationExpired = new Date(Date.now() - 500_000).toISOString();
  const mockUrlExpirationNotExpired = new Date(Date.now() + 100_000).toISOString();

  let mockWorkflowContext: Required<WorkflowContext>;

  let checkSageMakerTrainingJobStatusSpy: MockInstance<(typeof jobMonitor)['checkSageMakerTrainingJobStatus']>;
  let checkSimulationJobStatusSpy: MockInstance<(typeof jobMonitor)['checkSimulationJobStatus']>;
  let getObjectAsStringFromS3Spy: MockInstance<(typeof s3Helper)['getObjectAsStringFromS3']>;
  let getTrainingJobSpy: MockInstance<(typeof sageMakerHelper)['getTrainingJob']>;
  let monitorJobSpy: MockInstance<(typeof jobMonitor)['monitorJob']>;
  let stopTrainingJobSpy: MockInstance<(typeof sageMakerHelper)['stopTrainingJob']>;

  beforeEach(() => {
    mockWorkflowContext = JSON.parse(JSON.stringify(MOCK_WORKFLOW_CONTEXT));

    checkSageMakerTrainingJobStatusSpy = vi.spyOn(jobMonitor, 'checkSageMakerTrainingJobStatus');
    checkSimulationJobStatusSpy = vi.spyOn(jobMonitor, 'checkSimulationJobStatus');
    getObjectAsStringFromS3Spy = vi.spyOn(s3Helper, 'getObjectAsStringFromS3');
    getTrainingJobSpy = vi.spyOn(sageMakerHelper, 'getTrainingJob');
    monitorJobSpy = vi.spyOn(jobMonitor, 'monitorJob');
    stopTrainingJobSpy = vi.spyOn(sageMakerHelper, 'stopTrainingJob');
  });

  describe('handler()', () => {
    it('should monitor the job successfully', async () => {
      monitorJobSpy.mockResolvedValueOnce();

      const result = await jobMonitor.handler(mockWorkflowContext);

      expect(monitorJobSpy).toHaveBeenCalledWith(mockWorkflowContext);
      expect(result).toStrictEqual(mockWorkflowContext);
      expect(result.errorDetails).toBeUndefined();
    });

    it('should handle errors during job monitoring gracefully', async () => {
      const mockError = new Error('Mock failure');
      monitorJobSpy.mockRejectedValueOnce(mockError);

      const result = await jobMonitor.handler(mockWorkflowContext);

      expect(result).toStrictEqual(mockWorkflowContext);
      expect(result.errorDetails).toEqual({ message: mockError.message, stack: mockError.stack });
    });
  });

  describe('monitorJob()', () => {
    it('should execute all monitoring steps', async () => {
      checkSimulationJobStatusSpy.mockResolvedValueOnce();
      checkSageMakerTrainingJobStatusSpy.mockResolvedValueOnce();
      vi.spyOn(jobMonitor, 'checkVideoStreamUrl').mockResolvedValueOnce();

      await expect(jobMonitor.monitorJob(mockWorkflowContext)).resolves.not.toThrow();

      expect(checkSimulationJobStatusSpy).toHaveBeenCalledWith(mockWorkflowContext);
      expect(checkSageMakerTrainingJobStatusSpy).toHaveBeenCalledWith(mockWorkflowContext);
      expect(jobMonitor.checkVideoStreamUrl).toHaveBeenCalledWith(mockWorkflowContext);
    });
  });

  describe('checkVideoStreamUrl()', () => {
    it('should skip check when training job is not in progress or missing video stream details', async () => {
      const mockContextTrainingFailed = {
        ...mockWorkflowContext,
        trainingJob: { ...mockWorkflowContext.trainingJob, status: TrainingJobStatus.FAILED },
      };
      const mockContextNoVideoStream = { ...mockWorkflowContext, videoStream: undefined };

      vi.spyOn(kinesisVideoStreamHelper, 'getHlsStreamingSessionUrl');

      await jobMonitor.checkVideoStreamUrl(mockContextTrainingFailed);
      expect(kinesisVideoStreamHelper.getHlsStreamingSessionUrl).not.toHaveBeenCalled();

      await jobMonitor.checkVideoStreamUrl(mockContextNoVideoStream);
      expect(kinesisVideoStreamHelper.getHlsStreamingSessionUrl).not.toHaveBeenCalled();
    });

    it('should refresh URL when video stream URL does not exist', async () => {
      const mockContextNoVideoStreamUrlExpiration: WorkflowContext = {
        ...mockWorkflowContext,
        leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
        videoStream: {
          ...mockWorkflowContext.videoStream,
          urlExpiration: undefined,
          url: undefined,
        },
      };
      vi.spyOn(kinesisVideoStreamHelper, 'getHlsStreamingSessionUrl').mockResolvedValue(mockVideoStreamUrl);

      await jobMonitor.checkVideoStreamUrl(mockContextNoVideoStreamUrlExpiration);

      expect(kinesisVideoStreamHelper.getHlsStreamingSessionUrl).toHaveBeenCalledWith(
        mockContextNoVideoStreamUrlExpiration.videoStream?.name,
      );
      expect(mockContextNoVideoStreamUrlExpiration.videoStream?.url).toEqual(mockVideoStreamUrl);
      expect(mockContextNoVideoStreamUrlExpiration.videoStream?.urlExpiration).toBeDefined();
    });

    it('should refresh URL when video stream URL is expired', async () => {
      const mockContextExpiredVideoStreamUrl = {
        ...mockWorkflowContext,
        leaderboardId: TEST_SUBMISSION_ITEM.leaderboardId,
        videoStream: {
          ...mockWorkflowContext.videoStream,
          url: mockVideoStreamUrl,
          urlExpiration: mockUrlExpirationExpired,
        },
      };
      vi.spyOn(kinesisVideoStreamHelper, 'getHlsStreamingSessionUrl').mockResolvedValue(mockVideoStreamUrl);

      await jobMonitor.checkVideoStreamUrl(mockContextExpiredVideoStreamUrl);

      expect(kinesisVideoStreamHelper.getHlsStreamingSessionUrl).toHaveBeenCalledWith(
        mockContextExpiredVideoStreamUrl.videoStream.name,
      );
      expect(mockContextExpiredVideoStreamUrl.videoStream?.urlExpiration).toBeDefined();
      expect(mockContextExpiredVideoStreamUrl.videoStream?.urlExpiration).not.toBe(mockUrlExpirationExpired);
    });

    it('should skip URL refresh when video stream URL exists and is not expired', async () => {
      const mockContextValidVideoStreamUrlExpiration = {
        ...mockWorkflowContext,
        videoStream: {
          ...mockWorkflowContext.videoStream,
          url: mockVideoStreamUrl,
          urlExpiration: mockUrlExpirationNotExpired,
        },
      };
      vi.spyOn(kinesisVideoStreamHelper, 'getHlsStreamingSessionUrl').mockResolvedValueOnce('mock-url-2');

      await jobMonitor.checkVideoStreamUrl(mockContextValidVideoStreamUrlExpiration);

      expect(kinesisVideoStreamHelper.getHlsStreamingSessionUrl).not.toHaveBeenCalled();
      expect(mockContextValidVideoStreamUrlExpiration.videoStream?.url).toEqual(mockVideoStreamUrl);
      expect(mockContextValidVideoStreamUrlExpiration.videoStream?.urlExpiration).toEqual(mockUrlExpirationNotExpired);
    });
  });

  describe('checkSimulationJobStatus()', () => {
    it('should throw error when simulation job or training job details are missing', async () => {
      const { simulationJob, ...mockInvalidContextNoSimulationJob } = mockWorkflowContext;
      const { trainingJob, ...mockInvalidContextNoTrainingJob } = mockWorkflowContext;

      await expect(jobMonitor.checkSimulationJobStatus(mockInvalidContextNoSimulationJob)).rejects.toThrow();
      await expect(jobMonitor.checkSimulationJobStatus(mockInvalidContextNoTrainingJob)).rejects.toThrow();

      expect(getObjectAsStringFromS3Spy).not.toHaveBeenCalled();
      expect(stopTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should handle missing heartbeat file gracefully', async () => {
      vi.spyOn(logger, 'warn');
      getObjectAsStringFromS3Spy.mockResolvedValueOnce('');

      await jobMonitor.checkSimulationJobStatus(mockWorkflowContext);

      expect(logger.warn).toHaveBeenCalledWith('Simulation heartbeat file does not exist yet.');

      expect(stopTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should handle failed simulation job', async () => {
      const mockHeartbeatFile: SimulationHeartbeatFile = {
        jobStatus: SimulationJobStatus.FAILED,
        message: 'Mock simulation failure',
      };

      getObjectAsStringFromS3Spy.mockResolvedValueOnce(JSON.stringify(mockHeartbeatFile));
      stopTrainingJobSpy.mockResolvedValueOnce();

      await expect(jobMonitor.checkSimulationJobStatus(mockWorkflowContext)).rejects.toThrow(
        'Simulation job failed: Mock simulation failure',
      );

      expect(stopTrainingJobSpy).toHaveBeenCalledWith(mockWorkflowContext.trainingJob?.name);
      expect(mockWorkflowContext.trainingJob?.status).toBe(TrainingJobStatus.STOPPED);
    });

    it('should handle error fetching heartbeat file', async () => {
      const mockS3Error = new Error('S3 access error');
      getObjectAsStringFromS3Spy.mockRejectedValueOnce(mockS3Error);

      await expect(jobMonitor.checkSimulationJobStatus(mockWorkflowContext)).rejects.toThrow(mockS3Error);

      expect(stopTrainingJobSpy).not.toHaveBeenCalled();
    });
  });

  describe('checkSageMakerTrainingJobStatus()', () => {
    it('should throw error when training job details are missing', async () => {
      const { trainingJob, ...mockInvalidContextNoTrainingJob } = mockWorkflowContext;

      await expect(jobMonitor.checkSageMakerTrainingJobStatus(mockInvalidContextNoTrainingJob)).rejects.toThrow();

      expect(getTrainingJobSpy).not.toHaveBeenCalled();
    });

    it('should update sagemaker training job status', async () => {
      getTrainingJobSpy.mockResolvedValueOnce({
        TrainingJobStatus: TrainingJobStatus.COMPLETED,
      } as DescribeTrainingJobCommandOutput);

      await jobMonitor.checkSageMakerTrainingJobStatus(mockWorkflowContext);

      expect(mockWorkflowContext.trainingJob?.status).toBe(TrainingJobStatus.COMPLETED);
    });
  });

  describe('persistWorkflowData()', () => {
    let mockContextWithUrl: WorkflowContext;
    let mockContextWithUrl2: WorkflowContext;
    let mockContextWithoutUrl: WorkflowContext;

    beforeEach(() => {
      mockContextWithUrl = {
        ...mockWorkflowContext,
        videoStream: {
          ...mockWorkflowContext.videoStream,
          url: mockVideoStreamUrl,
          urlExpiration: mockUrlExpirationNotExpired,
        },
      };
      mockContextWithUrl2 = {
        ...mockWorkflowContext,
        videoStream: {
          ...mockWorkflowContext.videoStream,
          url: mockVideoStreamUrl2,
          urlExpiration: mockUrlExpirationNotExpired,
        },
      };
      mockContextWithoutUrl = {
        ...mockWorkflowContext,
        videoStream: {
          ...mockWorkflowContext.videoStream,
          url: undefined,
          urlExpiration: undefined,
        },
      };
    });

    it('should update job when video stream url changes', async () => {
      vi.spyOn(workflowHelper, 'updateJob').mockResolvedValueOnce(TEST_TRAINING_ITEM);

      await jobMonitor.persistWorkflowData(mockContextWithUrl, mockContextWithUrl2);

      expect(workflowHelper.updateJob).toHaveBeenCalledWith(
        {
          jobName: mockContextWithUrl2.jobName,
          leaderboardId: mockContextWithUrl2.leaderboardId,
          modelId: mockContextWithUrl2.modelId,
          profileId: mockContextWithUrl2.profileId,
        },
        {
          videoStreamUrl: mockContextWithUrl2.videoStream?.url,
          status: JobStatus.IN_PROGRESS,
        },
      );
    });

    it('should skip job update when video stream url did not change', async () => {
      vi.spyOn(workflowHelper, 'updateJob').mockResolvedValueOnce(TEST_TRAINING_ITEM);

      await jobMonitor.persistWorkflowData(mockContextWithUrl, mockContextWithUrl);
      expect(workflowHelper.updateJob).not.toHaveBeenCalled();

      await jobMonitor.persistWorkflowData(mockContextWithoutUrl, mockContextWithoutUrl);
      expect(workflowHelper.updateJob).not.toHaveBeenCalled();
    });

    it('should gracefully handle error by not rejecting and updating workflowContext', async () => {
      const mockError = new Error('Failure');
      vi.spyOn(workflowHelper, 'updateJob').mockRejectedValueOnce(mockError);

      await expect(jobMonitor.persistWorkflowData(mockContextWithUrl, mockContextWithUrl2)).resolves.not.toThrow();

      expect(workflowHelper.updateJob).toHaveBeenCalledWith(
        {
          jobName: mockContextWithUrl2.jobName,
          leaderboardId: mockContextWithUrl2.leaderboardId,
          modelId: mockContextWithUrl2.modelId,
          profileId: mockContextWithUrl2.profileId,
        },
        {
          videoStreamUrl: mockContextWithUrl2.videoStream?.url,
          status: JobStatus.IN_PROGRESS,
        },
      );
      expect(mockContextWithUrl2.errorDetails).toEqual(mockError);
    });
  });
});
