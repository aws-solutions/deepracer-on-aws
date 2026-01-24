// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InvocationType, InvokeCommand } from '@aws-sdk/client-lambda';
import { _Object, CompleteMultipartUploadCommandOutput, ListObjectsV2CommandOutput } from '@aws-sdk/client-s3';
import {
  evaluationDao,
  modelDao,
  trainingDao,
  TEST_EVALUATION_ITEM,
  TEST_MODEL_ITEM,
  TEST_TRAINING_ITEM,
  TrainingItem,
  ResourceId,
  ModelItem,
  s3PathHelper,
} from '@deepracer-indy/database';
import {
  AssetType,
  BadRequestError,
  JobStatus,
  ModelStatus,
  NotFoundError,
} from '@deepracer-indy/typescript-server-client';
import { AmazonS3URI, s3Helper } from '@deepracer-indy/utils';
import { mockClient } from 'aws-sdk-client-mock';

import { lambdaClient } from '../../../utils/clients/lambdaClient.js';
import { FileToArchive, s3Archiver } from '../../../utils/S3Archiver.js';
import { workflowHelper } from '../../../workflow/utils/WorkflowHelper.js';
import { TEST_OPERATION_CONTEXT } from '../../constants/testConstants.js';
import { getAssetUrlOperation } from '../getAssetUrl.js';

vi.mock('../../../utils/S3Archiver.js');
vi.mock('#workflow/utils/WorkflowHelper.js');
vi.mock('@deepracer-indy/utils', async (importOriginal) => ({
  ...(await importOriginal()),
  AmazonS3URI: vi.fn(() => ({
    key: 'mock-key',
    bucket: 'modelBucket',
  })),
}));

describe('GetAssetUrlOperation', () => {
  const mockPresignedUrl = 'https://mock-presigned-url';
  const mockLambdaClient = mockClient(lambdaClient);

  beforeEach(() => {
    vi.spyOn(s3Helper, 'getPresignedUrl').mockResolvedValue(mockPresignedUrl);
    mockLambdaClient.reset();
  });

  describe('handler', () => {
    it('should return evaluation logs URL', async () => {
      const mockModelItem = { ...TEST_MODEL_ITEM, status: ModelStatus.READY };
      vi.spyOn(modelDao, 'load').mockResolvedValue(mockModelItem);
      vi.spyOn(getAssetUrlOperation, 'getEvaluationLogsArchiveAssetUrl').mockResolvedValue(mockPresignedUrl);

      const result = await getAssetUrlOperation.handler(
        {
          modelId: TEST_MODEL_ITEM.modelId,
          assetType: AssetType.EVALUATION_LOGS,
          evaluationId: TEST_EVALUATION_ITEM.evaluationId,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(getAssetUrlOperation.getEvaluationLogsArchiveAssetUrl).toHaveBeenCalledWith(
        mockModelItem,
        TEST_EVALUATION_ITEM.evaluationId,
      );
      expect(result.url).toBe(mockPresignedUrl);
    });

    it('should return training logs URL', async () => {
      const mockModelItem = { ...TEST_MODEL_ITEM, status: ModelStatus.READY };
      vi.spyOn(modelDao, 'load').mockResolvedValue(mockModelItem);
      vi.spyOn(getAssetUrlOperation, 'getTrainingLogsArchiveAssetUrl').mockResolvedValue(mockPresignedUrl);

      const result = await getAssetUrlOperation.handler(
        {
          modelId: TEST_MODEL_ITEM.modelId,
          assetType: AssetType.TRAINING_LOGS,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(getAssetUrlOperation.getTrainingLogsArchiveAssetUrl).toHaveBeenCalledWith(mockModelItem);
      expect(result.url).toBe(mockPresignedUrl);
    });

    it('should return physical model URL', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);
      vi.spyOn(getAssetUrlOperation, 'getPhysicalModelAssetUrl').mockResolvedValue(mockPresignedUrl);

      const result = await getAssetUrlOperation.handler(
        {
          modelId: TEST_MODEL_ITEM.modelId,
          assetType: AssetType.PHYSICAL_CAR_MODEL,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(getAssetUrlOperation.getPhysicalModelAssetUrl).toHaveBeenCalledWith(TEST_MODEL_ITEM);
      expect(result.url).toBe(mockPresignedUrl);
    });

    it('should return virtual model URL and status', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);
      vi.spyOn(getAssetUrlOperation, 'getVirtualModelAssetUrl').mockResolvedValue({ url: mockPresignedUrl });

      const result = await getAssetUrlOperation.handler(
        {
          modelId: TEST_MODEL_ITEM.modelId,
          assetType: AssetType.VIRTUAL_MODEL,
        },
        TEST_OPERATION_CONTEXT,
      );

      expect(result.url).toBe(mockPresignedUrl);
    });

    it('should throw BadRequestError for unsupported asset type', async () => {
      vi.spyOn(modelDao, 'load').mockResolvedValue(TEST_MODEL_ITEM);

      await expect(
        getAssetUrlOperation.handler(
          {
            modelId: TEST_MODEL_ITEM.modelId,
            assetType: 'UNSUPPORTED' as AssetType,
          },
          TEST_OPERATION_CONTEXT,
        ),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe('getFilesToArchive', () => {
    it('should return filtered files to archive', async () => {
      const mockListResponse = {
        Contents: [
          { Key: `${TEST_MODEL_ITEM.modelId}/metrics/file1.json` },
          { Key: `${TEST_MODEL_ITEM.modelId}/logs/file2.log` },
          { Key: `${TEST_MODEL_ITEM.modelId}/other/file3.txt` },
        ],
      } as ListObjectsV2CommandOutput;

      vi.spyOn(s3Helper, 'listObjects').mockResolvedValue(mockListResponse);

      const filterList = [/metrics/, /logs/];
      const result = await getAssetUrlOperation.getFilesToArchive(TEST_MODEL_ITEM, filterList);

      expect(result).toEqual([
        {
          filename: `${TEST_MODEL_ITEM.modelId}/metrics/file1.json`,
          s3Location: `s3://modelBucket/${TEST_MODEL_ITEM.modelId}/metrics/file1.json`,
        },
        {
          filename: `${TEST_MODEL_ITEM.modelId}/logs/file2.log`,
          s3Location: `s3://modelBucket/${TEST_MODEL_ITEM.modelId}/logs/file2.log`,
        },
      ]);
    });

    it('should throw error when no objects found', async () => {
      vi.spyOn(s3Helper, 'listObjects').mockResolvedValue({ Contents: [] as _Object[] } as ListObjectsV2CommandOutput);

      await expect(getAssetUrlOperation.getFilesToArchive(TEST_MODEL_ITEM, [/test/])).rejects.toThrow(NotFoundError);
    });
  });

  describe('getEvaluationLogsArchiveAssetUrl', () => {
    it('should throw BadRequestError when evaluationId is missing', async () => {
      await expect(getAssetUrlOperation.getEvaluationLogsArchiveAssetUrl(TEST_MODEL_ITEM)).rejects.toThrow(
        BadRequestError,
      );
    });

    it('should return evaluation logs URL', async () => {
      vi.spyOn(evaluationDao, 'load').mockResolvedValue(TEST_EVALUATION_ITEM);
      vi.spyOn(getAssetUrlOperation, 'getLogsArchiveAssetUrl').mockResolvedValue(mockPresignedUrl);

      const result = await getAssetUrlOperation.getEvaluationLogsArchiveAssetUrl(
        TEST_MODEL_ITEM,
        TEST_EVALUATION_ITEM.evaluationId,
      );

      expect(result).toBe(mockPresignedUrl);
    });
  });

  describe('getTrainingLogsArchiveAssetUrl', () => {
    it('should return training logs URL', async () => {
      vi.spyOn(trainingDao, 'load').mockResolvedValue(TEST_TRAINING_ITEM);
      vi.spyOn(getAssetUrlOperation, 'getLogsArchiveAssetUrl').mockResolvedValue(mockPresignedUrl);

      const result = await getAssetUrlOperation.getTrainingLogsArchiveAssetUrl(TEST_MODEL_ITEM);

      expect(result).toBe(mockPresignedUrl);
    });
  });

  describe('getLogsArchiveAssetUrl', () => {
    it('should return existing archive URL when available', async () => {
      const jobWithArchive = {
        ...TEST_TRAINING_ITEM,
        status: JobStatus.COMPLETED,
        assetS3Locations: {
          ...TEST_TRAINING_ITEM.assetS3Locations,
          logsArchiveS3Location: 's3://bucket/archive.tar.gz',
        },
      } satisfies TrainingItem;

      const result = await getAssetUrlOperation.getLogsArchiveAssetUrl(TEST_MODEL_ITEM, jobWithArchive);

      expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(jobWithArchive.assetS3Locations.logsArchiveS3Location);
      expect(result).toBe(mockPresignedUrl);
    });

    it('should create new archive when not available', async () => {
      const mockTrainingItem = { ...TEST_TRAINING_ITEM, status: JobStatus.COMPLETED } satisfies TrainingItem;
      const mockLogsArchiveS3Location = 's3://bucket/logs.tar.gz';
      const mockMetricsKey = 'metrics.json';
      const mockSimTraceKey = 'sim-trace/';
      const mockSimulationLogsKey = 'simulation.log';
      const mockTrainingLogsKey = 'training.log';

      const mockFilesToArchive = [
        {
          filename: 'metrics.json',
          s3Location: 's3://bucket/metrics.json',
        },
      ] satisfies FileToArchive[];
      vi.spyOn(getAssetUrlOperation, 'getFilesToArchive').mockResolvedValueOnce(mockFilesToArchive);
      vi.spyOn(s3PathHelper, 'getLogsArchiveS3Location').mockReturnValueOnce(mockLogsArchiveS3Location);
      vi.mocked(s3Archiver.createS3Archive).mockResolvedValueOnce({} as CompleteMultipartUploadCommandOutput);
      vi.mocked(workflowHelper.updateJob).mockResolvedValueOnce(mockTrainingItem);
      vi.mocked(AmazonS3URI).mockReturnValueOnce({
        key: mockMetricsKey,
        bucket: 'bucket',
        uri: mockTrainingItem.assetS3Locations.metricsS3Location,
      });
      vi.mocked(AmazonS3URI).mockReturnValueOnce({
        key: mockSimTraceKey,
        bucket: 'bucket',
        uri: mockTrainingItem.assetS3Locations.simTraceS3Location,
      });
      vi.mocked(AmazonS3URI).mockReturnValueOnce({
        key: mockSimulationLogsKey,
        bucket: 'bucket',
        uri: mockTrainingItem.assetS3Locations.simulationLogsS3Location as string,
      });
      vi.mocked(AmazonS3URI).mockReturnValueOnce({
        key: mockTrainingLogsKey,
        bucket: 'bucket',
        uri: mockTrainingItem.assetS3Locations.trainingLogsS3Location as string,
      });

      const result = await getAssetUrlOperation.getLogsArchiveAssetUrl(TEST_MODEL_ITEM, mockTrainingItem);

      expect(result).toBe(mockPresignedUrl);
      expect(AmazonS3URI).toHaveBeenCalledWith(mockTrainingItem.assetS3Locations.metricsS3Location);
      expect(AmazonS3URI).toHaveBeenCalledWith(mockTrainingItem.assetS3Locations.simTraceS3Location);
      expect(AmazonS3URI).toHaveBeenCalledWith(mockTrainingItem.assetS3Locations.simulationLogsS3Location);
      expect(AmazonS3URI).toHaveBeenCalledWith(mockTrainingItem.assetS3Locations.trainingLogsS3Location);
      expect(getAssetUrlOperation.getFilesToArchive).toHaveBeenCalledWith(
        TEST_MODEL_ITEM,
        [mockMetricsKey, mockSimTraceKey, mockSimulationLogsKey, mockTrainingLogsKey].map((k) => new RegExp(k)),
      );
      expect(s3Archiver.createS3Archive).toHaveBeenCalledWith(mockFilesToArchive, mockLogsArchiveS3Location);
      expect(workflowHelper.updateJob).toHaveBeenCalledWith(
        {
          modelId: mockTrainingItem.modelId,
          leaderboardId: undefined,
          jobName: mockTrainingItem.name,
          profileId: mockTrainingItem.profileId,
        },
        {
          ['assetS3Locations.logsArchiveS3Location']: mockLogsArchiveS3Location,
        },
      );
    });

    it('should throw BadRequestError for jobs not COMPLETED or FAILED', async () => {
      const incompleteJobStatuses = Object.values(JobStatus).filter(
        (status) => status !== JobStatus.COMPLETED && status !== JobStatus.FAILED,
      );

      for (const incompleteJobStatus of incompleteJobStatuses) {
        const incompleteJob = { ...TEST_TRAINING_ITEM, status: incompleteJobStatus };
        await expect(getAssetUrlOperation.getLogsArchiveAssetUrl(TEST_MODEL_ITEM, incompleteJob)).rejects.toThrow(
          BadRequestError,
        );
      }
    });

    it('should throw NotFoundError when no log files are found', async () => {
      const mockJobItem = { ...TEST_TRAINING_ITEM, status: JobStatus.COMPLETED } satisfies TrainingItem;

      vi.spyOn(getAssetUrlOperation, 'getFilesToArchive').mockResolvedValueOnce([]);

      await expect(getAssetUrlOperation.getLogsArchiveAssetUrl(TEST_MODEL_ITEM, mockJobItem)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('getPhysicalModelAssetUrl', () => {
    it('should return physical model URL', async () => {
      const result = await getAssetUrlOperation.getPhysicalModelAssetUrl(TEST_MODEL_ITEM);

      expect(result).toBe(mockPresignedUrl);
      expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(
        TEST_MODEL_ITEM.assetS3Locations.modelArtifactS3Location,
        300,
        `physicalmodel-${TEST_MODEL_ITEM.name}.tar.gz`,
      );
    });

    it('should throw NotFoundError when physical model artifact is missing', async () => {
      const modelWithoutArtifact = {
        ...TEST_MODEL_ITEM,
        assetS3Locations: { ...TEST_MODEL_ITEM.assetS3Locations, modelArtifactS3Location: undefined },
      };

      await expect(getAssetUrlOperation.getPhysicalModelAssetUrl(modelWithoutArtifact)).rejects.toThrow(NotFoundError);
    });
  });

  describe('getVirtualModelAssetUrl', () => {
    const now = Date.now();

    it('should return URL for valid and recent model', async () => {
      const modelWithValidPackage = {
        ...TEST_MODEL_ITEM,
        packagingStatus: ModelStatus.READY,
        packagedAt: new Date().toISOString(),
        updatedAt: new Date(now - 10000).toISOString(),
        assetS3Locations: {
          ...TEST_MODEL_ITEM.assetS3Locations,
          virtualModelArtifactS3Location: 's3://bucket/virtual-model.tar.gz',
        },
      } satisfies ModelItem;

      const result = await getAssetUrlOperation.getVirtualModelAssetUrl(modelWithValidPackage);

      expect(result.url).toBe(mockPresignedUrl);
      expect(s3Helper.getPresignedUrl).toHaveBeenCalledWith(
        modelWithValidPackage.assetS3Locations.virtualModelArtifactS3Location,
        900,
        `virtualmodel-${modelWithValidPackage.name}.tar.gz`,
      );
    });

    it('should return QUEUED status when packaging is queued', async () => {
      const queuedModel = { ...TEST_MODEL_ITEM, packagingStatus: ModelStatus.QUEUED } satisfies ModelItem;

      const result = await getAssetUrlOperation.getVirtualModelAssetUrl(queuedModel);

      expect(result.status).toBe(ModelStatus.QUEUED);
      expect(result.url).toBeUndefined();
    });

    it('should handle missing packagedAt', async () => {
      const modelWithoutDates = {
        ...TEST_MODEL_ITEM,
        packagedAt: undefined,
        updatedAt: new Date(Date.now() - 30000).toISOString(),
        packagingStatus: ModelStatus.READY,
        assetS3Locations: {
          ...TEST_MODEL_ITEM.assetS3Locations,
          virtualModelArtifactS3Location: 's3://test-bucket/virtual-model',
        },
      };

      const output = await getAssetUrlOperation.getVirtualModelAssetUrl(modelWithoutDates);

      expect(output.status).toBe(ModelStatus.QUEUED);
    });

    it('should trigger packaging for outdated virtual model', async () => {
      const outdatedModel = {
        ...TEST_MODEL_ITEM,
        packagedAt: new Date(now - 120000).toISOString(), // 2 minutes
        updatedAt: new Date(now).toISOString(),
        packagingStatus: ModelStatus.READY,
        assetS3Locations: {
          ...TEST_MODEL_ITEM.assetS3Locations,
          sageMakerArtifactsS3Location: 's3://bucket/prefix/model/artifacts',
        },
      } satisfies ModelItem;

      mockLambdaClient.on(InvokeCommand).resolves({});

      const output = await getAssetUrlOperation.getVirtualModelAssetUrl(outdatedModel);

      expect(output.status).toBe(ModelStatus.QUEUED);
      expect(mockLambdaClient).toHaveReceivedCommandWith(InvokeCommand, {
        FunctionName: process.env.ASSET_PACKAGING_LAMBDA_NAME,
        InvocationType: InvocationType.Event,
        Payload: expect.stringContaining('mock-key'),
      });
    });

    it('should handle race condition within buffer time', async () => {
      const raceConditionModel = {
        ...TEST_MODEL_ITEM,
        packagedAt: new Date(now - 45000).toISOString(), // 45 seconds
        updatedAt: new Date(now).toISOString(),
        packagingStatus: ModelStatus.READY,
        assetS3Locations: {
          ...TEST_MODEL_ITEM.assetS3Locations,
          virtualModelArtifactS3Location: 's3://test-bucket/virtual-model',
        },
      };

      const output = await getAssetUrlOperation.getVirtualModelAssetUrl(raceConditionModel);

      expect(output.url).toBe(mockPresignedUrl);
      expect(output.status).toBeUndefined();
    });

    it('should throw NotFoundError when model packaging is in ERROR state', async () => {
      const packagingErrorModel = {
        ...TEST_MODEL_ITEM,
        packagingStatus: ModelStatus.ERROR,
        packagingErrorRequestId: 'test-request-id-123',
      } satisfies ModelItem;

      vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);

      await expect(getAssetUrlOperation.getVirtualModelAssetUrl(packagingErrorModel)).rejects.toThrow(
        new NotFoundError({
          message:
            'Asset Packaging Failed: RequestID test-request-id-123. Please try again later or check logs for more details.',
        }),
      );

      expect(modelDao.update).toHaveBeenCalledWith(
        {
          modelId: TEST_MODEL_ITEM.modelId,
          profileId: TEST_OPERATION_CONTEXT.profileId,
        },
        {
          packagingStatus: undefined,
          packagingErrorRequestId: undefined,
        },
      );
    });

    it('should handle packaging error and invoke lambda', async () => {
      const modelWithError = {
        ...TEST_MODEL_ITEM,
        packagingStatus: ModelStatus.ERROR,
        packagingErrorRequestId: 'req-123',
      };
      vi.spyOn(modelDao, 'update').mockResolvedValue(TEST_MODEL_ITEM);

      await expect(getAssetUrlOperation.getVirtualModelAssetUrl(modelWithError)).rejects.toThrow(NotFoundError);
      expect(modelDao.update).toHaveBeenCalled();
    });
  });

  describe('sanitizeS3Key', () => {
    it('should remove leading path to model assets', () => {
      const key = 'some/path/to/model123/file.txt';
      const result = getAssetUrlOperation.sanitizeS3Key('model123' as ResourceId, key);
      expect(result).toBe('model123/file.txt');
    });
  });
});
