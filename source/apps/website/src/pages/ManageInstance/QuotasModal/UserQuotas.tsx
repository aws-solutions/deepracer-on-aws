// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Checkbox from '@cloudscape-design/components/checkbox';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Form from '@cloudscape-design/components/form';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Profile } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import { useUpdateProfileMutation } from '#services/deepRacer/profileApi.js';

import { calculateComputeHours, calculateComputeMinutes, getCheckboxValue } from './helpers';

interface UserQuotasModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUser: Profile | null;
  onClearSelection?: (() => void) | null;
}

interface UserQuotasFormValues {
  maxTotalComputeMinutes: number;
  maxModelCount: number;
}

const UserQuotasModal = ({ isOpen, setIsOpen, selectedUser, onClearSelection }: UserQuotasModalProps) => {
  const { t } = useTranslation('manageInstance');
  const [updateProfile] = useUpdateProfileMutation();

  const validationSchema = Yup.object().shape({
    maxTotalComputeMinutes: Yup.number()
      .required(t('quotasModal.validation.required', { label: t('quotasModal.user.computeLabel') }))
      .test('valid-limit', t('quotasModal.validation.invalidLimit'), (value) => {
        return value === -1 || (value !== undefined && value >= 0);
      }),
    maxModelCount: Yup.number()
      .required(t('quotasModal.validation.required', { label: t('quotasModal.user.modelCountLabel') }))
      .test('valid-limit', t('quotasModal.validation.invalidLimit'), (value) => {
        return value === -1 || (value !== undefined && value >= 0);
      }),
  });

  const initialValues: UserQuotasFormValues = {
    maxTotalComputeMinutes: 0,
    maxModelCount: 0,
  };

  const {
    control,
    handleSubmit: handleFormSubmit,
    reset,
    trigger: validateForm,
    setValue,
  } = useForm<UserQuotasFormValues>({
    defaultValues: initialValues,
    resolver: yupResolver(validationSchema),
    mode: 'onBlur',
  });

  const computeValue = useWatch({ control, name: 'maxTotalComputeMinutes' });
  const modelCountValue = useWatch({ control, name: 'maxModelCount' });

  const isComputeUnlimited = computeValue === -1;
  const isModelCountUnlimited = modelCountValue === -1;

  useEffect(() => {
    if (selectedUser && isOpen) {
      const computeMinutes = selectedUser.maxTotalComputeMinutes ?? 0;
      const computeHours = computeMinutes === -1 ? -1 : Math.round(computeMinutes / 60);
      const modelCount = selectedUser.maxModelCount ?? 0;

      setValue('maxTotalComputeMinutes', computeHours);
      setValue('maxModelCount', modelCount);
    }
  }, [selectedUser, isOpen, setValue]);

  const handleClose = () => {
    if (selectedUser) {
      const computeMinutes = selectedUser.maxTotalComputeMinutes ?? 0;
      const computeHours = calculateComputeHours(computeMinutes);
      const modelCount = selectedUser.maxModelCount ?? 0;

      reset({
        maxTotalComputeMinutes: computeHours,
        maxModelCount: modelCount,
      });
    } else {
      reset(initialValues);
    }
    setIsOpen(false);
  };

  const handleSubmit = async (formValues: UserQuotasFormValues) => {
    if (!selectedUser) {
      console.error('No selected user');
      return;
    }

    await validateForm();

    const updatePayload = {
      profileId: selectedUser.profileId,
      alias: selectedUser.alias,
      avatar: selectedUser.avatar,
      maxTotalComputeMinutes: calculateComputeMinutes(formValues.maxTotalComputeMinutes),
      maxModelCount: formValues.maxModelCount,
    };

    try {
      await updateProfile(updatePayload).unwrap();
      if (onClearSelection) {
        onClearSelection();
      }
      setIsOpen(false);
    } catch (err) {
      console.error('Failed to update user quotas');
      alert(t('quotasModal.user.error'));
    }
  };

  const handleCheckboxChange = (fieldName: keyof UserQuotasFormValues, checked: boolean) => {
    setValue(fieldName, getCheckboxValue(checked));
  };

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel="Close modal"
      size="medium"
      header={t('quotasModal.user.header')}
    >
      <form onSubmit={handleFormSubmit(handleSubmit)}>
        <Form
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Button formAction="none" onClick={handleClose}>
                {t('quotasModal.buttons.cancel')}
              </Button>
              <Button formAction="submit" variant="primary">
                {t('quotasModal.buttons.confirm')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <ColumnLayout columns={2}>
              <SpaceBetween size="s">
                <InputField
                  control={control}
                  label={t('quotasModal.user.computeLabel')}
                  description={t('quotasModal.user.computeDescription')}
                  name="maxTotalComputeMinutes"
                  type="text"
                  placeholder={t('quotasModal.computePlaceholder')}
                  disabled={isComputeUnlimited}
                />
                <Checkbox
                  checked={isComputeUnlimited}
                  onChange={(event) => handleCheckboxChange('maxTotalComputeMinutes', event.detail.checked)}
                >
                  {t('quotasModal.unlimited')}
                </Checkbox>
              </SpaceBetween>
              <SpaceBetween size="s">
                <InputField
                  control={control}
                  label={t('quotasModal.user.modelCountLabel')}
                  description={t('quotasModal.user.modelCountDescription')}
                  name="maxModelCount"
                  type="text"
                  placeholder={t('quotasModal.modelCountPlaceholder')}
                  disabled={isModelCountUnlimited}
                />
                <Checkbox
                  checked={isModelCountUnlimited}
                  onChange={(event) => handleCheckboxChange('maxModelCount', event.detail.checked)}
                >
                  {t('quotasModal.unlimited')}
                </Checkbox>
              </SpaceBetween>
            </ColumnLayout>
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
};

export default UserQuotasModal;
