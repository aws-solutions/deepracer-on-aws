// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';
import { TFunction } from 'i18next';

export interface RoleOption {
  label: string;
  value: UserGroups;
}

/**
 * Builds the role select options with translated labels. Must be called with the SAME
 * memoized `t` (and thus the SAME resulting array reference) across a render cycle — see
 * ChangeUserRoleModal, which memoizes this and passes the memoized array to both the Select
 * and getCurrentRole so that `selectedRole === getCurrentRole(...)` object-identity comparisons
 * continue to hold.
 */
export const getRoleOptions = (t: TFunction<'manageInstance'>): RoleOption[] => [
  { label: t('changeUserRoleModal.roles.racer'), value: UserGroups.RACERS },
  { label: t('changeUserRoleModal.roles.raceFacilitator'), value: UserGroups.RACE_FACILITATORS },
  { label: t('changeUserRoleModal.roles.commentator'), value: UserGroups.COMMENTATORS },
  { label: t('changeUserRoleModal.roles.registrationManager'), value: UserGroups.REGISTRATION_MANAGERS },
  { label: t('changeUserRoleModal.roles.admin'), value: UserGroups.ADMIN },
];
