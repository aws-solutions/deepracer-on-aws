// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import Select from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { useUpdateGroupMembershipMutation } from '#services/deepRacer/profileApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice';

import { getRoleOptions } from './constants';
import { getCurrentRole } from './helpers';
import { ChangeUserRoleModalProps } from './types';

const ChangeUserRoleModal = ({ isOpen, setIsOpen, selectedUser, onClearSelection }: ChangeUserRoleModalProps) => {
  const { t } = useTranslation('manageInstance');
  const dispatch = useAppDispatch();
  const [updateGroupMembership, { isLoading: isUpdatingRole }] = useUpdateGroupMembershipMutation();

  // Memoized on `t` so the array reference is stable across renders (as long as the language
  // doesn't change) — getCurrentRole() returns an option FROM this array, and `selectedRole`
  // state holds an option also drawn from this array, so `selectedRole === getCurrentRole(...)`
  // object-identity comparisons below continue to work correctly.
  const roleOptions = useMemo(() => getRoleOptions(t), [t]);

  const [selectedRole, setSelectedRole] = useState(getCurrentRole(selectedUser, roleOptions));

  useEffect(() => {
    setSelectedRole(getCurrentRole(selectedUser, roleOptions));
  }, [selectedUser, roleOptions]);

  const handleClose = () => {
    setIsOpen(false);
    setSelectedRole(getCurrentRole(selectedUser, roleOptions));
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
          content: t('changeUserRoleModal.notifications.success', {
            alias: selectedUser.alias,
            role: selectedRole.label,
          }),
        }),
      );

      onClearSelection?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to change user role');
      dispatch(
        displayErrorNotification({
          content: t('changeUserRoleModal.notifications.error'),
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
      header={t('changeUserRoleModal.header')}
    >
      <SpaceBetween size="m">
        <div>
          <Select
            selectedOption={selectedRole}
            onChange={({ detail }) => setSelectedRole(detail.selectedOption as typeof selectedRole)}
            options={roleOptions}
            placeholder={t('changeUserRoleModal.rolePlaceholder')}
            disabled={isUpdatingRole}
          />
          <div style={{ marginTop: '8px', color: '#5f6b7a' }}>
            {t('changeUserRoleModal.warning.intro')}
            <ul>
              <li>{t('changeUserRoleModal.warning.sessionLogout')}</li>
              <li>{t('changeUserRoleModal.warning.propagationDelay')}</li>
            </ul>
          </div>
        </div>
        <SpaceBetween size="xs" direction="horizontal">
          <Button onClick={handleClose}>{t('changeUserRoleModal.buttons.cancel')}</Button>
          <Button
            variant="primary"
            onClick={handleChangeRole}
            loading={isUpdatingRole}
            disabled={!selectedRole || selectedRole === getCurrentRole(selectedUser, roleOptions)}
          >
            {t('changeUserRoleModal.buttons.change')}
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </Modal>
  );
};

export default ChangeUserRoleModal;
