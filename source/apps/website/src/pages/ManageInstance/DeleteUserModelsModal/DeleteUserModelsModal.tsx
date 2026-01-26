// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Profile } from '@deepracer-indy/typescript-client';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useDeleteProfileModelsMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

interface DeleteUserModelsModalProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  selectedUser: Profile | null;
}

const DeleteUserModelsModal = ({ isOpen, setIsOpen, selectedUser }: DeleteUserModelsModalProps) => {
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
          content: `All models for user ${selectedUser.alias} have been deleted`,
        }),
      );

      setIsOpen(false);
    } catch (error) {
      console.error('Failed to delete user models');
      dispatch(
        displayErrorNotification({
          content: 'Failed to delete user models. Please try again.',
        }),
      );
    }
  };

  return (
    <Modal onDismiss={handleClose} visible={isOpen} closeAriaLabel="Close modal" size="medium" header="Delete models">
      <SpaceBetween size="m">
        <div>
          Delete all models for user {selectedUser?.alias}? This will permanently remove all models associated with this
          user. This action cannot be undone.
        </div>
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleDeleteModels} loading={isDeletingModels}>
            Delete
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default DeleteUserModelsModal;
