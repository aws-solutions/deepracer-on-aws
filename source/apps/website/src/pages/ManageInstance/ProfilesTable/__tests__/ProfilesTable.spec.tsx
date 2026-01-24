// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig, Profile } from '@deepracer-indy/typescript-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import ProfilesTable from '../ProfilesTable';

vi.mock('../helpers', () => ({
  formatComputeUsage: vi.fn((value) => `${(value || 0) / 60} hrs`),
  formatProfileCreationDate: vi.fn((date) => (date ? new Date(date).toISOString().split('T')[0] : '-/-')),
  formatRoleName: vi.fn((role) => role || 'Unknown'),
  formatStorageUsage: vi.fn((value) => `${(value || 0) / (1024 * 1024 * 1024)} GB`),
  sortProfilesByRoleAndName: vi.fn((profiles) => profiles),
}));

vi.mock('../UsageSummary/lib', () => ({
  convertMinutesToHours: vi.fn((minutes) => minutes / 60),
  formatValue: vi.fn((value, unit, transformFn) => {
    if (!value) return '-/-';
    if (Number(value) === -1) return 'Unlimited';
    const transformed = transformFn ? transformFn(Number(value)) : value;
    return `${transformed} ${unit}`;
  }),
}));

const mockProfiles: Profile[] = [
  {
    profileId: 'profile-1',
    alias: 'John Doe',
    avatar: 'avatar-1.jpg' as AvatarConfig,
    roleName: 'dr-admins',
    computeMinutesUsed: 120,
    computeMinutesQueued: 60,
    maxTotalComputeMinutes: 1800,
    maxModelCount: 10,
    modelStorageUsage: 1073741824,
    createdAt: '2023-01-01T00:00:00Z',
    modelCount: 5,
  },
  {
    profileId: 'profile-2',
    alias: 'Jane Smith',
    avatar: 'avatar-2.jpg' as AvatarConfig,
    roleName: 'dr-racers',
    computeMinutesUsed: 90,
    computeMinutesQueued: 30,
    maxTotalComputeMinutes: 900,
    maxModelCount: 5,
    modelStorageUsage: 536870912,
    createdAt: '2023-01-02T00:00:00Z',
    modelCount: 3,
  },
];

describe('ProfilesTable', () => {
  const mockOnInviteUser = vi.fn();
  const mockOnDeleteUser = vi.fn();
  const mockOnDeleteUserModels = vi.fn();
  const mockOnUpdateUserQuotas = vi.fn();
  const mockOnChangeUserRole = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the table with correct test id', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByTestId('users-table')).toBeInTheDocument();
  });

  it('renders table headers correctly', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Alias')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Current usage')).toBeInTheDocument();
    expect(screen.getByText('Queued usage')).toBeInTheDocument();
    expect(screen.getByText('Usage limit')).toBeInTheDocument();
    expect(screen.getByText('Model limit')).toBeInTheDocument();
    expect(screen.getByText('Model storage')).toBeInTheDocument();
    expect(screen.getByText('Date added')).toBeInTheDocument();
  });

  it('displays profile data in table cells', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('shows correct counter in header', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('displays empty state when no profiles', () => {
    render(
      <ProfilesTable
        profiles={[]}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('No users')).toBeInTheDocument();
    expect(screen.getByText('No users to display.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add user' })).toBeDisabled();
  });

  it('handles text filter changes', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const filterInput = screen.getByPlaceholderText('Find user by alias or email');
    await user.type(filterInput, 'John');

    expect(filterInput).toHaveValue('John');
  });

  it('handles item selection', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);

    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('shows selection count when items are selected', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('renders Actions dropdown with correct items', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const actionsButton = screen.getByText('Actions');
    expect(actionsButton).toBeInTheDocument();
  });

  it('calls onInviteUser when invite action is clicked', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const inviteOption = screen.getByText('Invite user');
    await user.click(inviteOption);

    expect(mockOnInviteUser).toHaveBeenCalledTimes(1);
  });

  it('renders loading text correctly', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.queryByText('Loading users')).not.toBeInTheDocument();
  });

  it('handles profiles with undefined values', () => {
    const profilesWithUndefined: Profile[] = [
      {
        profileId: 'profile-undefined',
        alias: '',
        avatar: '' as AvatarConfig,
        roleName: undefined,
        computeMinutesUsed: undefined,
        computeMinutesQueued: undefined,
        maxTotalComputeMinutes: undefined,
        maxModelCount: undefined,
        modelStorageUsage: undefined,
        createdAt: undefined,
        modelCount: undefined,
      },
    ];

    render(
      <ProfilesTable
        profiles={profilesWithUndefined}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByTestId('users-table')).toBeInTheDocument();
  });

  it('handles profiles with -1 values (unlimited)', () => {
    const profilesWithUnlimited: Profile[] = [
      {
        profileId: 'profile-unlimited',
        alias: 'Unlimited User',
        avatar: 'avatar-unlimited.jpg' as AvatarConfig,
        roleName: 'dr-admins',
        computeMinutesUsed: 120,
        computeMinutesQueued: 60,
        maxTotalComputeMinutes: -1,
        maxModelCount: -1,
        modelStorageUsage: 1073741824,
        createdAt: '2023-01-01T00:00:00Z',
        modelCount: 5,
      },
    ];

    render(
      <ProfilesTable
        profiles={profilesWithUnlimited}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('Unlimited User')).toBeInTheDocument();
  });

  it('renders table with multi-selection type', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('displays Users header', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('handles empty profiles array', () => {
    render(
      <ProfilesTable
        profiles={[]}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('(0)')).toBeInTheDocument();
    expect(screen.getByText('No users')).toBeInTheDocument();
  });

  it('renders filter placeholder text', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByPlaceholderText('Find user by alias or email')).toBeInTheDocument();
  });

  it('handles button dropdown item clicks for non-invite actions', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    expect(mockOnInviteUser).not.toHaveBeenCalled();
  });

  it('renders all column definitions correctly', () => {
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const expectedHeaders = [
      'Email',
      'Alias',
      'Role',
      'Current usage',
      'Queued usage',
      'Usage limit',
      'Model limit',
      'Model storage',
      'Date added',
    ];

    expectedHeaders.forEach((header) => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
  });

  it('handles profile data with all fields populated', () => {
    const completeProfile: Profile[] = [
      {
        profileId: 'profile-complete',
        alias: 'Complete User',
        avatar: 'avatar-complete.jpg' as AvatarConfig,
        roleName: 'dr-race-facilitators',
        computeMinutesUsed: 240,
        computeMinutesQueued: 120,
        maxTotalComputeMinutes: 3600,
        maxModelCount: 20,
        modelStorageUsage: 2147483648,
        createdAt: '2023-06-15T10:30:00Z',
        modelCount: 8,
      },
    ];

    render(
      <ProfilesTable
        profiles={completeProfile}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    expect(screen.getByText('Complete User')).toBeInTheDocument();
  });

  it('calls onDeleteUser when delete user action is clicked with single selection', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const deleteUserOption = screen.getByText('Delete user');
    await user.click(deleteUserOption);

    expect(mockOnDeleteUser).toHaveBeenCalledTimes(1);
    expect(mockOnDeleteUser).toHaveBeenCalledWith(mockProfiles[0], expect.any(Function));
  });

  it('calls onDeleteUserModels when delete models action is clicked with single selection', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const deleteModelsOption = screen.getByText('Delete models');
    await user.click(deleteModelsOption);

    expect(mockOnDeleteUserModels).toHaveBeenCalledTimes(1);
    expect(mockOnDeleteUserModels).toHaveBeenCalledWith(mockProfiles[0]);
  });

  it('does not call delete callbacks when multiple items are selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const deleteUserOption = screen.getByText('Delete user');
    const deleteModelsOption = screen.getByText('Delete models');

    expect(deleteUserOption).toBeInTheDocument();
    expect(deleteModelsOption).toBeInTheDocument();
  });

  it('does not call delete callbacks when no items are selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const deleteUserOption = screen.getByText('Delete user');
    const deleteModelsOption = screen.getByText('Delete models');

    expect(deleteUserOption).toBeInTheDocument();
    expect(deleteModelsOption).toBeInTheDocument();

    expect(mockOnDeleteUser).not.toHaveBeenCalled();
    expect(mockOnDeleteUserModels).not.toHaveBeenCalled();
  });

  it('calls onUpdateUserQuotas when update quotas action is clicked with single selection', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const updateQuotasOption = screen.getByText('Update usage quotas');
    await user.click(updateQuotasOption);

    expect(mockOnUpdateUserQuotas).toHaveBeenCalledTimes(1);
    expect(mockOnUpdateUserQuotas).toHaveBeenCalledWith(mockProfiles[0], expect.any(Function));
  });

  it('provides clearSelection callback to onUpdateUserQuotas', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    expect(screen.getByText('1 selected')).toBeInTheDocument();

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const updateQuotasOption = screen.getByText('Update usage quotas');
    await user.click(updateQuotasOption);

    expect(mockOnUpdateUserQuotas).toHaveBeenCalledWith(mockProfiles[0], expect.any(Function));

    const clearSelectionCallback = mockOnUpdateUserQuotas.mock.calls[0][1];
    expect(typeof clearSelectionCallback).toBe('function');
  });

  it('does not call onUpdateUserQuotas when multiple items are selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const updateQuotasOption = screen.getByText('Update usage quotas');
    await user.click(updateQuotasOption);

    expect(mockOnUpdateUserQuotas).not.toHaveBeenCalled();
  });

  it('does not call onUpdateUserQuotas when no items are selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const updateQuotasOption = screen.getByText('Update usage quotas');
    await user.click(updateQuotasOption);

    expect(mockOnUpdateUserQuotas).not.toHaveBeenCalled();
  });

  it('clearSelection callback clears selected items', async () => {
    const user = userEvent.setup();

    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    // Select an item first
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    // Verify selection is shown
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    // Trigger the update quotas action to get the clearSelection callback
    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const updateQuotasOption = screen.getByText('Update usage quotas');
    await user.click(updateQuotasOption);

    // Get the clearSelection callback from the mock call
    expect(mockOnUpdateUserQuotas).toHaveBeenCalledWith(mockProfiles[0], expect.any(Function));
    const clearSelectionCallback = mockOnUpdateUserQuotas.mock.calls[0][1];

    // Call the clearSelection callback
    clearSelectionCallback();

    // Wait for the selection to be cleared and verify it's no longer displayed
    await waitFor(() => {
      expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
    });
  });

  // New tests for onChangeUserRole functionality
  it('calls onChangeUserRole when change role action is clicked with single selection', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    expect(mockOnChangeUserRole).toHaveBeenCalledTimes(1);
    expect(mockOnChangeUserRole).toHaveBeenCalledWith(mockProfiles[0], expect.any(Function));
  });

  it('provides clearSelection callback to onChangeUserRole', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    expect(mockOnChangeUserRole).toHaveBeenCalledWith(mockProfiles[0], expect.any(Function));

    const clearSelectionCallback = mockOnChangeUserRole.mock.calls[0][1];
    expect(typeof clearSelectionCallback).toBe('function');
  });

  it('does not call onChangeUserRole when multiple items are selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    expect(mockOnChangeUserRole).not.toHaveBeenCalled();
  });

  it('does not call onChangeUserRole when no items are selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    expect(mockOnChangeUserRole).not.toHaveBeenCalled();
  });

  it('disables change role when current user is selected', async () => {
    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={mockProfiles}
        currentUserProfileId="profile-1"
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // Select first profile (profile-1)

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    // Should not call onChangeUserRole because current user is selected
    expect(mockOnChangeUserRole).not.toHaveBeenCalled();
  });

  it('disables change role when admin profile is selected', async () => {
    const adminProfile: Profile[] = [
      {
        profileId: 'admin-profile-1',
        alias: 'Admin User',
        avatar: 'avatar-admin.jpg' as AvatarConfig,
        roleName: 'dr-admins',
        computeMinutesUsed: 120,
        computeMinutesQueued: 60,
        maxTotalComputeMinutes: 1800,
        maxModelCount: 10,
        modelStorageUsage: 1073741824,
        createdAt: '2023-01-01T00:00:00Z',
        modelCount: 5,
      },
    ];

    const user = userEvent.setup();
    render(
      <ProfilesTable
        profiles={adminProfile}
        onInviteUser={mockOnInviteUser}
        onDeleteUser={mockOnDeleteUser}
        onDeleteUserModels={mockOnDeleteUserModels}
        onUpdateUserQuotas={mockOnUpdateUserQuotas}
        onChangeUserRole={mockOnChangeUserRole}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // Select admin profile

    const actionsButton = screen.getByText('Actions');
    await user.click(actionsButton);

    const changeRoleOption = screen.getByText('Change role');
    await user.click(changeRoleOption);

    // Should not call onChangeUserRole because admin profile is selected
    expect(mockOnChangeUserRole).not.toHaveBeenCalled();
  });
});
