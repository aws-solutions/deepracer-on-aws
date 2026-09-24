// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Profile } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteProfileModelsMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

interface DeleteUserModelsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUser: Profile | null;
}

const DeleteUserModelsModal = ({ isOpen, setIsOpen, selectedUser }: DeleteUserModelsModalProps) => {
  const { t } = useTranslation('manageInstance');
  const dispatch = useAppDispatch();
  const [deleteProfileModels, { isLoading: isDeletingModels }] = useDeleteProfileModelsMutation();

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDeleteModels = async () => {
    if (!selectedUser?.profileId) {
      return;
    }

    try {
      await deleteProfileModels({
        profileId: selectedUser.profileId,
      }).unwrap();

      dispatch(
        displaySuccessNotification({
          content: t('deleteUserModelsModal.notifications.success', { alias: selectedUser.alias }),
        }),
      );

      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete user models');
      dispatch(
        displayErrorNotification({
          content: t('deleteUserModelsModal.notifications.error'),
        }),
      );
    }
  };

  return (
    <Modal
      onDismiss={handleClose}
      visible={isOpen}
      closeAriaLabel="Close modal"
      size="medium"
      header={t('deleteUserModelsModal.header')}
    >
      <SpaceBetween size="m">
        <div>{t('deleteUserModelsModal.confirmMessage', { alias: selectedUser?.alias })}</div>
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleClose}>{t('deleteUserModelsModal.buttons.cancel')}</Button>
          <Button variant="primary" onClick={handleDeleteModels} loading={isDeletingModels}>
            {t('deleteUserModelsModal.buttons.delete')}
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default DeleteUserModelsModal;
