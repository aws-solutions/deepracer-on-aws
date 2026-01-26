// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { RemovalPolicy } from 'aws-cdk-lib';
import { Repository, TagStatus } from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

import { addCfnGuardSuppression } from '../common/cfnGuardHelper.js';

export interface EcrRepositoryProps {
  /**
   * The name of the ECR repository
   * @default 'deepracer-indy-images'
   */
  repositoryName?: string;

  /**
   * Whether to empty the repository when the stack is deleted
   * @default false
   */
  emptyOnDelete?: boolean;

  /**
   * Maximum number of images to keep in the repository
   * @default 10
   */
  maxImageCount?: number;
}

export class EcrRepository extends Construct {
  public readonly repository: Repository;

  constructor(scope: Construct, id: string, props: EcrRepositoryProps = {}) {
    super(scope, id);

    const { repositoryName = 'deepracer-indy-images', emptyOnDelete = false, maxImageCount = 10 } = props;

    // Create ECR repository
    this.repository = new Repository(this, 'Repository', {
      repositoryName,
      removalPolicy: emptyOnDelete ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
      emptyOnDelete,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep only the most recent images',
          maxImageCount,
          tagStatus: TagStatus.ANY,
        },
      ],
    });

    // explicit repository names required to be used as source for lambdas
    addCfnGuardSuppression(this.repository, ['CFN_NO_EXPLICIT_RESOURCE_NAMES']);
  }
}
