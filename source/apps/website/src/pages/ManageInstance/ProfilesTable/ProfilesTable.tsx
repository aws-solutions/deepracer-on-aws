// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Box,
  Button,
  ButtonDropdown,
  Header,
  Icon,
  Popover,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import { Profile } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import {
  formatComputeUsage,
  formatProfileCreationDate,
  formatRoleName,
  formatStorageUsage,
  sortProfilesByRoleAndName,
} from './helpers';
import { convertMinutesToHours, formatValue } from '../UsageSummary/lib';

interface ProfilesTableProps {
  profiles: Profile[];
  currentUserProfileId?: string;
  onInviteUser: () => void;
  onInviteMultipleUsers: () => void;
  onDeleteUser: (user: Profile, clearSelection: () => void) => void;
  onDeleteUserModels: (user: Profile) => void;
  onUpdateUserQuotas: (user: Profile, clearSelection: () => void) => void;
  onChangeUserRole: (user: Profile, clearSelection: () => void) => void;
  onResendInvite: (users: Profile[], clearSelection: () => void) => void;
}

const ProfilesTable = ({
  profiles,
  currentUserProfileId,
  onInviteUser,
  onInviteMultipleUsers,
  onDeleteUser,
  onDeleteUserModels,
  onUpdateUserQuotas,
  onChangeUserRole,
  onResendInvite,
}: ProfilesTableProps) => {
  const { t } = useTranslation('manageInstance');
  const [filterText, setFilterText] = useState('');
  const [selectedItems, setSelectedItems] = useState<Profile[]>([]);

  const filteredProfiles = sortProfilesByRoleAndName(profiles, filterText);

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const isChangeRoleDisabled = () => {
    if (selectedItems.length !== 1) return true;

    const selectedUser = selectedItems[0];

    // Don't allow if current user matches selected user
    if (currentUserProfileId && selectedUser.profileId === currentUserProfileId) return true;

    // Don't allow if selected user's profileId starts with "admin"
    if (selectedUser.profileId.startsWith('admin')) return true;

    return false;
  };

  return (
    <Table
      data-testid="users-table"
      selectionType="multi"
      selectedItems={selectedItems}
      onSelectionChange={({ detail }) => setSelectedItems(detail.selectedItems)}
      columnDefinitions={[
        {
          id: 'email',
          header: t('profilesTable.columns.email'),
          cell: (item) => item.emailAddress || t('profilesTable.empty_value'),
        },
        {
          id: 'name',
          header: t('profilesTable.columns.alias'),
          cell: (item) => item.alias,
        },
        {
          id: 'role',
          header: t('profilesTable.columns.role'),
          cell: (item) => formatRoleName(t, item.roleName),
        },
        {
          id: 'currentUsage',
          header: t('profilesTable.columns.currentUsage'),
          cell: (item) => formatComputeUsage(t, item.computeMinutesUsed),
        },
        {
          id: 'queuedUsage',
          header: t('profilesTable.columns.queuedUsage'),
          cell: (item) => formatComputeUsage(t, item.computeMinutesQueued),
        },
        {
          id: 'usageLimit',
          header: (
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              {t('profilesTable.columns.usageLimit')}
              <Popover
                dismissButton={false}
                position="right"
                size="medium"
                triggerType="custom"
                content={
                  <Box padding="s">
                    <Trans t={t} i18nKey="profilesTable.usageLimitPopover" />
                  </Box>
                }
              >
                <Icon name="status-info" size="medium" />
              </Popover>
            </SpaceBetween>
          ),
          cell: (item) =>
            formatValue(t, item.maxTotalComputeMinutes, t('usageSummary.units.hours'), convertMinutesToHours),
        },
        {
          id: 'modelLimit',
          header: (
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              {t('profilesTable.columns.modelLimit')}
              <Popover
                dismissButton={false}
                position="right"
                size="medium"
                triggerType="custom"
                content={
                  <Box padding="s">
                    <Trans t={t} i18nKey="profilesTable.modelLimitPopover" />
                  </Box>
                }
              >
                <Icon name="status-info" size="medium" />
              </Popover>
            </SpaceBetween>
          ),
          cell: (item) => formatValue(t, item.maxModelCount, t('usageSummary.units.models')),
        },
        {
          id: 'modelStorage',
          header: t('profilesTable.columns.modelStorage'),
          cell: (item) => formatStorageUsage(t, item.modelStorageUsage),
        },
        {
          id: 'dateAdded',
          header: t('profilesTable.columns.dateAdded'),
          cell: (item) => formatProfileCreationDate(t, item.createdAt),
        },
      ]}
      items={filteredProfiles}
      loadingText={t('profilesTable.loadingUsers')}
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="s">
            <div>
              <b>{t('profilesTable.empty.title')}</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                {t('profilesTable.empty.description')}
              </Box>
            </div>
            <Button disabled={true}>{t('profilesTable.addUser')}</Button>
          </SpaceBetween>
        </Box>
      }
      header={
        <SpaceBetween size="m">
          <Header
            counter={`(${filteredProfiles.length})`}
            description={
              selectedItems.length > 0 ? t('profilesTable.selectedCount', { count: selectedItems.length }) : undefined
            }
            actions={
              <ButtonDropdown
                items={[
                  { text: t('profilesTable.actions.inviteUser'), disabled: selectedItems.length > 0, id: 'invite' },
                  {
                    text: t('profilesTable.actions.inviteMultipleUsers'),
                    disabled: selectedItems.length > 0,
                    id: 'invite-multiple',
                  },
                  {
                    text: t('profilesTable.actions.changeRole'),
                    disabled: isChangeRoleDisabled(),
                    id: 'change-role',
                  },
                  {
                    text: t('profilesTable.actions.updateUsageQuotas'),
                    disabled: selectedItems.length !== 1,
                    id: 'update-quotas',
                  },
                  {
                    text: t('profilesTable.actions.deleteModels'),
                    disabled: selectedItems.length !== 1,
                    id: 'delete-models',
                  },
                  {
                    text: t('profilesTable.actions.deleteUser'),
                    disabled: selectedItems.length !== 1,
                    id: 'delete-user',
                  },
                  {
                    text: t('profilesTable.actions.resendInvitation'),
                    disabled: selectedItems.length === 0,
                    id: 'resend-invite',
                  },
                ]}
                onItemClick={({ detail }) => {
                  if (detail.id === 'invite') {
                    onInviteUser();
                  } else if (detail.id === 'invite-multiple') {
                    onInviteMultipleUsers();
                  } else if (detail.id === 'change-role' && selectedItems.length === 1) {
                    onChangeUserRole(selectedItems[0], clearSelection);
                  } else if (detail.id === 'delete-user' && selectedItems.length === 1) {
                    onDeleteUser(selectedItems[0], clearSelection);
                  } else if (detail.id === 'delete-models' && selectedItems.length === 1) {
                    onDeleteUserModels(selectedItems[0]);
                  } else if (detail.id === 'update-quotas' && selectedItems.length === 1) {
                    onUpdateUserQuotas(selectedItems[0], clearSelection);
                  } else if (detail.id === 'resend-invite' && selectedItems.length > 0) {
                    onResendInvite(selectedItems, clearSelection);
                  }
                }}
              >
                {t('profilesTable.actions.label')}
              </ButtonDropdown>
            }
          >
            {t('profilesTable.header')}
          </Header>
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <div style={{ minWidth: '400px' }}>
              <TextFilter
                filteringText={filterText}
                filteringPlaceholder={t('profilesTable.filterPlaceholder')}
                onChange={({ detail }) => setFilterText(detail.filteringText)}
              />
            </div>
            <Popover
              dismissButton={false}
              position="right"
              size="medium"
              triggerType="custom"
              content={
                <Box padding="s">
                  <Trans t={t} i18nKey="profilesTable.filterPopover" />
                </Box>
              }
            >
              <Icon name="status-info" size="medium" />
            </Popover>
          </SpaceBetween>
        </SpaceBetween>
      }
    />
  );
};

export default ProfilesTable;
