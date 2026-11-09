// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FileUpload from '@cloudscape-design/components/file-upload';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useCreateCarLogUploadMutation } from '#services/deepRacer/carLogsApi.js';
import { uploadFileToPresignedUrl } from '#services/deepRacer/uploadUtils.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';

interface UploadCarLogsModalProps {
  isVisible: boolean;
  onDismiss: () => void;
}

const UploadCarLogsModal = ({ isVisible, onDismiss }: UploadCarLogsModalProps) => {
  const { t } = useTranslation('carLogs');
  const dispatch = useAppDispatch();
  const [createCarLogUpload, { isLoading }] = useCreateCarLogUploadMutation();
  const [files, setFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isVisible) {
      setFiles([]);
      setErrorMessage(undefined);
      setSuccessMessage(undefined);
    }
  }, [isVisible]);

  const selectedFile = files[0] ?? null;
  const isFileValid = selectedFile?.name.endsWith('.tar.gz') ?? false;
  const canUpload = Boolean(selectedFile && isFileValid && !successMessage);

  const helperText = useMemo(() => t('upload.helperText'), [t]);

  const handleUpload = async () => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.tar.gz')) {
      setErrorMessage(t('upload.invalidFileType'));
      return;
    }

    setErrorMessage(undefined);

    try {
      const response = await createCarLogUpload().unwrap();
      await uploadFileToPresignedUrl(response.url, selectedFile);
      const message = t('upload.success', { jobId: response.jobId });
      setSuccessMessage(message);
      dispatch(displaySuccessNotification({ content: message }));
    } catch (error) {
      const message = (error as Error).message || t('upload.failed');
      setErrorMessage(message);
      dispatch(displayErrorNotification({ content: message }));
    }
  };

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('upload.header')}
      closeAriaLabel={t('upload.closeAriaLabel')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isLoading}>
              {successMessage ? t('common.close') : t('common.cancel')}
            </Button>
            {!successMessage && (
              <Button variant="primary" onClick={() => void handleUpload()} loading={isLoading} disabled={!canUpload}>
                {t('upload.confirmButton')}
              </Button>
            )}
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box>{t('upload.description')}</Box>
        <Alert type="info">{helperText}</Alert>
        <FormField label={t('upload.fileLabel')} description={t('upload.fileDescription')} stretch>
          <FileUpload
            data-testid="car-log-upload-file-upload"
            value={files}
            onChange={({ detail }) => {
              setFiles(detail.value.slice(0, 1));
              setErrorMessage(undefined);
            }}
            accept=".tar.gz,application/gzip,.gz"
            multiple={false}
            showFileSize
            constraintText={t('upload.constraintText')}
            i18nStrings={{
              uploadButtonText: () => t('upload.fileUpload.uploadButtonText'),
              dropzoneText: () => t('upload.fileUpload.dropzoneText'),
              removeFileAriaLabel: () => t('upload.fileUpload.removeFileAriaLabel'),
              limitShowFewer: t('upload.fileUpload.limitShowFewer'),
              limitShowMore: t('upload.fileUpload.limitShowMore'),
              errorIconAriaLabel: t('upload.fileUpload.errorIconAriaLabel'),
              warningIconAriaLabel: t('upload.fileUpload.warningIconAriaLabel'),
            }}
          />
        </FormField>
        {selectedFile && !isFileValid && <Alert type="error">{t('upload.invalidFileType')}</Alert>}
        {errorMessage && <Alert type="error">{errorMessage}</Alert>}
        {successMessage && <Alert type="success">{successMessage}</Alert>}
      </SpaceBetween>
    </Modal>
  );
};

export default UploadCarLogsModal;
