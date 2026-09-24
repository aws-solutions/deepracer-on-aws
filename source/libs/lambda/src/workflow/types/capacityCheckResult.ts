// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/** Which of the two SageMaker training quotas has no room for the requested instances. */
export enum CapacityUnavailableReason {
  /** The per-instance-type training quota for the effective instance type is exhausted. */
  INSTANCE_TYPE_QUOTA = 'INSTANCE_TYPE_QUOTA',
  /** The account-wide "instances across all training jobs" quota is exhausted. */
  TOTAL_INSTANCE_QUOTA = 'TOTAL_INSTANCE_QUOTA',
}

export enum CapacityStatus {
  AVAILABLE = 'AVAILABLE',
  UNAVAILABLE = 'UNAVAILABLE',
  /**
   * Capacity could not be determined — a quota lookup or usage query failed. Callers must fail
   * closed and treat this as "do not dispatch", but must not tell the user that a specific quota
   * is exhausted.
   */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Result of a both-quota training capacity check.
 *
 * Capacity is available only when the requested instance count fits below the per-instance-type
 * quota *and* the account-wide total instance quota.
 */
export type CapacityCheckResult =
  | {
      status: CapacityStatus.AVAILABLE;
      effectiveInstanceType: string;
      requiredInstanceCount: number;
    }
  | {
      status: CapacityStatus.UNAVAILABLE;
      effectiveInstanceType: string;
      requiredInstanceCount: number;
      reason: CapacityUnavailableReason;
    }
  | {
      status: CapacityStatus.UNKNOWN;
      effectiveInstanceType?: string;
      requiredInstanceCount?: number;
      error: Error;
    };
