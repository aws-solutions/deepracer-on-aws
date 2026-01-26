// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { FolderUpload } from '#pages/ImportModel/components/FolderUpload';
import { ModelInfo } from '#pages/ImportModel/components/ModelInfo';
import { MAX_FOLDER_SIZE, REQUIRED_FILES_FOR_IMPORT } from '#pages/ImportModel/constants';
import { ImportModelFormValues } from '#pages/ImportModel/types';
import { validateInputs } from '#pages/ImportModel/utils/validation';
import { useImportModelMutation } from '#services/deepRacer/modelsApi.js';
import {
  displayErrorNotification,
  displayInfoNotification,
  displaySuccessNotification,
} from '#store/notifications/notificationsSlice';
import { getPath } from '#utils/pageUtils.js';

const initialFormValues: ImportModelFormValues = {
  modelName: '',
  modelDescription: '',
  files: undefined,
};

const ImportModel = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('importModel');
  const [importModel, { isLoading: isImportModelLoading }] = useImportModelMutation();
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileStatuses, setFileStatuses] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const dispatch = useDispatch();

  const validateFiles = (files: FileList | null): string | undefined => {
    if (!files || files.length === 0) {
      return t('validation.filesRequired');
    }

    const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_FOLDER_SIZE) {
      return t('validation.folderSizeExceeds');
    }

    const requiredFiles = REQUIRED_FILES_FOR_IMPORT;
    const foundFiles = Array.from(files).map((file) => file.webkitRelativePath.split('/').pop() || '');
    const missingFiles = requiredFiles.filter((file) => !foundFiles.includes(file));

    if (missingFiles.length > 0) {
      return t('validation.missingRequiredFiles', { files: missingFiles.join(', ') });
    }
    return undefined;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const folderPath = files[0].webkitRelativePath.split('/')[0];
    const error = validateFiles(files);

    if (error) {
      setSelectedFolder('');
      dispatch(
        displayErrorNotification({
          content: error,
        }),
      );
    } else {
      setSelectedFolder(folderPath);
    }
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ImportModelFormValues>({
    mode: 'onChange',
    defaultValues: initialFormValues,
    resolver: async (values) => {
      const validationErrors: Record<string, { type: string; message: string }> = {
        ...validateInputs(values),
      };

      const fileError = validateFiles(values.files || null);
      if (fileError) {
        validationErrors.files = {
          type: 'invalid',
          message: fileError,
        };
      }

      return {
        values,
        errors: validationErrors,
      };
    },
  });

  const onSubmit = async (formValues: ImportModelFormValues) => {
    if (!formValues.files) return;

    setIsSubmitting(true);
    const files = Array.from(formValues.files);

    try {
      dispatch(
        displayInfoNotification({
          content: t('notifications.startModelUpload'),
        }),
      );
      // Initialize file statuses
      const initialStatuses = files.reduce(
        (acc, file) => {
          acc[file.name] = false;
          return acc;
        },
        {} as Record<string, boolean>,
      );
      setFileStatuses(initialStatuses);
      const result = await importModel({
        modelName: formValues.modelName,
        modelDescription: formValues.modelDescription,
        files,
        onProgress: (progress, completedFile?: string) => {
          setUploadProgress(progress);
          if (completedFile) {
            setFileStatuses((prev) => ({
              ...prev,
              [completedFile]: true,
            }));
          }
        },
      }).unwrap();
      dispatch(
        displaySuccessNotification({
          content: t('notifications.uploadModelSuccess'),
        }),
      );
      setTimeout(() => {
        navigate(getPath(PageId.MODEL_DETAILS, { modelId: result.modelId }));
      }, 2000);
    } catch (error) {
      dispatch(
        displayErrorNotification({
          content: (error as Error).message,
        }),
      );
      setUploadProgress(0);
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SpaceBetween size="l">
        <Header variant="h1">{t('title')}</Header>

        <Container>
          <SpaceBetween size="l">
            <FolderUpload
              register={register}
              onFileChange={handleFileChange}
              selectedFolder={selectedFolder}
              uploadProgress={uploadProgress}
              fileStatuses={fileStatuses}
              errorText={errors.files?.message}
              disabled={isSubmitting || isImportModelLoading}
            />
          </SpaceBetween>
        </Container>

        <Container>
          <ModelInfo
            control={control}
            nameErrorText={errors.modelName?.message}
            descriptionErrorText={errors.modelDescription?.message}
            isSubmitting={isSubmitting || isImportModelLoading}
          />
        </Container>

        <SpaceBetween size="xs" direction="horizontal" alignItems="center">
          <Button
            data-testid="cancel-button"
            variant="link"
            onClick={() => navigate(-1)}
            disabled={isSubmitting || isImportModelLoading}
          >
            {t('buttons.cancel')}
          </Button>
          <Button
            data-testid="import-button"
            variant="primary"
            loading={isImportModelLoading}
            formAction="submit"
            disabled={isSubmitting}
          >
            {t('buttons.import')}
          </Button>
        </SpaceBetween>
      </SpaceBetween>
    </form>
  );
};

export default ImportModel;
