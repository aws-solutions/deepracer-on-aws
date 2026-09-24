// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Device } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface DeleteDeviceModalProps {
  device: Device;
  isDeleting: boolean;
  isVisible: boolean;
  onDelete: () => void;
  onDismiss: () => void;
}

const DeleteDeviceModal = ({ device, isDeleting, isVisible, onDelete, onDismiss }: DeleteDeviceModalProps) => {
  const { t } = useTranslation('devices');

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('detail.deleteConfirmTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isDeleting}>
              {t('detail.cancel')}
            </Button>
            <Button variant="primary" onClick={onDelete} loading={isDeleting}>
              {t('detail.confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Alert type="warning">{t('detail.deleteConfirmMessage', { name: device.name })}</Alert>
    </Modal>
  );
};

export default DeleteDeviceModal;
