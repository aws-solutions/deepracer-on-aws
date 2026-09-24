// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig, Profile } from '@deepracer-indy/typescript-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, Mock } from 'vitest';

import { useResendInviteMutation } from '#services/deepRacer/profileApi';

import ResendInviteModal from '../ResendInviteModal';

vi.mock('#services/deepRacer/profileApi');

describe('ResendInviteModal', () => {
  const mockSetIsOpen = vi.fn();
  const mockOnClearSelection = vi.fn();
  const mockResendInvite = vi.fn();
  const mockUseResendInviteMutation = useResendInviteMutation as unknown as Mock;

  const mockUsers: Profile[] = [
    {
      profileId: 'profile-1',
      alias: 'alice',
      emailAddress: 'alice@example.com',
      avatar: 'avatar-1.jpg' as AvatarConfig,
    },
    { profileId: 'profile-2', alias: 'bob', emailAddress: 'bob@example.com', avatar: 'avatar-2.jpg' as AvatarConfig },
  ];

  const defaultProps = {
    isOpen: true,
    setIsOpen: mockSetIsOpen,
    selectedUsers: mockUsers,
    onClearSelection: mockOnClearSelection,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseResendInviteMutation.mockReturnValue([mockResendInvite]);
  });

  it('renders a confirmation prompt with the selected user count', () => {
    render(<ResendInviteModal {...defaultProps} />);

    expect(screen.getByText(/Resend the invitation email to 2 selected users/)).toBeInTheDocument();
  });

  it('calls resendInvite sequentially for each selected user and shows inline results', async () => {
    const user = userEvent.setup();
    mockResendInvite
      .mockReturnValueOnce({ unwrap: vi.fn().mockResolvedValue('Invitation resent') })
      .mockReturnValueOnce({ unwrap: vi.fn().mockResolvedValue('Invitation resent') });

    render(<ResendInviteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Resend invitation' }));

    await waitFor(() => {
      expect(mockResendInvite).toHaveBeenCalledTimes(2);
    });
    expect(mockResendInvite).toHaveBeenCalledWith({ profileId: 'profile-1' });
    expect(mockResendInvite).toHaveBeenCalledWith({ profileId: 'profile-2' });

    expect(screen.getByTestId('resend-invite-results-table')).toBeInTheDocument();
    expect(screen.getAllByText('Sent')).toHaveLength(2);
  });

  it('maps a ConflictError (409) to a "Skipped — already confirmed" result', async () => {
    const user = userEvent.setup();
    mockResendInvite
      .mockReturnValueOnce({
        unwrap: vi.fn().mockRejectedValue({ error: 'Already confirmed', name: 'ConflictError' }),
      })
      .mockReturnValueOnce({ unwrap: vi.fn().mockResolvedValue('Invitation resent') });

    render(<ResendInviteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Resend invitation' }));

    await waitFor(() => {
      expect(screen.getByText('Skipped')).toBeInTheDocument();
    });
    expect(screen.getByText('Skipped — already confirmed')).toBeInTheDocument();
    expect(screen.getByText('Sent')).toBeInTheDocument();
  });

  it('maps a non-conflict error to an error result with the returned message', async () => {
    const user = userEvent.setup();
    mockResendInvite
      .mockReturnValueOnce({
        unwrap: vi
          .fn()
          .mockRejectedValue({ error: 'Failed to resend invitation. Please try again.', name: 'InternalFailureError' }),
      })
      .mockReturnValueOnce({ unwrap: vi.fn().mockResolvedValue('Invitation resent') });

    render(<ResendInviteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Resend invitation' }));

    await waitFor(() => {
      expect(screen.getByText('Error')).toBeInTheDocument();
    });
    expect(screen.getByText('Failed to resend invitation. Please try again.')).toBeInTheDocument();
  });

  it('clears table selection and closes the modal when Done is clicked after results are shown', async () => {
    const user = userEvent.setup();
    mockResendInvite.mockReturnValue({ unwrap: vi.fn().mockResolvedValue('Invitation resent') });

    render(<ResendInviteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Resend invitation' }));
    await screen.findByRole('button', { name: 'Done' });

    await user.click(screen.getByRole('button', { name: 'Done' }));

    expect(mockOnClearSelection).toHaveBeenCalledTimes(1);
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('closes without resending when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<ResendInviteModal {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockResendInvite).not.toHaveBeenCalled();
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('shows a warning and disables Resend invitation when no users are selected', () => {
    render(<ResendInviteModal {...defaultProps} selectedUsers={[]} />);

    expect(screen.getByText('No users selected.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resend invitation' })).toBeDisabled();
    // Regression: the confirm prompt (e.g. "Resend the invitation email to 0 selected users?")
    // must not render alongside the warning — showing both is contradictory.
    expect(screen.queryByText(/Resend the invitation email to/)).not.toBeInTheDocument();
  });
});
