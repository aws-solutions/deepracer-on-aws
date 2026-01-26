// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EvaluationItem } from '../entities/EvaluationsEntity.js';
import type { SubmissionItem } from '../entities/SubmissionsEntity.js';
import type { TrainingItem } from '../entities/TrainingsEntity.js';

/**
 * Workflow job item.
 */
export type JobItem = EvaluationItem | SubmissionItem | TrainingItem;
