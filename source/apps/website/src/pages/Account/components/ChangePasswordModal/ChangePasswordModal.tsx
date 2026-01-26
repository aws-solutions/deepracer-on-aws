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
import i18n from '#i18n/index.js';

interface PasswordDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface ChangePasswordFormValues {
  OldPassword: string;
  NewPassword: string;
}

const initialValues: ChangePasswordFormValues = { OldPassword: '', NewPassword: '' };

const validationSchema = Yup.object().shape({
  OldPassword: Yup.string()
    .required(i18n.t('account:required'))
    .matches(VALID_PASSWORD_PATTERN, i18n.t('account:passwordFormat')),
  NewPassword: Yup.string()
    .required(i18n.t('account:required'))
    .matches(VALID_PASSWORD_PATTERN, i18n.t('account:passwordFormat')),
});

/**
 * TODO:
 * - Add banners for notifications
 * - Add info link
 */
const ChangePasswordModal = ({ isOpen, setIsOpen }: PasswordDialogProps) => {
  const { t } = useTranslation('account');
  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    trigger: validateForm,
  } = useForm<ChangePasswordFormValues>({
    values: initialValues,
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
  });

  const handleClose = () => {
    reset(initialValues);
    setIsOpen(false);
  };

  const handleSubmit = async (formValues: ChangePasswordFormValues) => {
    const isFormValid = await validateForm();
    if (isFormValid) {
      const { OldPassword, NewPassword } = formValues;
      try {
        await updatePassword({
          oldPassword: OldPassword,
          newPassword: NewPassword,
        });
        setIsOpen(false);
      } catch (e) {
        handleClose();
      }
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
          </SpaceBetween>
          <hr />
        </Form>
      </form>
    </Modal>
  );
};

export default ChangePasswordModal;
