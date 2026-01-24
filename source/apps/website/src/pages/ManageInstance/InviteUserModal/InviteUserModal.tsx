// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, useWatch } from 'react-hook-form';
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

const validationSchema = Yup.object().shape({
  email: Yup.string().email('Please enter a valid email address').required('Email address is required'),
});

const InviteUserModal = ({ isOpen, setIsOpen }: InviteUserModalProps) => {
  const dispatch = useAppDispatch();
  const [createProfile, { isLoading: isCreatingProfile }] = useCreateProfileMutation();

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
            content: `User invitation sent to ${formValues.email}`,
          }),
        );

        reset(initialValues);
        setIsOpen(false);
      } catch (error) {
        console.error('Failed to invite user');
        dispatch(
          displayErrorNotification({
            content: 'Failed to invite user. Please try again.',
          }),
        );
      }
    }
  };

  return (
    <Modal onDismiss={handleClose} visible={isOpen} closeAriaLabel="Close modal" size="medium" header="Invite user">
      <form onSubmit={handleFormSubmit(handleSubmit)}>
        <Form
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button formAction="none" onClick={handleClose}>
                Cancel
              </Button>
              <Button formAction="submit" variant="primary" disabled={!hasEmail} loading={isCreatingProfile}>
                Invite
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <InputField
              control={control}
              name="email"
              label="Email address"
              description="Enter the email address of the user you want to invite."
              placeholder="Enter email address"
              type="email"
            />
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
};

export default InviteUserModal;
