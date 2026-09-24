// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Badge } from '@cloudscape-design/components';
import { Profile } from '@deepracer-indy/typescript-client';
import { TFunction } from 'i18next';

export const formatRoleName = (t: TFunction<'manageInstance'>, roleName?: string) => {
  switch (roleName) {
    case 'dr-admins':
      return <Badge>{t('profilesTable.roles.admin')}</Badge>;
    case 'dr-race-facilitators':
      return <Badge color="blue">{t('profilesTable.roles.raceFacilitator')}</Badge>;
    case 'dr-commentators':
      return <Badge color="green">{t('profilesTable.roles.commentator')}</Badge>;
    case 'dr-registration-managers':
      return <Badge color="grey">{t('profilesTable.roles.registrationManager')}</Badge>;
    case 'dr-racers':
      return t('profilesTable.roles.racer');
    default:
      return roleName;
  }
};

export const formatStorageUsage = (t: TFunction<'manageInstance'>, storageUsage?: number) => {
  if (storageUsage === undefined) {
    return t('profilesTable.empty_value');
  }
  return `${(storageUsage / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const formatComputeUsage = (t: TFunction<'manageInstance'>, computeUsage?: number) => {
  if (computeUsage === undefined) {
    return t('profilesTable.empty_value');
  }
  return `${(computeUsage / 60).toFixed(2)} ${t('usageSummary.units.hrs')}`;
};

export const formatProfileCreationDate = (t: TFunction<'manageInstance'>, dateString?: string) => {
  if (!dateString) {
    return t('profilesTable.empty_value');
  }
  return new Date(dateString).toISOString().split('T')[0];
};

export const getRolePriority = (roleName?: string): number => {
  switch (roleName) {
    case 'dr-admins':
      return 1;
    case 'dr-race-facilitators':
      return 2;
    case 'dr-racers':
      return 3;
    case 'dr-commentators':
      return 4;
    case 'dr-registration-managers':
      return 5;
    default:
      return 6;
  }
};

export const sortProfilesByRoleAndName = (profiles: Profile[], filterText?: string) => {
  return (
    profiles
      .filter((profile: Profile) => {
        if (!filterText) return true;
        const searchText = filterText.toLowerCase();

        // Match from the beginning of the alias or match whole words
        const alias = profile.alias?.toLowerCase() || '';
        const aliasMatches = alias.startsWith(searchText) || alias.split(' ').some((word) => word === searchText);

        // Match from the beginning of the email or anywhere within the email
        const email = profile.emailAddress?.toLowerCase() || '';
        const emailMatches = email.includes(searchText);

        return aliasMatches || emailMatches;
      })

      // Sort by role priority first, then by name alphabetically within each role
      .sort((a, b) => {
        // First compare by role priority
        const rolePriorityDiff = getRolePriority(a.roleName) - getRolePriority(b.roleName);
        if (rolePriorityDiff !== 0) return rolePriorityDiff;

        // If same role, sort by name alphabetically
        const nameA = a.alias?.toLowerCase() || '';
        const nameB = b.alias?.toLowerCase() || '';
        return nameA.localeCompare(nameB);
      })
  );
};
