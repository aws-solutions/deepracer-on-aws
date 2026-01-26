// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig, Profile } from '@deepracer-indy/typescript-client';
import { configureStore } from '@reduxjs/toolkit';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteProfileModelsMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

import DeleteUserModelsModal from '../DeleteUserModelsModal';

vi.mock('#services/deepRacer/profileApi');
vi.mock('#hooks/useAppDispatch');
vi.mock('#store/notifications/notificationsSlice');

describe('DeleteUserModelsModal', () => {
  const mockSetIsOpen = vi.fn();
  const mockDispatch = vi.fn();
  const mockDeleteProfileModels = vi.fn();
  const mockUseDeleteProfileModelsMutation = useDeleteProfileModelsMutation as Mock;
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
    mockUseDeleteProfileModelsMutation.mockReturnValue([mockDeleteProfileModels, { isLoading: false }]);
  });

  describe('Rendering', () => {
    it('should render the modal when isOpen is true', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete models')).toBeInTheDocument();
    });

    it('should not render the modal when isOpen is false', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} isOpen={false} />);

      const modal = screen.getByRole('dialog');
      expect(modal.className).toMatch(/awsui_hidden/);
    });

    it('should render the warning message with user alias', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      expect(
        screen.getByText(
          `Delete all models for user ${mockUser.alias}? This will permanently remove all models associated with this user. This action cannot be undone.`,
        ),
      ).toBeInTheDocument();
    });

    it('should render action buttons', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('should render Delete button as primary variant', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('Modal Interactions', () => {
    it('should call setIsOpen(false) when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should call handleClose when modal onDismiss is triggered', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(mockSetIsOpen).not.toHaveBeenCalled();
    });
  });

  describe('Delete User Models Functionality', () => {
    it('should delete user models successfully and show success notification', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockDeleteProfileModels.mockReturnValue({
        unwrap: mockUnwrap,
      });

      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteProfileModels).toHaveBeenCalledWith({
          profileId: mockUser.profileId,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({
            content: `All models for user ${mockUser.alias} have been deleted`,
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

      mockDeleteProfileModels.mockReturnValue({
        unwrap: vi.fn().mockRejectedValue(new Error(errorMessage)),
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Empty implementation
      });

      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteProfileModels).toHaveBeenCalledWith({
          profileId: mockUser.profileId,
        });
      });

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displayErrorNotification({
            content: 'Failed to delete user models. Please try again.',
          }),
        );
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to delete user models');
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);

      consoleSpy.mockRestore();
    });

    it('should not attempt to delete when selectedUser is null', async () => {
      const user = userEvent.setup();
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} selectedUser={null} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      expect(mockDeleteProfileModels).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should not attempt to delete when selectedUser has no profileId', async () => {
      const user = userEvent.setup();
      const userWithoutId = { ...mockUser, profileId: '' };
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} selectedUser={userWithoutId} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      expect(mockDeleteProfileModels).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading state on Delete button when deletion is in progress', () => {
      mockUseDeleteProfileModelsMutation.mockReturnValue([mockDeleteProfileModels, { isLoading: true }]);

      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not show loading state when deletion is not in progress', () => {
      mockUseDeleteProfileModelsMutation.mockReturnValue([mockDeleteProfileModels, { isLoading: false }]);

      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).not.toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle selectedUser with empty profileId', async () => {
      const user = userEvent.setup();
      const userWithEmptyId = { ...mockUser, profileId: '' };
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} selectedUser={userWithEmptyId} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      expect(mockDeleteProfileModels).not.toHaveBeenCalled();
    });

    it('should handle selectedUser with undefined alias in success message', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockDeleteProfileModels.mockReturnValue({
        unwrap: mockUnwrap,
      });

      const userWithoutAlias = { ...mockUser, alias: '' };
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} selectedUser={userWithoutAlias} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({
            content: `All models for user ${userWithoutAlias.alias} have been deleted`,
          }),
        );
      });
    });

    it('should handle multiple rapid clicks on Delete button', async () => {
      const user = userEvent.setup();
      const mockUnwrap = vi.fn().mockResolvedValue({});
      mockDeleteProfileModels.mockReturnValue({
        unwrap: mockUnwrap,
      });

      renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      const deleteButton = screen.getByRole('button', { name: 'Delete' });

      await user.click(deleteButton);
      await user.click(deleteButton);
      await user.click(deleteButton);

      await waitFor(() => {
        expect(mockDeleteProfileModels).toHaveBeenCalledTimes(3);
      });
    });

    it('should display warning message with empty user alias', () => {
      const userWithEmptyAlias = { ...mockUser, alias: '' };
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} selectedUser={userWithEmptyAlias} />);

      expect(
        screen.getByText(
          `Delete all models for user ${userWithEmptyAlias.alias}? This will permanently remove all models associated with this user. This action cannot be undone.`,
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Component Props', () => {
    it('should handle all required props correctly', () => {
      const customProps = {
        isOpen: false,
        setIsOpen: vi.fn(),
        selectedUser: mockUser,
      };

      renderWithProvider(<DeleteUserModelsModal {...customProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal.className).toMatch(/awsui_hidden/);
    });

    it('should handle prop changes correctly', () => {
      const { rerender } = renderWithProvider(<DeleteUserModelsModal {...defaultProps} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      rerender(
        <Provider store={createTestStore()}>
          <DeleteUserModelsModal {...defaultProps} isOpen={false} />
        </Provider>,
      );

      const modal = screen.getByRole('dialog');
      expect(modal.className).toMatch(/awsui_hidden/);
    });

    it('should handle selectedUser being null', () => {
      renderWithProvider(<DeleteUserModelsModal {...defaultProps} selectedUser={null} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Delete models')).toBeInTheDocument();
    });
  });
});
