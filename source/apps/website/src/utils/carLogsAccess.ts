// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

export type CarLogsAccess = 'manager' | 'viewer' | 'racer';

export const resolveCarLogsAccess = (groups: UserGroups[]): CarLogsAccess => {
  if (groups.includes(UserGroups.ADMIN) || groups.includes(UserGroups.RACE_FACILITATORS)) {
    return 'manager';
  }
  if (groups.includes(UserGroups.COMMENTATORS)) {
    return 'viewer';
  }
  return 'racer';
};

export const canManageCarLogJobs = (access: CarLogsAccess | undefined): boolean => access === 'manager';

export const canDownloadCarLogs = (access: CarLogsAccess | undefined): boolean =>
  access !== undefined && access !== 'viewer';

export const canDeleteCarLogs = canDownloadCarLogs;
