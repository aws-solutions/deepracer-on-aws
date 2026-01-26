// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Profile, UserGroups } from '@deepracer-indy/typescript-client';

import { roleOptions } from './constants';

export const getCurrentRole = (selectedUser: Profile | null) => {
  if (!selectedUser?.roleName) return null;

  const roleMapping: Record<string, UserGroups> = {
    'dr-racers': UserGroups.RACERS,
    'dr-race-facilitators': UserGroups.RACE_FACILITATORS,
    'dr-admins': UserGroups.ADMIN,
  };

  const userGroup = roleMapping[selectedUser.roleName];
  return roleOptions.find((option) => option.value === userGroup) || null;
};
