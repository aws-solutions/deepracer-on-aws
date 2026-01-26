// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Handler } from 'aws-lambda';

import type { WorkflowContext } from './workflowContext.js';

export interface WorkflowTaskHandler {
  handler: Handler<WorkflowContext, WorkflowContext>;
}
