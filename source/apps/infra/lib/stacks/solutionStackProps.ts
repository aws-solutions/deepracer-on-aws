// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import * as cdk from 'aws-cdk-lib';

export interface SolutionStackProps extends cdk.StackProps {
  /**
   * Solution ID for metrics collection
   */
  readonly solutionId: string;

  /**
   * Solution version for metrics collection
   */
  readonly solutionVersion: string;
}
