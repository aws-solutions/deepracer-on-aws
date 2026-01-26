// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NestedStack, NestedStackProps, Duration, CfnOutput } from 'aws-cdk-lib';
import { ComputeType } from 'aws-cdk-lib/aws-codebuild';
import { Repository } from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

import { getImageTag } from './utils/helpers.js';
import {
  EcrImageDownloaderWithTrigger,
  ImageRepositoryMapping,
} from '../constructs/ecr-image-downloader/ecrImageDownloaderWithTrigger.js';
import { EcrRepository } from '../constructs/storage/ecr.js';

export interface EcrImageConfig {
  /**
   * The public ECR image URI to download (without tag)
   * Format: public.ecr.aws/registry/repository
   */
  publicImageUri: string;

  /**
   * The image tag to use
   * @default 'latest'
   */
  imageTag?: string;

  /**
   * The name for the private ECR repository where this image will be stored
   */
  privateRepositoryName: string;

  /**
   * the identifier used in the collection of images passed around between components
   * would be set to the values of the repo names in the context
   */
  repositoryId: string;
}

export interface EcrStackProps extends NestedStackProps {
  /**
   * Whether to empty the repositories when the stack is deleted
   * @default false
   */
  emptyOnDelete?: boolean;

  /**
   * Maximum number of images to keep in each repository
   * @default 20
   */
  maxImageCount?: number;

  /**
   * Array of image configurations specifying public images and their target private repositories
   */
  imageConfigs: EcrImageConfig[];

  /**
   * Project name prefix for the image downloader
   * @default 'DeepRacerIndy-ImageDownloader'
   */
  projectNamePrefix?: string;

  /**
   * Timeout for the image download process
   * @default Duration.hours(2)
   */
  downloadTimeout?: Duration;

  /**
   * Compute type for the image downloader
   * @default ComputeType.MEDIUM
   */
  computeType?: ComputeType;

  /**
   * The namespace for this deployment
   */
  namespace: string;
}

export class EcrStack extends NestedStack {
  public readonly repositories: Repository[];
  public readonly imageRepositoryMappings: ImageRepositoryMapping[];
  public readonly imageDownloader: EcrImageDownloaderWithTrigger;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    // Override the nested stack name to be shorter
    const shortStackProps = {
      ...props,
      // Use a short, descriptive nested stack name (max 30 chars)
      stackName: 'ECR-Stack',
    };

    super(scope, id, shortStackProps);

    const {
      emptyOnDelete = false,
      maxImageCount = 20,
      imageConfigs = [],
      projectNamePrefix = 'DeepRacerIndy-ImageDownloader',
      downloadTimeout = Duration.hours(2),
      computeType = ComputeType.MEDIUM,
      namespace,
    } = props;

    // Create one ECR repository for each image configuration
    this.repositories = [];
    this.imageRepositoryMappings = [];

    imageConfigs.forEach((imageConfig, index) => {
      // Use the specified private repository name
      const { repositoryId, privateRepositoryName } = imageConfig;

      // Create ECR repository for this specific image
      const ecrRepository = new EcrRepository(this, `EcrRepo${index}`, {
        repositoryName: privateRepositoryName,
        emptyOnDelete,
        maxImageCount,
      });

      this.repositories.push(ecrRepository.repository);
      this.imageRepositoryMappings.push({
        publicImageUri: imageConfig.publicImageUri,
        imageTag: getImageTag(imageConfig.imageTag),
        repository: ecrRepository.repository,
        privateRepositoryName,
        repositoryId,
      });

      // Output repository details for each image
      new CfnOutput(this, `Repo${index}Uri`, {
        value: ecrRepository.repository.repositoryUri,
        description: `ECR Repository URI for ${imageConfig.publicImageUri}:${getImageTag(imageConfig.imageTag)}`,
        exportName: `${this.stackName}-Repo${index}Uri`,
      });

      new CfnOutput(this, `Repo${index}Arn`, {
        value: ecrRepository.repository.repositoryArn,
        description: `ECR Repository ARN for ${imageConfig.publicImageUri}:${getImageTag(imageConfig.imageTag)}`,
        exportName: `${this.stackName}-Repo${index}Arn`,
      });

      new CfnOutput(this, `Repo${index}Name`, {
        value: ecrRepository.repository.repositoryName,
        description: `ECR Repository Name for ${imageConfig.publicImageUri}:${getImageTag(imageConfig.imageTag)}`,
        exportName: `${this.stackName}-Repo${index}Name`,
      });
    });

    // Create ECR Image Downloader to pull images from public ECR gallery
    // This will automatically trigger image downloads when the stack is deployed
    this.imageDownloader = new EcrImageDownloaderWithTrigger(this, 'ImgDownloader', {
      imageRepositoryMappings: this.imageRepositoryMappings,
      projectNamePrefix,
      timeout: downloadTimeout,
      computeType,
      namespace,
    });

    // Output the CodeBuild project name for monitoring/debugging
    new CfnOutput(this, 'ImgDlProjectName', {
      value: this.imageDownloader.codeBuildProject.projectName,
      description: 'CodeBuild project name for ECR image downloader',
    });

    // Output summary information
    new CfnOutput(this, 'TotalRepos', {
      value: this.repositories.length.toString(),
      description: 'Total number of ECR repositories created',
    });
  }
}
