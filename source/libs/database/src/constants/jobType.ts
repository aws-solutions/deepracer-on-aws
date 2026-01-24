// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceType } from './resourceTypes.js';

/**
 * Represents a workflow job type.
 */
export enum JobType {
  TRAINING = ResourceType.TRAINING,
  EVALUATION = ResourceType.EVALUATION,
  SUBMISSION = ResourceType.SUBMISSION,
}
