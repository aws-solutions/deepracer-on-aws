// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Modal from '@cloudscape-design/components/modal';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SubmissionVideoModalProps {
  videoUrl: string;
  title: string;
  onDismiss: () => void;
}

/**
 * Streams the submission video directly from the S3 presigned URL.
 *
 * DeepRacer SimApp writes MP4s without `-movflags +faststart` so the moov atom
 * sits at the end of the file. Modern browsers handle this automatically by
 * issuing a Range request to seek to the moov atom before starting playback –
 * this works because the S3Client is configured with
 * `responseChecksumValidation: 'WHEN_REQUIRED'` which keeps Range-compatible
 * presigned URLs clean of checksum headers.
 *
 * If the presigned URL fails to load (403 on a Range request, URL expiry, network
 * error) the `<video>` onError handler surfaces an error message instead of an empty
 * box; browsers without HTML5 video support show the fallback text.
 */
const SubmissionVideoModal = ({ videoUrl, title, onDismiss }: SubmissionVideoModalProps) => {
  const { t } = useTranslation('raceDetails');
  const [hasError, setHasError] = useState(false);

  return (
    <Modal visible onDismiss={onDismiss} header={t('videoModal.header', { title })} size="large">
      <Box textAlign="center">
        {hasError ? (
          <Alert type="error">{t('videoModal.loadError')}</Alert>
        ) : (
          <video
            src={videoUrl}
            controls
            autoPlay
            muted
            preload="auto"
            onError={() => setHasError(true)}
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '4px' }}
          >
            {t('videoModal.noVideoSupport')}
          </video>
        )}
      </Box>
    </Modal>
  );
};

export default SubmissionVideoModal;
