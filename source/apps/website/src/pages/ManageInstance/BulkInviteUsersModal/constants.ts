// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/** localStorage key used to persist the active bulk invite job across refresh/navigation. */
export const ACTIVE_BULK_INVITE_JOB_STORAGE_KEY = 'deepracer-bulk-invite-active-job';

/** Poll cadence for GetBulkInviteUserJobStatus while a job is PROCESSING. */
export const BULK_INVITE_JOB_POLLING_INTERVAL_MS = 3000;
