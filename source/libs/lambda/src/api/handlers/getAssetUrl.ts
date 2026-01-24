// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { InvocationType, InvokeCommand } from '@aws-sdk/client-lambda';
import type { Operation } from '@aws-smithy/server-common';
import {
  evaluationDao,
  JobItem,
  jobNameHelper,
  modelDao,
  ModelItem,
  ResourceId,
  s3PathHelper,
  SubmissionItem,
  trainingDao,
} from '@deepracer-indy/database';
import {
  BadRequestError,
  GetAssetUrlServerInput,
  GetAssetUrlServerOutput,
  getGetAssetUrlHandler,
  ModelStatus,
  NotFoundError,
  AssetType,
  JobStatus,
} from '@deepracer-indy/typescript-server-client';
import { s3Helper, AmazonS3URI, logger, metricsLogger } from '@deepracer-indy/utils';

import { lambdaClient } from '../../utils/clients/lambdaClient.js';
import { FileToArchive, s3Archiver } from '../../utils/S3Archiver.js';
import { workflowHelper } from '../../workflow/utils/WorkflowHelper.js';
import type { HandlerContext } from '../types/apiGatewayHandlerContext.js';
import { getApiGatewayHandler } from '../utils/apiGateway.js';
import { instrumentOperation } from '../utils/instrumentation/instrumentOperation.js';

export class GetAssetUrlOperation {
  handler: Operation<GetAssetUrlServerInput, GetAssetUrlServerOutput, HandlerContext> = async (input, context) => {
    const { profileId } = context;
    const modelId = input.modelId as ResourceId;
    const assetType = input.assetType;
    const evaluationId = input.evaluationId as ResourceId | undefined;

    const modelItem = await modelDao.load({ profileId, modelId });

    let url: string | undefined;
    let status: ModelStatus | undefined;

    switch (assetType) {
      case AssetType.EVALUATION_LOGS:
        url = await this.getEvaluationLogsArchiveAssetUrl(modelItem, evaluationId);
        break;
      case AssetType.TRAINING_LOGS:
        url = await this.getTrainingLogsArchiveAssetUrl(modelItem);
        break;
      case AssetType.PHYSICAL_CAR_MODEL:
        url = await this.getPhysicalModelAssetUrl(modelItem);
        metricsLogger.logDownloadModel({
          modelId,
        });
        break;
      case AssetType.VIRTUAL_MODEL:
        ({ url, status } = await this.getVirtualModelAssetUrl(modelItem));
        metricsLogger.logDownloadModel({
          modelId,
        });
        break;
      default:
        throw new BadRequestError({ message: 'This asset type is not supported.' });
    }

    return { url, status } satisfies GetAssetUrlServerOutput;
  };

  async getEvaluationLogsArchiveAssetUrl(modelItem: ModelItem, evaluationId?: ResourceId) {
    if (!evaluationId) {
      throw new BadRequestError({ message: 'evaluationId is required for evaluation logs.' });
    }

    const evaluationItem = await evaluationDao.load({ evaluationId, modelId: modelItem.modelId });

    const evaluationLogsArchiveAssetUrl = await this.getLogsArchiveAssetUrl(modelItem, evaluationItem);

    return evaluationLogsArchiveAssetUrl;
  }

  async getTrainingLogsArchiveAssetUrl(modelItem: ModelItem) {
    const trainingItem = await trainingDao.load({ modelId: modelItem.modelId });

    const trainingLogsArchiveAssetUrl = await this.getLogsArchiveAssetUrl(modelItem, trainingItem);

    return trainingLogsArchiveAssetUrl;
  }

  async getFilesToArchive(modelItem: ModelItem, fileFilterList: RegExp[]): Promise<FileToArchive[]> {
    const modelRootS3Uri = new AmazonS3URI(modelItem.assetS3Locations.modelRootS3Location);

    const modelFolderContents = (await s3Helper.listObjects(modelRootS3Uri.bucket, modelRootS3Uri.key)).Contents;

    if (!modelFolderContents?.length) {
      logger.error('No objects found in model s3 location', { modelRootS3Uri });
      throw new NotFoundError({ message: 'No model files found.' });
    }

    const filesToArchive = modelFolderContents
      .filter(({ Key }) => fileFilterList.some((filterKeyRegex) => filterKeyRegex.test(Key as string)))
      .map(({ Key }) => ({
        filename: this.sanitizeS3Key(modelItem.modelId, Key as string),
        s3Location: `s3://${modelRootS3Uri.bucket}/${Key}`,
      }));

    return filesToArchive;
  }

  async getLogsArchiveAssetUrl(modelItem: ModelItem, jobItem: JobItem) {
    if (jobItem.status !== JobStatus.COMPLETED && jobItem.status !== JobStatus.FAILED) {
      throw new BadRequestError({ message: 'Logs download is not available until job is complete.' });
    }

    if (jobItem.assetS3Locations.logsArchiveS3Location) {
      logger.info('Log archive already exists, generating presigned url for existing archive.');
      const logsArchiveUrl = await s3Helper.getPresignedUrl(jobItem.assetS3Locations.logsArchiveS3Location);
      return logsArchiveUrl;
    }

    logger.info(`Logs archive for ${jobItem.name} does not exist, creating archive.`);

    const metricsS3Key = new AmazonS3URI(jobItem.assetS3Locations.metricsS3Location).key;
    const simTraceFolderKey = new AmazonS3URI(jobItem.assetS3Locations.simTraceS3Location).key;
    const simulationLogsKey = jobItem.assetS3Locations.simulationLogsS3Location
      ? new AmazonS3URI(jobItem.assetS3Locations.simulationLogsS3Location).key
      : undefined;
    const trainingLogsKey = jobItem.assetS3Locations.trainingLogsS3Location
      ? new AmazonS3URI(jobItem.assetS3Locations.trainingLogsS3Location).key
      : undefined;

    const logFilterList = [metricsS3Key, simTraceFolderKey, simulationLogsKey, trainingLogsKey]
      .filter((v) => typeof v === 'string')
      .map((key) => new RegExp(key));

    const filesToArchive = await this.getFilesToArchive(modelItem, logFilterList);

    if (!filesToArchive.length) {
      logger.error(`Unable to find ${jobNameHelper.getJobType(jobItem.name)} log assets for ${jobItem.name}.`);
      throw new NotFoundError({ message: 'No log files found.' });
    }

    const logsArchiveS3Location = s3PathHelper.getLogsArchiveS3Location(
      modelItem.modelId,
      modelItem.profileId,
      jobItem.name,
    );

    await s3Archiver.createS3Archive(filesToArchive, logsArchiveS3Location);

    await workflowHelper.updateJob(
      {
        modelId: jobItem.modelId,
        leaderboardId: (jobItem as SubmissionItem).leaderboardId,
        jobName: jobItem.name,
        profileId: jobItem.profileId,
      },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ['assetS3Locations.logsArchiveS3Location' as any]: logsArchiveS3Location,
      },
    );

    logger.info('Generating presigned URL for logs archive.');

    const logsArchiveUrl = await s3Helper.getPresignedUrl(logsArchiveS3Location);

    return logsArchiveUrl;
  }

  async getPhysicalModelAssetUrl(modelItem: ModelItem) {
    if (!modelItem.assetS3Locations.modelArtifactS3Location) {
      throw new NotFoundError({ message: 'Unable to find physical model artifact.' });
    }

    logger.info('Generating presigned URL for physical model artifact.');

    const physicalModelAssetUrl = await s3Helper.getPresignedUrl(
      modelItem.assetS3Locations.modelArtifactS3Location,
      300,
      `physicalmodel-${modelItem.name}.tar.gz`,
    );

    return physicalModelAssetUrl;
  }

  async getVirtualModelAssetUrl(modelItem: ModelItem) {
    const PACKAGING_TIME_DELTA = 60000; // To prevent race conditions

    const virtualModelLocation = modelItem.assetS3Locations.virtualModelArtifactS3Location;
    const packagedAt = modelItem.packagedAt ? new Date(modelItem.packagedAt).getTime() : 0;
    const updatedAt = modelItem.updatedAt ? new Date(modelItem.updatedAt).getTime() : 0;

    // Generate signed URL if a valid package exists and model was not updated more recently than the package
    const isValidPackage =
      virtualModelLocation &&
      modelItem.packagingStatus === ModelStatus.READY &&
      packagedAt &&
      updatedAt &&
      (packagedAt >= updatedAt || updatedAt - packagedAt <= PACKAGING_TIME_DELTA);

    if (isValidPackage) {
      logger.info('Generating presigned URL for virtual model artifact.');
      const url = await s3Helper.getPresignedUrl(virtualModelLocation, 900, `virtualmodel-${modelItem.name}.tar.gz`);
      return { url };
    }

    // Check packaging status and handle accordingly
    if (modelItem.packagingStatus === ModelStatus.QUEUED) {
      logger.info(`Model packaging is currently queued for ${modelItem.modelId}. Waiting for completion`);
      return { status: ModelStatus.QUEUED };
    }

    if (modelItem.packagingStatus === ModelStatus.ERROR) {
      await modelDao.update(
        { modelId: modelItem.modelId, profileId: modelItem.profileId },
        {
          packagingStatus: undefined,
          packagingErrorRequestId: undefined,
        },
      );
      throw new NotFoundError({
        message: `Asset Packaging Failed: RequestID ${modelItem.packagingErrorRequestId}. Please try again later or check logs for more details.`,
      });
    }

    const modelRootS3Location = modelItem.assetS3Locations.modelRootS3Location;
    // Invoke if no valid package exists or model was updated more recently than the package

    if (!modelRootS3Location) {
      throw new NotFoundError({ message: 'Unable to find virtual model artifacts.' });
    }
    const rootArtifactsS3URI = new AmazonS3URI(modelRootS3Location);
    const sourcePrefix = rootArtifactsS3URI.key;
    const payload = JSON.stringify({ sourcePrefix });
    logger.info(`Invoking asset packaging lambda with payload: ${payload}`);
    const cmd = new InvokeCommand({
      FunctionName: process.env.ASSET_PACKAGING_LAMBDA_NAME,
      InvocationType: InvocationType.Event,
      Payload: payload,
    });
    await lambdaClient.send(cmd);
    logger.info(
      `Asset packaging lambda invoked successfully and queued for ${modelItem.modelId}. Waiting for packaging to complete.`,
    );
    return {
      status: ModelStatus.QUEUED,
    };
  }

  /**
   * Removes leading path to model assets s3 location.
   */
  sanitizeS3Key(modelId: ResourceId, key: string) {
    return key.slice(key.indexOf(modelId));
  }
}

export const getAssetUrlOperation = new GetAssetUrlOperation();

export const lambdaHandler = getApiGatewayHandler(
  getGetAssetUrlHandler(instrumentOperation(getAssetUrlOperation.handler)),
);
