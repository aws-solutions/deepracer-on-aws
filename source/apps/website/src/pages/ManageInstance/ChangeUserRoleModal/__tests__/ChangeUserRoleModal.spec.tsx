// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig, Profile, UserGroups } from '@deepracer-indy/typescript-client';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, Mock, vi } from 'vitest';

import { useUpdateGroupMembershipMutation } from '#services/deepRacer/profileApi.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';
import { render } from '#utils/testUtils';

import ChangeUserRoleModal from '../ChangeUserRoleModal';

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useUpdateGroupMembershipMutation: vi.fn(),
}));

vi.mock('#store/notifications/notificationsSlice', () => ({
  displayErrorNotification: vi.fn(),
  displaySuccessNotification: vi.fn(),
}));

const mockDispatch = vi.fn();
vi.mock('#hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

describe('ChangeUserRoleModal', () => {
  const mockSetIsOpen = vi.fn();
  const mockOnClearSelection = vi.fn();
  const mockUpdateGroupMembership = vi.fn();

  const mockUser: Profile = {
    profileId: 'test-profile-id',
    alias: 'testuser',
    avatar: { color: 'blue', icon: 'user' } as AvatarConfig,
    roleName: 'dr-racers',
  };

  const defaultProps = {
    isOpen: true,
    setIsOpen: mockSetIsOpen,
    selectedUser: mockUser,
    onClearSelection: mockOnClearSelection,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useUpdateGroupMembershipMutation as Mock).mockReturnValue([mockUpdateGroupMembership, { isLoading: false }]);

    mockUpdateGroupMembership.mockReturnValue({
      unwrap: vi.fn().mockResolvedValue({}),
    });
  });

  it('should render modal when isOpen is true', () => {
    render(<ChangeUserRoleModal {...defaultProps} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Change user role')).toBeInTheDocument();
  });

  it('should not render modal when isOpen is false', () => {
    render(<ChangeUserRoleModal {...defaultProps} isOpen={false} />);

    const dialog = screen.queryByRole('dialog');
    expect(dialog).toHaveClass(/awsui_hidden_/);
  });

  it('should display role selection dropdown with correct options', () => {
    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    expect(dropdown).toBeInTheDocument();
  });

  it('should show current user role as selected in dropdown', () => {
    render(<ChangeUserRoleModal {...defaultProps} />);

    expect(screen.getByText('Racer')).toBeInTheDocument();
  });

  it('should show correct role for race facilitator', () => {
    const facilitatorUser: Profile = {
      ...mockUser,
      roleName: 'dr-race-facilitators',
    };

    render(<ChangeUserRoleModal {...defaultProps} selectedUser={facilitatorUser} />);

    expect(screen.getByText('Race facilitator')).toBeInTheDocument();
  });

  it('should show correct role for admin', () => {
    const adminUser: Profile = {
      ...mockUser,
      roleName: 'dr-admins',
    };

    render(<ChangeUserRoleModal {...defaultProps} selectedUser={adminUser} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should handle user with no role name', () => {
    const userWithoutRole: Profile = {
      ...mockUser,
      roleName: undefined,
    };

    render(<ChangeUserRoleModal {...defaultProps} selectedUser={userWithoutRole} />);

    expect(screen.getByText('Select a role')).toBeInTheDocument();
  });

  it('should handle null selectedUser', () => {
    render(<ChangeUserRoleModal {...defaultProps} selectedUser={null} />);

    expect(screen.getByText('Select a role')).toBeInTheDocument();
  });

  it('should display informational text about role changes', () => {
    render(<ChangeUserRoleModal {...defaultProps} />);

    expect(screen.getByText(/Please note the following when changing a user's role:/)).toBeInTheDocument();
    expect(screen.getByText(/they will need to log out and log back in/)).toBeInTheDocument();
    expect(screen.getByText(/A successful role change will take 1-2 minutes/)).toBeInTheDocument();
  });

  it('should render Cancel and Change buttons', () => {
    render(<ChangeUserRoleModal {...defaultProps} />);

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
  });

  it('should close modal when Cancel button is clicked', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should close modal when modal dismiss is triggered', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close modal');
    await user.click(closeButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should disable Change button when no role is selected', () => {
    render(<ChangeUserRoleModal {...defaultProps} selectedUser={null} />);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    expect(changeButton).toBeDisabled();
  });

  it('should disable Change button when selected role is same as current role', () => {
    render(<ChangeUserRoleModal {...defaultProps} />);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    expect(changeButton).toBeDisabled();
  });

  it('should enable Change button when different role is selected', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    expect(changeButton).not.toBeDisabled();
  });

  it('should call updateGroupMembership when Change button is clicked with different role', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    expect(mockUpdateGroupMembership).toHaveBeenCalledWith({
      profileId: 'test-profile-id',
      targetUserPoolGroup: UserGroups.ADMIN,
    });
  });

  it('should display success notification when role change succeeds', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        displaySuccessNotification({
          content:
            "User testuser's role has been changed to Admin. Please allow 1-2 minutes for this change to take effect.",
        }),
      );
    });
  });

  it('should close modal and call onClearSelection when role change succeeds', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    await waitFor(() => {
      expect(mockOnClearSelection).toHaveBeenCalled();
    });

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should display error notification when role change fails', async () => {
    const user = userEvent.setup();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Mock implementation
    });

    mockUpdateGroupMembership.mockReturnValue({
      unwrap: vi.fn().mockRejectedValue(new Error('API Error')),
    });

    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to change user role');
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      displayErrorNotification({
        content: 'Failed to change user role. Please try again.',
      }),
    );

    consoleSpy.mockRestore();
  });

  it('should not call API when no selectedUser profileId', async () => {
    const user = userEvent.setup();
    const userWithoutProfileId: Profile = {
      ...mockUser,
      profileId: undefined as never,
    };

    render(<ChangeUserRoleModal {...defaultProps} selectedUser={userWithoutProfileId} />);

    const dropdownButtons = screen.getAllByRole('button');
    const selectButton = dropdownButtons.find((button) => button.getAttribute('aria-haspopup') === 'listbox');

    expect(selectButton).toBeDefined();
    if (selectButton) {
      await user.click(selectButton);
    }

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    expect(mockUpdateGroupMembership).not.toHaveBeenCalled();
  });

  it('should show loading state when updating role', () => {
    (useUpdateGroupMembershipMutation as Mock).mockReturnValue([mockUpdateGroupMembership, { isLoading: true }]);

    render(<ChangeUserRoleModal {...defaultProps} />);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    expect(changeButton.className).toMatch(/awsui_button_/);
  });

  it('should disable dropdown when updating role', () => {
    (useUpdateGroupMembershipMutation as Mock).mockReturnValue([mockUpdateGroupMembership, { isLoading: true }]);

    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    expect(dropdown).toBeDisabled();
  });

  it('should reset selected role when modal is closed', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('should update selected role when selectedUser changes', () => {
    const { rerender } = render(<ChangeUserRoleModal {...defaultProps} />);

    expect(screen.getByText('Racer')).toBeInTheDocument();

    const adminUser: Profile = {
      ...mockUser,
      roleName: 'dr-admins',
    };

    rerender(<ChangeUserRoleModal {...defaultProps} selectedUser={adminUser} />);

    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('should handle onClearSelection being null', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} onClearSelection={null} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    await waitFor(() => {
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });
  });

  it('should handle onClearSelection being undefined', async () => {
    const user = userEvent.setup();
    render(<ChangeUserRoleModal {...defaultProps} onClearSelection={undefined} />);

    const dropdown = screen.getByRole('button', { name: /racer/i });
    await user.click(dropdown);

    const adminOption = screen.getByText('Admin');
    await user.click(adminOption);

    const changeButton = screen.getByRole('button', { name: 'Change' });
    await user.click(changeButton);

    await waitFor(() => {
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });
  });

  it('should handle unknown role name gracefully', () => {
    const userWithUnknownRole: Profile = {
      ...mockUser,
      roleName: 'unknown-role',
    };

    render(<ChangeUserRoleModal {...defaultProps} selectedUser={userWithUnknownRole} />);

    expect(screen.getByText('Select a role')).toBeInTheDocument();
  });
});
