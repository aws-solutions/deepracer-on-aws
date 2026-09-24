// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Event } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

interface DeleteEventModalProps {
  event: Event;
  isDeleting: boolean;
  onDelete: () => void;
  onDismiss: () => void;
}

const DeleteEventModal = ({ event, isDeleting, onDelete, onDismiss }: DeleteEventModalProps) => {
  const { t } = useTranslation('events');

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={t('list.deleteConfirmTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isDeleting}>
              {t('form.cancelButton')}
            </Button>
            <Button variant="primary" onClick={onDelete} loading={isDeleting}>
              {t('list.deleteEventButton')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Alert type="warning">{t('list.deleteConfirmMessage', { name: event.name })}</Alert>
    </Modal>
  );
};

export default DeleteEventModal;
