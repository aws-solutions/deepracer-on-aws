// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { updatePassword } from 'aws-amplify/auth';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import { VALID_PASSWORD_PATTERN } from '#constants/validation';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import i18n from '#i18n/index.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';

interface PasswordDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface ChangePasswordFormValues {
  OldPassword: string;
  NewPassword: string;
  ConfirmPassword: string;
}

const initialValues: ChangePasswordFormValues = { OldPassword: '', NewPassword: '', ConfirmPassword: '' };

/**
 * Maps an `aws-amplify/auth` `updatePassword` error to a distinct
 * `account:changePasswordModal.*` i18n key, falling back to a generic message
 * for any other or unknown error.
 */
type ChangePasswordErrorKey =
  | 'changePasswordModal.errorNotAuthorized'
  | 'changePasswordModal.errorInvalidPassword'
  | 'changePasswordModal.errorLimitExceeded'
  | 'changePasswordModal.errorGeneric';

const ERROR_MESSAGE_KEY_BY_NAME = new Map<string, ChangePasswordErrorKey>([
  ['NotAuthorizedException', 'changePasswordModal.errorNotAuthorized'],
  ['InvalidPasswordException', 'changePasswordModal.errorInvalidPassword'],
  ['LimitExceededException', 'changePasswordModal.errorLimitExceeded'],
]);

const getErrorMessageKey = (error: unknown): ChangePasswordErrorKey => {
  const name = error instanceof Error ? error.name : undefined;
  return (name ? ERROR_MESSAGE_KEY_BY_NAME.get(name) : undefined) ?? 'changePasswordModal.errorGeneric';
};

const validationSchema = Yup.object().shape({
  OldPassword: Yup.string()
    .required(i18n.t('account:required'))
    .matches(VALID_PASSWORD_PATTERN, i18n.t('account:changePasswordModal.passwordFormat')),
  NewPassword: Yup.string()
    .required(i18n.t('account:required'))
    .matches(VALID_PASSWORD_PATTERN, i18n.t('account:changePasswordModal.passwordFormat')),
  ConfirmPassword: Yup.string()
    .required(i18n.t('account:required'))
    .oneOf([Yup.ref('NewPassword')], i18n.t('account:changePasswordModal.passwordMismatch')),
});

/**
 * TODO:
 * - Add banners for notifications
 * - Add info link
 */
const ChangePasswordModal = ({ isOpen, setIsOpen }: PasswordDialogProps) => {
  const { t } = useTranslation('account');
  const dispatch = useAppDispatch();
  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
  } = useForm<ChangePasswordFormValues>({
    values: initialValues,
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
  });

  const handleClose = () => {
    reset(initialValues);
    setIsOpen(false);
  };

  // `react-hook-form`'s `handleSubmit` only invokes this handler once the form
  // passes the Yup schema, so no additional validity guard is needed here.
  const handleSubmit = async ({ OldPassword, NewPassword }: ChangePasswordFormValues) => {
    try {
      await updatePassword({
        oldPassword: OldPassword,
        newPassword: NewPassword,
      });
      dispatch(
        displaySuccessNotification({
          content: t('changePasswordModal.successMessage'),
        }),
      );
      handleClose();
    } catch (e) {
      // Keep the modal open so the user can correct the problem and retry.
      dispatch(
        displayErrorNotification({
          content: t(getErrorMessageKey(e)),
        }),
      );
    }
  };

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel={t('changePasswordModal.closeModal')}
      size="medium"
      header={t('changePasswordModal.updatePasswordHeader')}
    >
      <form onSubmit={handleFormSubmit(handleSubmit)}>
        <Form
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button formAction="none" onClick={() => handleClose()}>
                {t('changePasswordModal.cancel')}
              </Button>
              <Button formAction="submit" variant="primary">
                {t('changePasswordModal.changePassword')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="m">
            <InputField
              label={t('changePasswordModal.currPassword')}
              control={control}
              placeholder={t('changePasswordModal.yourPassword')}
              name="OldPassword"
              type="password"
            />
            <InputField
              label={t('changePasswordModal.newPassword')}
              control={control}
              constraintText={t('changePasswordModal.passwordFormat')}
              placeholder={t('changePasswordModal.newPassPlaceholder')}
              name="NewPassword"
              type="password"
            />
            <InputField
              label={t('changePasswordModal.confirmPassword')}
              control={control}
              placeholder={t('changePasswordModal.confirmPassPlaceholder')}
              name="ConfirmPassword"
              type="password"
            />
          </SpaceBetween>
          <hr />
        </Form>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
