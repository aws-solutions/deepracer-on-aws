// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * User-facing messages persisted on the model/training records and returned by RetryTraining while
 * a training job is WAITING_FOR_CAPACITY.
 *
 * The unavailable message names both quotas deliberately: effective training concurrency is the
 * lower of the per-instance-type quota and the account-wide total instance quota, so raising only
 * one of them may not free capacity.
 */
export const CapacityMessage = {
  UNAVAILABLE:
    'Training capacity is not available. Both the instance-type quota and the total training instance quota must have room. Please try again later or contact your administrator to request a quota increase.',
  UNKNOWN: 'Unable to verify training capacity at this time. Please try again later.',
  DISPATCHED: 'Training job dispatched successfully.',
  /**
   * Capacity was confirmed available, but the job could not actually be handed off (the queue send or
   * a status write failed). The job is left WAITING_FOR_CAPACITY so the user can retry, but the cause
   * is not a quota problem and must not be reported as one.
   */
  DISPATCH_FAILED: 'Unable to start the training job. Please try again.',
} as const;
