// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { JobType } from '../../constants/jobType.js';
import { JobName } from '../../types/jobName.js';
import { jobNameHelper } from '../JobNameHelper.js';
import { s3PathHelper } from '../S3PathHelper.js';

describe('S3PathHelper', () => {
  const TEST_JOB_TYPE = JobType.TRAINING;
  const TEST_MODEL_ID = 'testModelId';
  const TEST_PROFILE_ID = 'testProfileId';
  const TEST_TIMESTAMP = new Date('2024-01-01').toISOString();
  const TEST_JOB_NAME = `deepracerindy-${JobType.TRAINING}-${TEST_MODEL_ID}` as JobName;

  const TEST_MODEL_ROOT = `s3://${process.env.MODEL_DATA_BUCKET_NAME}/${TEST_PROFILE_ID}/models/${TEST_MODEL_ID}/`;

  beforeEach(() => {
    vi.spyOn(jobNameHelper, 'getJobType').mockReturnValue(TEST_JOB_TYPE);
    vi.setSystemTime(new Date('2024-01-01'));
  });

  describe('getModelRootS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getModelRootS3Location(TEST_MODEL_ID, TEST_PROFILE_ID)).toBe(TEST_MODEL_ROOT);
    });
  });

  describe('getMetricsS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getMetricsS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME)).toBe(
        `${TEST_MODEL_ROOT}metrics/${TEST_JOB_TYPE}/${TEST_TIMESTAMP}-${TEST_JOB_NAME}.json`,
      );
    });
  });

  describe('getModelMetadataS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getModelMetadataS3Location(TEST_MODEL_ID, TEST_PROFILE_ID)).toBe(
        `${TEST_MODEL_ROOT}model_metadata.json`,
      );
    });
  });

  describe('getRewardFunctionS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getRewardFunctionS3Location(TEST_MODEL_ID, TEST_PROFILE_ID)).toBe(
        `${TEST_MODEL_ROOT}reward_function.py`,
      );
    });
  });

  describe('getSageMakerArtifactsS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getSageMakerArtifactsS3Location(TEST_MODEL_ID, TEST_PROFILE_ID)).toBe(
        `${TEST_MODEL_ROOT}sagemaker-artifacts/`,
      );
    });
  });

  describe('getSimTraceS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getSimTraceS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME)).toBe(
        `${TEST_MODEL_ROOT}sim-trace/${TEST_JOB_TYPE}/${TEST_TIMESTAMP}-${TEST_JOB_NAME}/`,
      );
    });
  });

  describe('getSimulationYamlS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getSimulationYamlS3Location(TEST_MODEL_ID, TEST_PROFILE_ID)).toBe(
        `${TEST_MODEL_ROOT}sagemaker-artifacts/training_params.yaml`,
      );
    });
  });

  describe('getSimulationHeartbeatS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getSimulationHeartbeatS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME)).toBe(
        `${TEST_MODEL_ROOT}sagemaker-artifacts/${TEST_JOB_TYPE}_job_status.json`,
      );
    });
  });

  describe('getVideosS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getVideosS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME)).toBe(
        `${TEST_MODEL_ROOT}videos/${TEST_JOB_TYPE}/${TEST_TIMESTAMP}-${TEST_JOB_NAME}/`,
      );
    });
  });

  describe('getPrimaryVideoS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getPrimaryVideoS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME)).toBe(
        `${TEST_MODEL_ROOT}videos/${TEST_JOB_TYPE}/${TEST_TIMESTAMP}-${TEST_JOB_NAME}/camera-pip/0-video.mp4`,
      );
    });
  });

  describe('getLogsS3Location()', () => {
    it('should return the correct s3 path', () => {
      const logType = 'simulation';
      expect(s3PathHelper.getLogsS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME, logType)).toBe(
        `${TEST_MODEL_ROOT}logs/${TEST_JOB_TYPE}/${TEST_TIMESTAMP}-${TEST_JOB_NAME}-${logType}.log`,
      );
    });
  });

  describe('getLogsArchiveS3Location()', () => {
    it('should return the correct s3 path', () => {
      expect(s3PathHelper.getLogsArchiveS3Location(TEST_MODEL_ID, TEST_PROFILE_ID, TEST_JOB_NAME)).toBe(
        `${TEST_MODEL_ROOT}logs/${TEST_JOB_TYPE}/${TEST_JOB_NAME}-logs.tar.gz`,
      );
    });
  });
});
