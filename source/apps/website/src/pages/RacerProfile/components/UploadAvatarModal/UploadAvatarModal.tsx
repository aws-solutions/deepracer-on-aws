// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Textarea from '@cloudscape-design/components/textarea';
import { useTranslation } from 'react-i18next';

interface UploadAvatarModalProps {
  handleCloseUploadAvatar: () => void;
  handleUploadAvatar: () => void;
  avatarErrorMessage: string;
  isUploadAvatarOpen: boolean;
  avatarConfigString: string;
  setAvatarConfigString: (updatedConfig: string) => void;
}

const UploadAvatarModal = ({
  handleCloseUploadAvatar,
  handleUploadAvatar,
  avatarErrorMessage,
  isUploadAvatarOpen,
  avatarConfigString,
  setAvatarConfigString,
}: UploadAvatarModalProps) => {
  const { t } = useTranslation('racerProfile');

  return (
    <Modal
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button onClick={handleCloseUploadAvatar} variant="link">
              {t('uploadProfileModal.cancelButton')}
            </Button>
            <Button onClick={handleUploadAvatar} variant="primary">
              {t('uploadProfileModal.okButton')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={t('uploadProfileModal.header')}
      onDismiss={handleCloseUploadAvatar}
      visible={isUploadAvatarOpen}
    >
      <Textarea
        onChange={(event) => {
          setAvatarConfigString(event.detail.value);
        }}
        placeholder={t('uploadProfileModal.textAreaPlaceholder')}
        value={avatarConfigString}
        invalid={!(avatarErrorMessage === '')}
      ></Textarea>
      <Box color="text-status-error" fontSize="body-s" padding={{ top: 'xxxs', left: 's' }}>
        {avatarErrorMessage}
      </Box>
    </Modal>
  );
};

export default UploadAvatarModal;
