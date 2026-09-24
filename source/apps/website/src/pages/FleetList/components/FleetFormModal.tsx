// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Fleet } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useCreateFleetMutation, useUpdateFleetMutation } from '#services/deepRacer/fleetsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';

interface FleetFormModalProps {
  fleet?: Fleet;
  isVisible: boolean;
  onDismiss: () => void;
}

const FleetFormModal = ({ fleet, isVisible, onDismiss }: FleetFormModalProps) => {
  const { t } = useTranslation('fleets');
  const dispatch = useAppDispatch();
  const isEditMode = !!fleet;

  const [name, setName] = useState(fleet?.name ?? '');

  const [createFleet, { isLoading: isCreating }] = useCreateFleetMutation();
  const [updateFleet, { isLoading: isUpdating }] = useUpdateFleetMutation();

  const isSaving = isCreating || isUpdating;

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      if (isEditMode) {
        await updateFleet({ fleetId: fleet.fleetId, name: name.trim() }).unwrap();
        dispatch(
          displaySuccessNotification({
            content: t('list.updateSuccessMessage', { name: name.trim() }),
          }),
        );
      } else {
        await createFleet({ fleetDefinition: { name: name.trim() } }).unwrap();
        dispatch(
          displaySuccessNotification({
            content: t('list.createSuccessMessage', { name: name.trim() }),
            persistForPageChanges: 1,
          }),
        );
      }
      onDismiss();
    } catch {
      dispatch(
        displayErrorNotification({
          content: isEditMode ? t('list.updateErrorMessage') : t('list.createErrorMessage'),
        }),
      );
    }
  };

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={isEditMode ? t('form.editTitle') : t('form.createTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isSaving}>
              {t('form.cancelButton')}
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={isSaving} disabled={!name.trim()}>
              {t('form.saveButton')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label={t('form.nameLabel')}>
        <Input
          value={name}
          onChange={({ detail }) => setName(detail.value)}
          placeholder={t('form.namePlaceholder')}
          disabled={isSaving}
        />
      </FormField>
    </Modal>
  );
};

export default FleetFormModal;
