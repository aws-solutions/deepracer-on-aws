// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { useCreateProfileMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

interface InviteUserModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

interface InviteFormValues {
  email: string;
}

const InviteUserModal = ({ isOpen, setIsOpen }: InviteUserModalProps) => {
  const { t } = useTranslation('manageInstance');
  const dispatch = useAppDispatch();
  const [createProfile, { isLoading: isCreatingProfile }] = useCreateProfileMutation();

  const validationSchema = Yup.object().shape({
    email: Yup.string()
      .email(t('inviteUserModal.validation.emailInvalid'))
      .required(t('inviteUserModal.validation.emailRequired')),
  });

  const initialValues: InviteFormValues = {
    email: '',
  };

  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    trigger: validateForm,
  } = useForm<InviteFormValues>({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
  });

  const emailValue = useWatch({ control, name: 'email' });
  const hasEmail = emailValue && emailValue.trim().length > 0;

  const handleClose = () => {
    reset(initialValues);
    setIsOpen(false);
  };

  const handleSubmit = async (formValues: InviteFormValues) => {
    const isFormValid = await validateForm();
    if (isFormValid) {
      try {
        await createProfile({
          emailAddress: formValues.email,
        }).unwrap();

        dispatch(
          displaySuccessNotification({
            content: t('inviteUserModal.notifications.success', { email: formValues.email }),
          }),
        );

        reset(initialValues);
        setIsOpen(false);
      } catch (error) {
        console.error('Failed to invite user');
        dispatch(
          displayErrorNotification({
            content: t('inviteUserModal.notifications.error'),
          }),
        );
      }
    }
  };

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel="Close modal"
      size="medium"
      header={t('inviteUserModal.header')}
    >
      <form onSubmit={handleFormSubmit(handleSubmit)}>
        <Form
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button formAction="none" onClick={handleClose}>
                {t('inviteUserModal.buttons.cancel')}
              </Button>
              <Button formAction="submit" variant="primary" disabled={!hasEmail} loading={isCreatingProfile}>
                {t('inviteUserModal.buttons.invite')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <InputField
              control={control}
              name="email"
              label={t('inviteUserModal.email.label')}
              description={t('inviteUserModal.email.description')}
              placeholder={t('inviteUserModal.email.placeholder')}
              type="email"
            />
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
};

export default InviteUserModal;
