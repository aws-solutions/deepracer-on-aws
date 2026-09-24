// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Leaderboard } from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

export interface RemoveTrackModalProps {
  track: Leaderboard;
  isRemoving: boolean;
  onRemove: () => void;
  onDismiss: () => void;
}

const RemoveTrackModal = ({ track, isRemoving, onRemove, onDismiss }: RemoveTrackModalProps) => {
  const { t } = useTranslation('events');

  return (
    <Modal
      visible
      onDismiss={onDismiss}
      header={t('detail.tracks.removeConfirmTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isRemoving}>
              {t('form.cancelButton')}
            </Button>
            <Button variant="primary" onClick={onRemove} loading={isRemoving}>
              {t('detail.tracks.removeTrackButton')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <Alert type="warning">{t('detail.tracks.removeConfirmMessage', { name: track.name })}</Alert>
    </Modal>
  );
};

export default RemoveTrackModal;
