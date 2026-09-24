// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MetricUnit } from '@aws-lambda-powertools/metrics';
import { bulkInviteJobDao, type ResourceId } from '@deepracer-indy/database';
import { BulkInviteJobStatus } from '@deepracer-indy/typescript-server-client';
import { logger, metrics } from '@deepracer-indy/utils';

import { instrumentHandler } from '../utils/instrumentation/instrumentHandler.js';

/**
 * Terminal-marking step for the bulk-invite state machine.
 */
export interface BulkInviteFinalizeInput {
  jobId: string;
  adminProfileId: string;
  outcome: 'COMPLETED' | 'FAILED';
  /** Populated on the FAILED path (the caught error cause). */
  errorMessage?: string;
}

const handler = async (input: BulkInviteFinalizeInput): Promise<void> => {
  const { jobId, adminProfileId, outcome, errorMessage } = input;
  const status = outcome === 'FAILED' ? BulkInviteJobStatus.FAILED : BulkInviteJobStatus.COMPLETED;

  await bulkInviteJobDao.markTerminal({
    adminProfileId: adminProfileId as ResourceId,
    bulkInviteJobId: jobId as ResourceId,
    status,
    ...(errorMessage === undefined ? {} : { errorMessage }),
  });

  if (status === BulkInviteJobStatus.FAILED) {
    metrics.addMetric('BulkInviteJobFailed', MetricUnit.Count, 1);
  }

  logger.info('Bulk invite job finalized', { action: 'BULK_INVITE_FINALIZE', jobId, status });
};

export const lambdaHandler = instrumentHandler(handler);
