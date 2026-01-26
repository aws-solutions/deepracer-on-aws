// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { jobNameHelper } from './JobNameHelper.js';
import type { JobName } from '../types/jobName.js';

export class S3PathHelper {
  readonly modelDataBucket = process.env.MODEL_DATA_BUCKET_NAME as string;
  private readonly MODEL_METADATA_S3_OBJECT_KEY_SUFFIX = 'model_metadata.json';
  private readonly REWARD_FUNCTION_S3_OBJECT_KEY_SUFFIX = 'reward_function.py';
  private readonly SAGEMAKER_ARTIFACTS_S3_SUFFIX = 'sagemaker-artifacts/';

  getModelRootS3Location(modelId: string, profileId: string) {
    return `s3://${this.modelDataBucket}/${profileId}/models/${modelId}/`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/metrics/{jobType}/{timeStamp}-{jobName}.json` */
  getMetricsS3Location(modelId: string, profileId: string, jobName: JobName) {
    return `${this.getModelRootS3Location(modelId, profileId)}metrics/${jobNameHelper.getJobType(jobName)}/${new Date().toISOString()}-${jobName}.json`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/model_metadata.json` */
  getModelMetadataS3Location(modelId: string, profileId: string) {
    return `${this.getModelRootS3Location(modelId, profileId)}${this.MODEL_METADATA_S3_OBJECT_KEY_SUFFIX}`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/reward_function.py` */
  getRewardFunctionS3Location(modelId: string, profileId: string) {
    return `${this.getModelRootS3Location(modelId, profileId)}${this.REWARD_FUNCTION_S3_OBJECT_KEY_SUFFIX}`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/sagemaker-artifacts/` */
  getSageMakerArtifactsS3Location(modelId: string, profileId: string) {
    return `${this.getModelRootS3Location(modelId, profileId)}${this.SAGEMAKER_ARTIFACTS_S3_SUFFIX}`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/sim-trace/{jobType}/{timestamp}-{jobName}/` */
  getSimTraceS3Location(modelId: string, profileId: string, jobName: JobName) {
    return `${this.getModelRootS3Location(modelId, profileId)}sim-trace/${jobNameHelper.getJobType(jobName)}/${new Date().toISOString()}-${jobName}/`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/sagemaker-artifacts/training_params.yaml` */
  getSimulationYamlS3Location(modelId: string, profileId: string) {
    return `${this.getSageMakerArtifactsS3Location(modelId, profileId)}training_params.yaml`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/sagemaker-artifacts/{jobType}_job_status.json` */
  getSimulationHeartbeatS3Location(modelId: string, profileId: string, jobName: JobName) {
    return `${this.getSageMakerArtifactsS3Location(modelId, profileId)}${jobNameHelper.getJobType(jobName)}_job_status.json`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/videos/{jobType}/{timeStamp}-{jobName}/` */
  getVideosS3Location(modelId: string, profileId: string, jobName: JobName) {
    return `${this.getModelRootS3Location(modelId, profileId)}videos/${jobNameHelper.getJobType(jobName)}/${new Date().toISOString()}-${jobName}/`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/videos/{jobType}/{timeStamp}-{jobName}/camera-pip/0-video.mp4` */
  getPrimaryVideoS3Location(modelId: string, profileId: string, jobName: JobName) {
    return `${this.getVideosS3Location(modelId, profileId, jobName)}camera-pip/0-video.mp4`;
  }

  /** `s3://{modelBucket}/{profileId}/models/{modelId}/logs/{jobType}/{timeStamp}-{jobName}-{logType}.log` */
  getLogsS3Location(modelId: string, profileId: string, jobName: JobName, logType: string) {
    return `${this.getModelRootS3Location(modelId, profileId)}logs/${jobNameHelper.getJobType(jobName)}/${new Date().toISOString()}-${jobName}-${logType}.log`;
  }

  getLogsArchiveS3Location(modelId: string, profileId: string, jobName: JobName) {
    return `${this.getModelRootS3Location(modelId, profileId)}logs/${jobNameHelper.getJobType(jobName)}/${jobName}-logs.tar.gz`;
  }
}

export const s3PathHelper = new S3PathHelper();
