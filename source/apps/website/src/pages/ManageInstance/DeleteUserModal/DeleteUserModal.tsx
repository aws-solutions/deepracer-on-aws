// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Profile } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteProfileMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

interface DeleteUserModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUser: Profile | null;
  onClearSelection?: (() => void) | null;
}

const DeleteUserModal = ({ isOpen, setIsOpen, selectedUser, onClearSelection }: DeleteUserModalProps) => {
  const { t } = useTranslation('manageInstance');
  const dispatch = useAppDispatch();
  const [deleteProfile, { isLoading: isDeletingProfile }] = useDeleteProfileMutation();

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser?.profileId) {
      return;
    }

    try {
      await deleteProfile({
        profileId: selectedUser.profileId,
      }).unwrap();

      dispatch(
        displaySuccessNotification({
          content: t('deleteUserModal.notifications.success', { alias: selectedUser.alias }),
        }),
      );

      onClearSelection?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete user');
      dispatch(
        displayErrorNotification({
          content: t('deleteUserModal.notifications.error'),
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
      header={t('deleteUserModal.header')}
    >
      <SpaceBetween size="m">
        <div>{t('deleteUserModal.confirmMessage')}</div>
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleClose}>{t('deleteUserModal.buttons.cancel')}</Button>
          <Button variant="primary" onClick={handleDeleteUser} loading={isDeletingProfile}>
            {t('deleteUserModal.buttons.delete')}
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default DeleteUserModal;
