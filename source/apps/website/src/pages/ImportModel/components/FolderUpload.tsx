// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { UseFormRegister } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ImportModelFormValues } from '../types';

interface FolderUploadProps {
  register: UseFormRegister<ImportModelFormValues>;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedFolder: string;
  uploadProgress: number;
  fileStatuses: Record<string, boolean>;
  errorText?: string;
  disabled?: boolean;
}

export const FolderUpload = ({
  register,
  onFileChange,
  selectedFolder,
  uploadProgress,
  fileStatuses,
  errorText,
  disabled = false,
}: FolderUploadProps) => {
  const { t } = useTranslation('importModel');

  return (
    <FormField stretch errorText={errorText}>
      {uploadProgress > 0 && uploadProgress < 100 ? (
        <SpaceBetween size="m">
          <ProgressBar
            data-testid="upload-progress"
            value={uploadProgress}
            label="Upload progress"
            description={`Uploading model files: ${uploadProgress}%`}
          />
          <Box>
            {Object.entries(fileStatuses).map(([fileName, isComplete]) => (
              <div key={fileName} style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <StatusIndicator data-testid={`status-${fileName}`} type={isComplete ? 'success' : 'in-progress'}>
                  {fileName}
                </StatusIndicator>
              </div>
            ))}
          </Box>
        </SpaceBetween>
      ) : (
        <div
          style={{
            border: '2px dashed #d5dbdb',
            backgroundColor: '#f2f3f3',
            cursor: disabled ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            opacity: disabled ? 0.7 : 1,
          }}
          onClick={() => !disabled && document.getElementById('file-input')?.click()}
        >
          <Box margin={{ bottom: 'l' }} padding="l" color="inherit" textAlign="center">
            <SpaceBetween size="s" direction="vertical" alignItems="center">
              <Box variant="p" color="text-body-secondary">
                {t('description')}
              </Box>
              <Box padding={{ top: 's' }}>
                <Button iconName="upload" variant="primary" disabled={disabled} formAction="none">
                  Upload folder
                </Button>
              </Box>
              {selectedFolder && <Box color="text-body-secondary">Selected folder: {selectedFolder}</Box>}
            </SpaceBetween>
          </Box>
          <input
            id="file-input"
            data-testid="file-input"
            type="file"
            {...register('files', {
              onChange: onFileChange,
            })}
            // @ts-expect-error webkitdirectory and directory are valid but not in TypeScript types
            webkitdirectory="true"
            directory="true"
            multiple
            disabled={disabled}
            style={{ display: 'none' }}
          />
        </div>
      )}
    </FormField>
  );
};
