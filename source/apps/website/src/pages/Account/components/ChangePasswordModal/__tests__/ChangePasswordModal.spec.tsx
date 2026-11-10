// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import { updatePassword } from 'aws-amplify/auth';
import { Mock, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import ChangePasswordModal from '../ChangePasswordModal';
import * as stories from '../ChangePasswordModal.stories';

const { Default } = composeStories(stories);

vi.mock('aws-amplify/auth', () => ({
  updatePassword: vi.fn(),
}));

const mockDispatch = vi.fn();
vi.mock('#hooks/useAppDispatch.js', () => ({
  useAppDispatch: () => mockDispatch,
}));

const VALID_INPUT = 'Passw0rd!';

/** Cloudscape `Input` renders a native `<input name=...>`; the Modal portals to
 * document.body, so query the whole document rather than the render container. */
const fillField = (name: string, value: string) => {
  const input = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`input[name="${name}"] not found`);
  fireEvent.change(input, { target: { value } });
};

const submit = () => {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('account:changePasswordModal.changePassword') }));
};

describe('<ChangePasswordModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(i18n.t('account:changePasswordModal.updatePasswordHeader'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:changePasswordModal.currPassword'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:changePasswordModal.newPassword'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('account:changePasswordModal.confirmPassword'))).toBeInTheDocument();
  });

  it('renders the updated password-policy constraint text', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(i18n.t('account:changePasswordModal.passwordFormat'))).toBeInTheDocument();
  });

  it('on success closes the modal and dispatches the success notification', async () => {
    (updatePassword as Mock).mockResolvedValue(undefined);
    const setIsOpen = vi.fn();
    render(<ChangePasswordModal isOpen setIsOpen={setIsOpen} />);

    fillField('OldPassword', VALID_INPUT);
    fillField('NewPassword', VALID_INPUT);
    fillField('ConfirmPassword', VALID_INPUT);
    submit();

    await waitFor(() =>
      expect(updatePassword).toHaveBeenCalledWith({
        oldPassword: VALID_INPUT,
        newPassword: VALID_INPUT,
      }),
    );

    // Modal closes.
    await waitFor(() => expect(setIsOpen).toHaveBeenCalledWith(false));

    // Success notification dispatched with the success message.
    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe(i18n.t('account:changePasswordModal.successMessage'));
  });

  it('on a non-Error rejection keeps the modal open and surfaces the generic error', async () => {
    // Exercises the `instanceof Error` ternary's false branch (a thrown value that
    // is not an Error, so it has no `name`): the mapping falls back to the generic key.
    (updatePassword as Mock).mockRejectedValue('a plain string rejection');
    const setIsOpen = vi.fn();
    render(<ChangePasswordModal isOpen setIsOpen={setIsOpen} />);

    fillField('OldPassword', VALID_INPUT);
    fillField('NewPassword', VALID_INPUT);
    fillField('ConfirmPassword', VALID_INPUT);
    submit();

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());

    // Falls back to the generic error string.
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe(i18n.t('account:changePasswordModal.errorGeneric'));

    // Modal stays open on failure.
    expect(setIsOpen).not.toHaveBeenCalled();
  });

  it('on an Error with an empty name keeps the modal open and surfaces the generic error', async () => {
    // Exercises the name-lookup ternary's false branch (an Error whose `name` is
    // falsy, so the map is never consulted): the mapping falls back to the generic key.
    const unnamed = new Error('boom');
    unnamed.name = '';
    (updatePassword as Mock).mockRejectedValue(unnamed);
    const setIsOpen = vi.fn();
    render(<ChangePasswordModal isOpen setIsOpen={setIsOpen} />);

    fillField('OldPassword', VALID_INPUT);
    fillField('NewPassword', VALID_INPUT);
    fillField('ConfirmPassword', VALID_INPUT);
    submit();

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());

    // Falls back to the generic error string.
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe(i18n.t('account:changePasswordModal.errorGeneric'));

    // Modal stays open on failure.
    expect(setIsOpen).not.toHaveBeenCalled();
  });

  it('on NotAuthorizedException keeps the modal open and surfaces the mapped error', async () => {
    const notAuthorized = new Error('Incorrect username or password.');
    notAuthorized.name = 'NotAuthorizedException';
    (updatePassword as Mock).mockRejectedValue(notAuthorized);
    const setIsOpen = vi.fn();
    render(<ChangePasswordModal isOpen setIsOpen={setIsOpen} />);

    fillField('OldPassword', VALID_INPUT);
    fillField('NewPassword', VALID_INPUT);
    fillField('ConfirmPassword', VALID_INPUT);
    submit();

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());

    // Mapped error surfaced.
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe(i18n.t('account:changePasswordModal.errorNotAuthorized'));

    // Modal does NOT close on failure.
    expect(setIsOpen).not.toHaveBeenCalled();
  });

  it.each([
    ['InvalidPasswordException', 'account:changePasswordModal.errorInvalidPassword'],
    ['LimitExceededException', 'account:changePasswordModal.errorLimitExceeded'],
    ['SomeUnexpectedException', 'account:changePasswordModal.errorGeneric'],
  ] as const)('maps a %s rejection to its error message and keeps the modal open', async (errorName, messageKey) => {
    const error = new Error(`${errorName} occurred`);
    error.name = errorName;
    (updatePassword as Mock).mockRejectedValue(error);
    const setIsOpen = vi.fn();
    render(<ChangePasswordModal isOpen setIsOpen={setIsOpen} />);

    fillField('OldPassword', VALID_INPUT);
    fillField('NewPassword', VALID_INPUT);
    fillField('ConfirmPassword', VALID_INPUT);
    submit();

    await waitFor(() => expect(mockDispatch).toHaveBeenCalled());

    // The rejection maps to its distinct i18n error string (unknown errors fall back to the generic one).
    const action = mockDispatch.mock.calls[0][0];
    expect(action.payload.content).toBe(i18n.t(messageKey));

    // Modal stays open on failure.
    expect(setIsOpen).not.toHaveBeenCalled();
  });

  it('on mismatched confirm password shows a field error and does not call updatePassword', async () => {
    const setIsOpen = vi.fn();
    render(<ChangePasswordModal isOpen setIsOpen={setIsOpen} />);

    fillField('OldPassword', VALID_INPUT);
    fillField('NewPassword', VALID_INPUT);
    fillField('ConfirmPassword', 'Different1!');
    submit();

    // Client-side mismatch error is surfaced to the user.
    expect(await screen.findByText(i18n.t('account:changePasswordModal.passwordMismatch'))).toBeInTheDocument();

    // updatePassword is never called and the modal stays open.
    expect(updatePassword).not.toHaveBeenCalled();
    expect(setIsOpen).not.toHaveBeenCalled();
  });
});
