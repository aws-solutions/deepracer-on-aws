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
  onDeleteUser: (user: Profile, clearSelection: () => void) => void;
  onDeleteUserModels: (user: Profile) => void;
  onUpdateUserQuotas: (user: Profile, clearSelection: () => void) => void;
  onChangeUserRole: (user: Profile, clearSelection: () => void) => void;
}

const ProfilesTable = ({
  profiles,
  currentUserProfileId,
  onInviteUser,
  onDeleteUser,
  onDeleteUserModels,
  onUpdateUserQuotas,
  onChangeUserRole,
}: ProfilesTableProps) => {
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
          header: 'Email',
          cell: (item) => item.emailAddress || '-/-',
        },
        {
          id: 'name',
          header: 'Alias',
          cell: (item) => item.alias,
        },
        {
          id: 'role',
          header: 'Role',
          cell: (item) => formatRoleName(item.roleName),
        },
        {
          id: 'currentUsage',
          header: 'Current usage',
          cell: (item) => formatComputeUsage(item.computeMinutesUsed),
        },
        {
          id: 'queuedUsage',
          header: 'Queued usage',
          cell: (item) => formatComputeUsage(item.computeMinutesQueued),
        },
        {
          id: 'usageLimit',
          header: (
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              Usage limit
              <Popover
                dismissButton={false}
                position="right"
                size="medium"
                triggerType="custom"
                content={
                  <Box padding="s">
                    The maximum number of training and evaluation hours an individual user can consume. This can be{' '}
                    changed by selecting the checkbox in the user's row and clicking <i>Actions</i> &gt;{' '}
                    <i>Update usage quotas</i>.
                  </Box>
                }
              >
                <Icon name="status-info" size="medium" />
              </Popover>
            </SpaceBetween>
          ),
          cell: (item) => formatValue(item.maxTotalComputeMinutes, 'hours', convertMinutesToHours),
        },
        {
          id: 'modelLimit',
          header: (
            <SpaceBetween direction="horizontal" size="xs" alignItems="center">
              Model limit
              <Popover
                dismissButton={false}
                position="right"
                size="medium"
                triggerType="custom"
                content={
                  <Box padding="s">
                    The maximum number of models an individual user can have. This can be changed by selecting the
                    checkbox in the user's row and clicking <i>Actions</i> &gt; <i>Update usage quotas</i>.
                  </Box>
                }
              >
                <Icon name="status-info" size="medium" />
              </Popover>
            </SpaceBetween>
          ),
          cell: (item) => formatValue(item.maxModelCount, 'models'),
        },
        {
          id: 'modelStorage',
          header: 'Model storage',
          cell: (item) => formatStorageUsage(item.modelStorageUsage),
        },
        {
          id: 'dateAdded',
          header: 'Date added',
          cell: (item) => formatProfileCreationDate(item.createdAt),
        },
      ]}
      items={filteredProfiles}
      loadingText="Loading users"
      empty={
        <Box textAlign="center" color="inherit">
          <SpaceBetween size="s">
            <div>
              <b>No users</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                No users to display.
              </Box>
            </div>
            <Button disabled={true}>Add user</Button>
          </SpaceBetween>
        </Box>
      }
      header={
        <SpaceBetween size="m">
          <Header
            counter={`(${filteredProfiles.length})`}
            description={selectedItems.length > 0 ? `${selectedItems.length} selected` : undefined}
            actions={
              <ButtonDropdown
                items={[
                  { text: 'Invite user', disabled: selectedItems.length > 0, id: 'invite' },
                  { text: 'Change role', disabled: isChangeRoleDisabled(), id: 'change-role' },
                  { text: 'Update usage quotas', disabled: selectedItems.length !== 1, id: 'update-quotas' },
                  { text: 'Delete models', disabled: selectedItems.length !== 1, id: 'delete-models' },
                  { text: 'Delete user', disabled: selectedItems.length !== 1, id: 'delete-user' },
                ]}
                onItemClick={({ detail }) => {
                  if (detail.id === 'invite') {
                    onInviteUser();
                  } else if (detail.id === 'change-role' && selectedItems.length === 1) {
                    onChangeUserRole(selectedItems[0], clearSelection);
                  } else if (detail.id === 'delete-user' && selectedItems.length === 1) {
                    onDeleteUser(selectedItems[0], clearSelection);
                  } else if (detail.id === 'delete-models' && selectedItems.length === 1) {
                    onDeleteUserModels(selectedItems[0]);
                  } else if (detail.id === 'update-quotas' && selectedItems.length === 1) {
                    onUpdateUserQuotas(selectedItems[0], clearSelection);
                  }
                }}
              >
                Actions
              </ButtonDropdown>
            }
          >
            Users
          </Header>
          <SpaceBetween direction="horizontal" size="xs" alignItems="center">
            <div style={{ minWidth: '400px' }}>
              <TextFilter
                filteringText={filterText}
                filteringPlaceholder="Find user by alias or email"
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
                  Search for users by alias or email address. Examples:
                  <br />
                  <strong>Alias:</strong> "john" matches "John Smith" or "johnson"
                  <br />
                  <strong>Email:</strong> "example.com" matches any user with that domain
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
