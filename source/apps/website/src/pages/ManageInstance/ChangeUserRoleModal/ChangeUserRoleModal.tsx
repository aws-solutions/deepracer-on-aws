// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useState } from 'react';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useUpdateGroupMembershipMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

import { roleOptions } from './constants';
import { getCurrentRole } from './helpers';
import { ChangeUserRoleModalProps } from './types';

const ChangeUserRoleModal = ({ isOpen, setIsOpen, selectedUser, onClearSelection }: ChangeUserRoleModalProps) => {
  const dispatch = useAppDispatch();
  const [updateGroupMembership, { isLoading: isUpdatingRole }] = useUpdateGroupMembershipMutation();

  const [selectedRole, setSelectedRole] = useState(getCurrentRole(selectedUser));

  useEffect(() => {
    setSelectedRole(getCurrentRole(selectedUser));
  }, [selectedUser]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedRole(getCurrentRole(selectedUser));
  };

  const handleChangeRole = async () => {
    if (!selectedUser?.profileId || !selectedRole) {
      return;
    }

    try {
      await updateGroupMembership({
        profileId: selectedUser.profileId,
        targetUserPoolGroup: selectedRole.value,
      }).unwrap();

      dispatch(
        displaySuccessNotification({
          content: `User ${selectedUser.alias}'s role has been changed to ${selectedRole.label}. Please allow 1-2 minutes for this change to take effect.`,
        }),
      );

      onClearSelection?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to change user role');
      dispatch(
        displayErrorNotification({
          content: 'Failed to change user role. Please try again.',
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
      header="Change user role"
    >
      <SpaceBetween size="m">
        <div>
          <Select
            selectedOption={selectedRole}
            onChange={({ detail }) => setSelectedRole(detail.selectedOption as typeof selectedRole)}
            options={roleOptions}
            placeholder="Select a role"
            disabled={isUpdatingRole}
          />
          <div style={{ marginTop: '8px', color: '#5f6b7a' }}>
            Please note the following when changing a user's role:
            <ul>
              <li>
                If the user whose role you are updating has a current session, they will need to log out and log back in
                for their role change to take effect.
              </li>
              <li>A successful role change will take 1-2 minutes to propagate and reflect in the Users table.</li>
            </ul>
          </div>
        </div>
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleChangeRole}
            loading={isUpdatingRole}
            disabled={!selectedRole || selectedRole === getCurrentRole(selectedUser)}
          >
            Change
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default ChangeUserRoleModal;
