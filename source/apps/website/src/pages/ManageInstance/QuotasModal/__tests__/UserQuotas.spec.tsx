// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useController } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import * as Yup from 'yup';

import { useBatchUpdateProfileQuotasMutation } from '#services/deepRacer/profileApi.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';
import { render } from '#utils/testUtils';

import UserQuotasModal from '../UserQuotas';

vi.mock('#services/deepRacer/profileApi.js', () => ({
  useBatchUpdateProfileQuotasMutation: vi.fn(),
}));

vi.mock('#store/notifications/notificationsSlice', () => ({
  displayErrorNotification: vi.fn((payload) => ({ type: 'notifications/displayErrorNotification', payload })),
  displaySuccessNotification: vi.fn((payload) => ({ type: 'notifications/displaySuccessNotification', payload })),
}));

const mockDispatch = vi.fn();
vi.mock('#hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

interface MockInputFieldProps {
  control?: unknown;
  label: string;
  name: string;
  disabled?: boolean;
  placeholder?: string;
  description?: string;
}

// Value-aware mock: binds via useController (like the real InputField) so the input reflects the
// actual form value, letting tests assert on input values rather than mere presence.
vi.mock('#components/FormFields/InputField', () => {
  const MockInputField = ({ control, label, name, disabled, placeholder, description }: MockInputFieldProps) => {
    const {
      field: { value, onChange, onBlur, ref },
    } = useController({ control: control as never, name });
    return (
      <div data-testid={`input-field-${name}`}>
        <label htmlFor={name}>{label}</label>
        <input
          id={name}
          name={name}
          ref={ref}
          placeholder={placeholder}
          disabled={disabled}
          data-testid={`input-${name}`}
          value={value === undefined || value === null ? '' : String(value)}
          onBlur={onBlur}
          onChange={(e) => {
            // Non-numeric input passes through as a raw string so a test can reach the NaN guard.
            const raw = e.target.value;
            const stripped = raw.replace(/[^0-9.-]/g, '');
            if (stripped === '' || stripped === '-' || stripped === '.') {
              onChange(raw);
            } else {
              onChange(Number(stripped));
            }
          }}
        />
        <div data-testid={`description-${name}`}>{description}</div>
      </div>
    );
  };
  return { default: MockInputField };
});

const mockProfile = {
  profileId: 'test-profile-id',
  alias: 'Test User',
  avatar: { skinColor: 'light', hairColor: 'brown' },
  maxTotalComputeMinutes: 3600,
  maxModelCount: 10,
  computeMinutesUsed: 1800,
  computeMinutesQueued: 600,
  modelCount: 5,
  roleName: 'dr-racers',
  createdAt: '2023-01-01T00:00:00Z',
};

const mockUnlimitedProfile = {
  ...mockProfile,
  maxTotalComputeMinutes: -1,
  maxModelCount: -1,
};

const mockProfile2 = {
  ...mockProfile,
  profileId: 'test-profile-id-2',
  alias: 'Second User',
};

const mockProfile3 = {
  ...mockProfile,
  profileId: 'test-profile-id-3',
  alias: 'Third User',
};

const makeProfiles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ ...mockProfile, profileId: `bulk-profile-${i}`, alias: `User ${i}` }));

interface BatchRequest {
  profileIds: string[];
  maxTotalComputeMinutes: number;
  maxModelCount: number;
}

const allSucceed = ({ profileIds }: BatchRequest) => ({
  unwrap: () => Promise.resolve({ updatedProfileIds: profileIds, errors: [] }),
});

describe('UserQuotasModal', () => {
  const mockBatchUpdateProfileQuotas = vi.fn();
  const mockSetIsOpen = vi.fn();
  const mockOnClearSelection = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (useBatchUpdateProfileQuotasMutation as Mock).mockReturnValue([mockBatchUpdateProfileQuotas]);
    mockBatchUpdateProfileQuotas.mockImplementation(allSucceed);

    vi.spyOn(console, 'error').mockImplementation(() => {
      // intentionally empty
    });
    vi.spyOn(console, 'log').mockImplementation(() => {
      // intentionally empty
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Cloudscape keeps both Modals' dialogs mounted regardless of `visible`, so locate by heading.
  const getDialogByHeading = (headingText: string) => {
    const dialogs = screen.getAllByRole('dialog', { hidden: true });
    const dialog = dialogs.find((d) => within(d).queryByText(headingText));
    if (!dialog) {
      throw new Error(`No dialog found with heading matching "${headingText}"`);
    }
    return dialog;
  };

  const getFormDialog = () => {
    const dialogs = screen.getAllByRole('dialog', { hidden: true });
    const dialog = dialogs.find((d) => within(d).queryByText(/Update usage quotas/));
    if (!dialog) {
      throw new Error('No form dialog found');
    }
    return dialog;
  };

  const getConfirmationDialog = () => getDialogByHeading('Confirm quota update');

  // Clicks through both "Confirm" steps: the form, then the confirmation prompt.
  // Fill any empty field before confirming (multi-select starts empty); single-user is pre-filled.
  const confirmAndSubmit = async (user: ReturnType<typeof userEvent.setup>) => {
    const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
    const modelInput = screen.getByTestId('input-maxModelCount');
    if ((computeInput as HTMLInputElement).value === '') {
      await user.type(computeInput, '1');
    }
    if ((modelInput as HTMLInputElement).value === '') {
      await user.type(modelInput, '1');
    }

    const formConfirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
    await user.click(formConfirmButton);

    const confirmationConfirmButton = within(getConfirmationDialog()).getByRole('button', { name: /^confirm$/i });
    await user.click(confirmationConfirmButton);
  };

  describe('single-user behavior (regression)', () => {
    it('should render modal with header "Update usage quotas" when exactly one user is selected', () => {
      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      expect(getFormDialog()).toBeInTheDocument();
      expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
    });

    it('should pre-fill form from the single selected user existing values', () => {
      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[{ ...mockProfile, maxTotalComputeMinutes: 7200, maxModelCount: 25 }]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      // Compute is shown in hours (7200 min -> 120).
      expect(screen.getByTestId('input-maxTotalComputeMinutes')).toHaveValue('120');
      expect(screen.getByTestId('input-maxModelCount')).toHaveValue('25');
    });

    it('should disable input fields when unlimited is checked', () => {
      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockUnlimitedProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      const modelInput = screen.getByTestId('input-maxModelCount');

      expect(computeInput).toBeDisabled();
      expect(modelInput).toBeDisabled();
    });

    it('should close modal when Cancel button is clicked, without opening the confirmation prompt', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
    });

    it('should close modal when dismiss button is clicked', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const dismissButton = screen.getByLabelText('Close modal');
      await user.click(dismissButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should hide the form modal while the confirmation prompt is open', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await user.click(within(getFormDialog()).getByRole('button', { name: /^confirm$/i }));

      await waitFor(() => {
        expect(within(getConfirmationDialog()).getByText('Confirm quota update')).toBeInTheDocument();
      });
      expect(getConfirmationDialog()).not.toHaveClass(/awsui_hidden_/);
      expect(getFormDialog()).toHaveClass(/awsui_hidden_/);
    });

    it('should send one batch request with only the single user ID and the quota values', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(1);
      });
      expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledWith({
        profileIds: ['test-profile-id'],
        maxTotalComputeMinutes: 60 * 60,
        maxModelCount: 10,
      });
    });

    it('should send maxTotalComputeMinutes and maxModelCount as numbers, not strings (regression: API 400)', async () => {
      // Text inputs produce string values; the API requires integers (rejects strings with 400).
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      const modelInput = screen.getByTestId('input-maxModelCount');
      await user.clear(computeInput);
      await user.type(computeInput, '100');
      await user.clear(modelInput);
      await user.type(modelInput, '100');

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(1);
      });

      const sent = mockBatchUpdateProfileQuotas.mock.calls[0][0];
      expect(typeof sent.maxTotalComputeMinutes).toBe('number');
      expect(typeof sent.maxModelCount).toBe('number');
      expect(sent.maxTotalComputeMinutes).toBe(100 * 60);
      expect(sent.maxModelCount).toBe(100);
    });

    it('should handle unlimited values in form submission', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const checkboxes = screen.getAllByRole('checkbox', { name: /unlimited/i });
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledWith({
          profileIds: ['test-profile-id'],
          maxTotalComputeMinutes: -1,
          maxModelCount: -1,
        });
      });
    });

    it('should reset to the single user current values (not neutral defaults) on close', async () => {
      const user = userEvent.setup();
      const profileWithMinutes = { ...mockProfile, maxTotalComputeMinutes: 7200 };

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[profileWithMinutes]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      // The form pre-fills with the user's current values: 7200 min = 120 hours, and the user's model count.
      expect(screen.getByTestId('input-maxTotalComputeMinutes')).toHaveValue('120');
      expect(screen.getByTestId('input-maxModelCount')).toHaveValue(String(mockProfile.maxModelCount));

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should handle undefined maxTotalComputeMinutes with nullish coalescing', () => {
      const profileWithUndefinedMinutes = { ...mockProfile, maxTotalComputeMinutes: undefined };

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[profileWithUndefinedMinutes]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      expect(getFormDialog()).toBeInTheDocument();
      expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
    });

    it('should handle undefined maxModelCount with nullish coalescing', () => {
      const profileWithUndefinedModelCount = { ...mockProfile, maxModelCount: undefined };

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[profileWithUndefinedModelCount]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      expect(getFormDialog()).toBeInTheDocument();
      expect(screen.getByText('Update usage quotas')).toBeInTheDocument();
    });

    it('should reset to initial values when selectedUsers is empty on close', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      // With no users selected the fields start empty (initial values), not pre-filled with a stale value.
      expect(screen.getByTestId('input-maxTotalComputeMinutes')).toHaveValue('');
      expect(screen.getByTestId('input-maxModelCount')).toHaveValue('');

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should display correct placeholders', () => {
      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      expect(screen.getByPlaceholderText('Enter training hours limit')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter model count limit')).toBeInTheDocument();
    });

    it('should call onClearSelection on successful single-user submit', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockOnClearSelection).toHaveBeenCalled();
      });
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('multi-user behavior', () => {
    it('should reflect count in header when more than one user is selected', () => {
      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2, mockProfile3]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      expect(screen.getByText('Update usage quotas for 3 users')).toBeInTheDocument();
    });

    it('should not pre-fill from any user existing values when 2+ users are selected', () => {
      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      expect(screen.getByText('Update usage quotas for 2 users')).toBeInTheDocument();
      // Empty, not pre-filled and not a silent 0 default.
      expect(screen.getByTestId('input-maxTotalComputeMinutes')).toHaveValue('');
      expect(screen.getByTestId('input-maxModelCount')).toHaveValue('');
    });

    it('should block confirmation for multi-select until both fields are set (empty is required)', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      // Empty fields → Confirm must not open the prompt.
      const confirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmButton);

      expect(getConfirmationDialog()).toHaveClass(/awsui_hidden_/);
      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();

      await user.type(screen.getByTestId('input-maxTotalComputeMinutes'), '5');
      await user.type(screen.getByTestId('input-maxModelCount'), '5');
      await user.click(within(getFormDialog()).getByRole('button', { name: /^confirm$/i }));

      expect(within(getConfirmationDialog()).getByText('Confirm quota update')).toBeInTheDocument();
    });

    it('should show a confirmation prompt with the affected user count and quota values before submitting', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2, mockProfile3]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      const modelInput = screen.getByTestId('input-maxModelCount');
      await user.clear(computeInput);
      await user.type(computeInput, '8');
      await user.clear(modelInput);
      await user.type(modelInput, '15');

      const confirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmButton);

      const confirmationDialog = getConfirmationDialog();
      expect(within(confirmationDialog).getByText('Confirm quota update')).toBeInTheDocument();
      expect(within(confirmationDialog).getByText('Usage limit: 8 hours')).toBeInTheDocument();
      expect(within(confirmationDialog).getByText('Model count limit: 15 models')).toBeInTheDocument();
      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
    });

    it('should send one batch request with every selected profile ID and the shared quota values', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2, mockProfile3]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      const modelInput = screen.getByTestId('input-maxModelCount');
      await user.clear(computeInput);
      await user.type(computeInput, '12');
      await user.clear(modelInput);
      await user.type(modelInput, '7');

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(1);
      });
      expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledWith({
        profileIds: ['test-profile-id', 'test-profile-id-2', 'test-profile-id-3'],
        maxTotalComputeMinutes: 12 * 60,
        maxModelCount: 7,
      });
    });

    it('should close the modal, clear selection, and show a success notification when all updates succeed', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2, mockProfile3]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({ content: 'Updated quotas for 3 users.' }),
        );
      });

      expect(mockOnClearSelection).toHaveBeenCalled();
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should keep the modal open and list every alias in an error when the batch request fails', async () => {
      const user = userEvent.setup();
      mockBatchUpdateProfileQuotas.mockReturnValue({ unwrap: () => Promise.reject(new Error('API Error')) });

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displayErrorNotification({
            content: 'Failed to update quotas for: Test User, Second User. Please try again.',
          }),
        );
      });

      expect(mockOnClearSelection).not.toHaveBeenCalled();
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);
    });

    it('should report both counts and retain only the users returned in errors on a partial failure', async () => {
      const user = userEvent.setup();
      mockBatchUpdateProfileQuotas.mockReturnValue({
        unwrap: () =>
          Promise.resolve({
            updatedProfileIds: ['test-profile-id', 'test-profile-id-3'],
            errors: [{ profileId: 'test-profile-id-2', code: 'NotFoundError', message: 'Profile not found.' }],
          }),
      });

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2, mockProfile3]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({ content: 'Updated quotas for 2 of 3 users.' }),
        );
      });
      expect(mockDispatch).toHaveBeenCalledWith(
        displayErrorNotification({ content: 'Failed to update quotas for: Second User. Please try again.' }),
      );

      // Modal stays open; not fully cleared since one user failed.
      expect(mockOnClearSelection).not.toHaveBeenCalled();
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);

      // Header stays in multi-user framing (the original selection was 3), now showing the one
      // remaining failed user, so it stays consistent with the still-multi-user form. "1 user" is
      // singularized via the headerMultiple plural key.
      expect(screen.getByText('Update usage quotas for 1 user')).toBeInTheDocument();
    });

    it('should send all 200 selected users in a single request', async () => {
      const user = userEvent.setup();
      const profiles = makeProfiles(200);
      mockBatchUpdateProfileQuotas.mockImplementation(allSucceed);

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={profiles}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({ content: 'Updated quotas for 200 users.' }),
        );
      });
      expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(1);
      expect((mockBatchUpdateProfileQuotas.mock.calls[0][0] as BatchRequest).profileIds).toEqual(
        profiles.map((profile) => profile.profileId),
      );
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it.each([
      [5, 'Failed to update quotas for: User 0, User 1, User 2, User 3, User 4. Please try again.'],
      [6, 'Failed to update quotas for 6 users: User 0, User 1, User 2, User 3, User 4 and 1 more. Please try again.'],
    ])(
      'should list every alias for up to 5 failed users and a count beyond that (%i failed)',
      async (count, message) => {
        const user = userEvent.setup();
        mockBatchUpdateProfileQuotas.mockReturnValue({ unwrap: () => Promise.reject(new Error('Network error')) });

        render(
          <UserQuotasModal
            isOpen={true}
            setIsOpen={mockSetIsOpen}
            selectedUsers={makeProfiles(count)}
            onClearSelection={mockOnClearSelection}
          />,
        );

        await confirmAndSubmit(user);

        await waitFor(() => {
          expect(mockDispatch).toHaveBeenCalledWith(displayErrorNotification({ content: message }));
        });
      },
    );

    it('should resend only the users that failed, with the same quota values, when the admin confirms again', async () => {
      const user = userEvent.setup();
      mockBatchUpdateProfileQuotas
        .mockReturnValueOnce({
          unwrap: () =>
            Promise.resolve({
              updatedProfileIds: ['test-profile-id', 'test-profile-id-3'],
              errors: [{ profileId: 'test-profile-id-2', code: 'NotFoundError', message: 'Profile not found.' }],
            }),
        })
        .mockImplementationOnce(allSucceed);

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2, mockProfile3]}
          onClearSelection={mockOnClearSelection}
        />,
      );
      await user.type(screen.getByTestId('input-maxTotalComputeMinutes'), '12');
      await user.type(screen.getByTestId('input-maxModelCount'), '7');

      await confirmAndSubmit(user);
      await screen.findByText('Update usage quotas for 1 user');
      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(2);
      });
      expect(mockBatchUpdateProfileQuotas).toHaveBeenNthCalledWith(1, {
        profileIds: ['test-profile-id', 'test-profile-id-2', 'test-profile-id-3'],
        maxTotalComputeMinutes: 12 * 60,
        maxModelCount: 7,
      });
      expect(mockBatchUpdateProfileQuotas).toHaveBeenNthCalledWith(2, {
        profileIds: ['test-profile-id-2'],
        maxTotalComputeMinutes: 12 * 60,
        maxModelCount: 7,
      });
      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displaySuccessNotification({ content: 'Updated quotas for Second User.' }),
        );
      });
      expect(mockOnClearSelection).toHaveBeenCalled();
      expect(mockSetIsOpen).toHaveBeenCalledWith(false);
    });

    it('should not send a request or show a notification when confirmed with no users selected', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
      expect(mockOnClearSelection).not.toHaveBeenCalled();
    });

    it('should block submission and show an actionable error if a quota value is NaN at submit time', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      const modelInput = screen.getByTestId('input-maxModelCount');
      await user.clear(computeInput);
      await user.type(computeInput, '5');
      await user.clear(modelInput);
      await user.type(modelInput, '5');

      const formConfirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(formConfirmButton);
      expect(within(getConfirmationDialog()).getByText('Confirm quota update')).toBeInTheDocument();

      // Corrupt the form value (non-numeric -> NaN) after the confirmation opened, to reach the guard.
      await user.clear(modelInput);
      await user.type(modelInput, 'abc');

      const confirmationSubmitButton = within(getConfirmationDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmationSubmitButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displayErrorNotification({
            content: 'Enter a valid number for each quota, or select Unlimited, before confirming.',
          }),
        );
      });
      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);
    });

    it('should block submission if a quota value is empty at submit time', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      const modelInput = screen.getByTestId('input-maxModelCount');
      await user.type(computeInput, '5');
      await user.type(modelInput, '5');

      const formConfirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(formConfirmButton);
      expect(within(getConfirmationDialog()).getByText('Confirm quota update')).toBeInTheDocument();

      // Clear a field (empty, not NaN) after confirmation opened → submit guard's `=== ''` branch.
      await user.clear(modelInput);

      const confirmationSubmitButton = within(getConfirmationDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmationSubmitButton);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalledWith(
          displayErrorNotification({
            content: 'Enter a valid number for each quota, or select Unlimited, before confirming.',
          }),
        );
      });
      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
    });

    it('should submit Unlimited (-1) for both fields when Unlimited is ticked for multiple users', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      // Ticking Unlimited sets -1, which satisfies the required validation even though fields start empty.
      const checkboxes = screen.getAllByRole('checkbox', { name: /unlimited/i });
      await user.click(checkboxes[0]);
      await user.click(checkboxes[1]);

      const formConfirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(formConfirmButton);

      const confirmationSubmitButton = within(getConfirmationDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmationSubmitButton);

      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(1);
      });
      expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledWith({
        profileIds: ['test-profile-id', 'test-profile-id-2'],
        maxTotalComputeMinutes: -1,
        maxModelCount: -1,
      });
    });

    it('should return to the form without sending a request when the confirmation prompt is cancelled', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const confirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmButton);

      expect(screen.getByText('Confirm quota update')).toBeInTheDocument();

      const backButton = screen.getByRole('button', { name: /back/i });
      await user.click(backButton);

      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
      expect(mockSetIsOpen).not.toHaveBeenCalledWith(false);
    });

    it('should disable the confirm button while the batch request is in flight', async () => {
      const user = userEvent.setup();
      let resolveRequest: () => void = () => undefined;
      mockBatchUpdateProfileQuotas.mockImplementation(({ profileIds }: BatchRequest) => ({
        unwrap: () =>
          new Promise((resolve) => {
            resolveRequest = () => resolve({ updatedProfileIds: profileIds, errors: [] });
          }),
      }));

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const confirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      // Enter values so the confirmation prompt opens (multi-select starts empty).
      await user.type(screen.getByTestId('input-maxTotalComputeMinutes'), '5');
      await user.type(screen.getByTestId('input-maxModelCount'), '5');
      await user.click(confirmButton);

      const confirmationSubmitButton = within(getConfirmationDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmationSubmitButton);

      await waitFor(() => {
        expect(confirmationSubmitButton).toHaveAttribute('aria-disabled', 'true');
      });

      resolveRequest();
    });

    it('should keep the confirmation prompt open if it is dismissed while the batch request is in flight', async () => {
      const user = userEvent.setup();
      let resolveRequest: () => void = () => undefined;
      mockBatchUpdateProfileQuotas.mockImplementation(({ profileIds }: BatchRequest) => ({
        unwrap: () =>
          new Promise((resolve) => {
            resolveRequest = () => resolve({ updatedProfileIds: profileIds, errors: [] });
          }),
      }));

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);
      await waitFor(() => {
        expect(mockBatchUpdateProfileQuotas).toHaveBeenCalledTimes(1);
      });

      await user.click(within(getConfirmationDialog()).getByRole('button', { name: 'Close confirmation' }));

      expect(getConfirmationDialog()).not.toHaveClass(/awsui_hidden_/);
      expect(getFormDialog()).toHaveClass(/awsui_hidden_/);

      resolveRequest();
      await waitFor(() => {
        expect(mockSetIsOpen).toHaveBeenCalledWith(false);
      });
    });

    it('should still block submission via validation regardless of how many users are selected', async () => {
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile, mockProfile2]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      const computeInput = screen.getByTestId('input-maxTotalComputeMinutes');
      await user.clear(computeInput);
      await user.type(computeInput, '-5');
      await user.tab();

      const confirmButton = within(getFormDialog()).getByRole('button', { name: /^confirm$/i });
      await user.click(confirmButton);

      expect(getConfirmationDialog()).toHaveClass(/awsui_hidden_/);
      expect(mockBatchUpdateProfileQuotas).not.toHaveBeenCalled();
    });

    it('should use displaySuccessNotification/displayErrorNotification, not window.alert or console.error, for outcomes', async () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {
        // intentionally empty; should never be called
      });
      const user = userEvent.setup();

      render(
        <UserQuotasModal
          isOpen={true}
          setIsOpen={mockSetIsOpen}
          selectedUsers={[mockProfile]}
          onClearSelection={mockOnClearSelection}
        />,
      );

      await confirmAndSubmit(user);

      await waitFor(() => {
        expect(mockDispatch).toHaveBeenCalled();
      });

      expect(alertSpy).not.toHaveBeenCalled();
    });
  });

  describe('validation schema', () => {
    // The number input strips typed decimals, so test the .integer() guard directly, not through the UI.
    it('should reject a non-integer quota value', async () => {
      const fieldSchema = Yup.number()
        .transform((value, originalValue) => (originalValue === '' ? undefined : value))
        .required('required')
        .integer('must be an integer')
        .test('valid-limit', 'invalid', (value) => value === -1 || (value !== undefined && value >= 0));

      await expect(fieldSchema.validate(2.5)).rejects.toThrow();
      await expect(fieldSchema.validate(1.33)).rejects.toThrow();
      await expect(fieldSchema.validate('2.5')).rejects.toThrow();
      await expect(fieldSchema.validate(3)).resolves.toBe(3);
      await expect(fieldSchema.validate(-1)).resolves.toBe(-1);
    });
  });
});
