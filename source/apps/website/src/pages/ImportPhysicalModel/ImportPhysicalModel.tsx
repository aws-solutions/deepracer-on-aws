// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import FormField from '@cloudscape-design/components/form-field';
import Header from '@cloudscape-design/components/header';
import Input from '@cloudscape-design/components/input';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useImportPhysicalModelMutation } from '#services/deepRacer/modelsApi.js';
import { useGetProfileQuery } from '#services/deepRacer/profileApi.js';
import { uploadPhysicalModelArchive } from '#services/deepRacer/uploadUtils.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { environmentConfig } from '#utils/envUtils.js';
import { getPath } from '#utils/pageUtils.js';

import { FileUploadZone } from './components/FileUploadZone.js';
import { MAX_ARCHIVE_SIZE } from './constants.js';

const ImportPhysicalModel = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('importPhysicalModel');
  const dispatch = useAppDispatch();

  const { data: profile } = useGetProfileQuery();
  const profileId = profile?.profileId ?? '';

  const [modelName, setModelName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');
  const [fileError, setFileError] = useState('');

  const [importPhysicalModel] = useImportPhysicalModelMutation();

  const validate = (): boolean => {
    let valid = true;

    if (!modelName.trim() || !/^[a-zA-Z0-9-]+$/.test(modelName)) {
      setNameError(t('validation.modelNameInvalid'));
      valid = false;
    } else {
      setNameError('');
    }

    if (!selectedFile) {
      setFileError(t('validation.fileRequired'));
      valid = false;
    } else if (selectedFile.size > MAX_ARCHIVE_SIZE) {
      setFileError(t('validation.fileTooLarge'));
      valid = false;
    } else if (selectedFile.name.toLowerCase().endsWith('.tar.gz')) {
      setFileError('');
    } else {
      setFileError(t('validation.invalidFileType'));
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async () => {
    if (!validate() || !profileId || !selectedFile) return;

    setIsSubmitting(true);
    setUploadProgress(0);

    try {
      const s3Key = await uploadPhysicalModelArchive(selectedFile, profileId, setUploadProgress);

      await importPhysicalModel({
        modelName,
        s3Bucket: environmentConfig.uploadBucketName,
        s3Path: s3Key,
      }).unwrap();

      dispatch(displaySuccessNotification({ content: t('notifications.importSuccess', { modelName }) }));
      setTimeout(() => {
        navigate(getPath(PageId.MODELS));
      }, 2000);
    } catch (error) {
      // S3 upload failures (Error instances) don't go through baseQuery — surface them explicitly.
      // importPhysicalModel failures (RTK Query error objects) are already shown by baseQuery's default notification.
      const message = error instanceof Error ? error.message : undefined;
      if (message) {
        dispatch(displayErrorNotification({ content: message }));
      }
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  return (
    <SpaceBetween size="l">
      <Header variant="h1">{t('header')}</Header>

      <Container>
        <FileUploadZone
          selectedFile={selectedFile}
          onFileChange={setSelectedFile}
          uploadProgress={uploadProgress}
          errorText={fileError}
          disabled={isSubmitting}
        />
      </Container>

      <Container>
        <SpaceBetween size="l">
          <FormField
            label={t('modelInfo.nameLabel')}
            errorText={nameError}
            description={t('modelInfo.nameDescription')}
          >
            <Input value={modelName} onChange={({ detail }) => setModelName(detail.value)} disabled={isSubmitting} />
          </FormField>
        </SpaceBetween>
      </Container>

      <SpaceBetween size="xs" direction="horizontal" alignItems="center">
        <Button variant="link" onClick={() => navigate(-1)} disabled={isSubmitting}>
          {t('buttons.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
          {t('buttons.import')}
        </Button>
      </SpaceBetween>
    </SpaceBetween>
  );
};

export default ImportPhysicalModel;
