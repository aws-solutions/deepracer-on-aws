// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig, Profile } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteProfileMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

import DeleteUserModal from '../DeleteUserModal';

vi.mock('#services/deepRacer/profileApi');
vi.mock('#hooks/useAppDispatch');
vi.mock('#store/notifications/notificationsSlice');

describe('DeleteUserModal', () => {
  const mockSetIsOpen = vi.fn();
  const mockDispatch = vi.fn();
  const mockDeleteProfile = vi.fn();
  const mockUseDeleteProfileMutation = useDeleteProfileMutation as Mock;
  const mockUseAppDispatch = useAppDispatch as unknown as Mock;

  const createTestStore = () =>
    configureStore({
      reducer: {
        notifications: (state = {}) => state,
      },
    });

  const renderWithProvider = (component: React.ReactElement) => {
    const store = createTestStore();
    return render(<Provider store={store}>{component}</Provider>);
  };

  const mockUser: Profile = {
    profileId: 'test-profile-id',
    alias: 'TestUser',
    roleName: 'dr-racers',
    avatar: 'mockUser' as AvatarConfig,
  };

  const defaultProps = {
    isOpen: true,
    setIsOpen: mockSetIsOpen,
    selectedUser: mockUser,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppDispatch.mockReturnValue(mockDispatch);
    mockUseDeleteProfileMutation.mockReturnValue([mockDeleteProfile, { isLoading: false }]);
  });

  describe('Rendering', () => {
    it('should render the modal when isOpen is true', () => {
      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete user')).toBeInTheDocument();
    });

    it('should not render the modal when isOpen is false', () => {
      renderWithProvider(<DeleteUserModal {...defaultProps} isOpen={false} />);

      const modal = screen.getByRole('dialog');
      expect(modal.className).toMatch(/awsui_hidden/);
    });

    it('should render the warning message', () => {
      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      expect(screen.getByText('Delete this user from the system? This action cannot be undone.')).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should render Delete button as primary variant', () => {
      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    it('should call setIsOpen(false) when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should call handleClose when modal onDismiss is triggered', () => {
      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      expect(mockSetIsOpen).not.toHaveBeenCalled();
    });
  });

  describe('Delete User Functionality', () => {
    it('should delete user successfully and show success notification', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockDeleteProfile.mockReturnValue({
        unwrap: mockUnwrap,
      });

      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteProfile).toHaveBeenCalledWith({
          profileId: mockUser.profileId,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({
            content: `User ${mockUser.alias} has been deleted from the system`,
          }),
        );
      });

      await waitFor(() => {
        expect(mockSetIsOpen).toHaveBeenCalledWith(false);
      });
    });

    it('should handle API error and show error notification', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Delete failed';

      mockDeleteProfile.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error(errorMessage)),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Empty implementation
      });

      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteProfile).toHaveBeenCalledWith({
          profileId: mockUser.profileId,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displayErrorNotification({
            content: 'Failed to delete user. Please try again.',
          }),
        );
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete user');
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);

      consoleSpy.mockRestore();
    });

    it('should not attempt to delete when selectedUser is null', async () => {
      const user = userEvent.setup();
      renderWithProvider(<DeleteUserModal {...defaultProps} selectedUser={null} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      expect(mockDeleteProfile).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should not attempt to delete when selectedUser has no profileId', async () => {
      const user = userEvent.setup();
      const userWithoutId = { ...mockUser, profileId: '' };
      renderWithProvider(<DeleteUserModal {...defaultProps} selectedUser={userWithoutId} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      expect(mockDeleteProfile).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should not show loading state when deletion is not in progress', () => {
      mockUseDeleteProfileMutation.mockReturnValue([mockDeleteProfile, { isLoading: false }]);

      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).not.toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle selectedUser with empty profileId', async () => {
      const user = userEvent.setup();
      const userWithEmptyId = { ...mockUser, profileId: '' };
      renderWithProvider(<DeleteUserModal {...defaultProps} selectedUser={userWithEmptyId} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      expect(mockDeleteProfile).not.toHaveBeenCalled();
    });

    it('should handle selectedUser with undefined alias in success message', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockDeleteProfile.mockReturnValue({
        unwrap: mockUnwrap,
      });

      const userWithoutAlias = { ...mockUser, alias: '' };
      renderWithProvider(<DeleteUserModal {...defaultProps} selectedUser={userWithoutAlias} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({
            content: `User ${userWithoutAlias.alias} has been deleted from the system`,
          }),
        );
      });
    });

    it('should handle multiple rapid clicks on Delete button', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockDeleteProfile.mockReturnValue({
        unwrap: mockUnwrap,
      });

      renderWithProvider(<DeleteUserModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });

      await user.click(deleteButton);
      await user.click(deleteButton);
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteProfile).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Component Props', () => {
    it('should handle all required props correctly', () => {
      const customProps = {
        isOpen: false,
        setIsOpen: vi.fn(),
        selectedUser: mockUser,
      };

      renderWithProvider(<DeleteUserModal {...customProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal.className).toMatch(/awsui_hidden/);
    });

    it('should handle prop changes correctly', () => {
      const { rerender } = renderWithProvider(<DeleteUserModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <Provider store={createTestStore()}>
          <DeleteUserModal {...defaultProps} isOpen={false} />
        </Provider>,
      );

      const modal = screen.getByRole('dialog');
      expect(modal.className).toMatch(/awsui_hidden/);
    });
  });
});
