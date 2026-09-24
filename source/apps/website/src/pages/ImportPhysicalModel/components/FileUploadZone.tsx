// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import ProgressBar from '@cloudscape-design/components/progress-bar';
import SpaceBetween from '@cloudscape-design/components/space-between';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface FileUploadZoneProps {
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  uploadProgress: number;
  errorText?: string;
  disabled?: boolean;
}

export const FileUploadZone = ({
  selectedFile,
  onFileChange,
  uploadProgress,
  errorText,
  disabled = false,
}: FileUploadZoneProps) => {
  const { t } = useTranslation('importPhysicalModel');
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <FormField stretch errorText={errorText}>
      {uploadProgress > 0 && uploadProgress < 100 ? (
        <SpaceBetween size="m">
          <ProgressBar
            data-testid="upload-progress"
            value={uploadProgress}
            label={t('progress.uploading')}
            description={`${uploadProgress}%`}
          />
          {selectedFile && <StatusIndicator type="in-progress">{selectedFile.name}</StatusIndicator>}
        </SpaceBetween>
      ) : (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          style={{
            border: '2px dashed #d5dbdb',
            backgroundColor: '#f2f3f3',
            cursor: disabled ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            opacity: disabled ? 0.7 : 1,
          }}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label={t('description')}
        >
          <Box margin={{ bottom: 'l' }} padding="l" color="inherit" textAlign="center">
            <SpaceBetween size="s" direction="vertical" alignItems="center">
              <Box variant="p" color="text-body-secondary">
                {t('description')}
              </Box>
              <Box padding={{ top: 's' }}>
                <Button iconName="upload" variant="primary" disabled={disabled} formAction="none">
                  {t('modelInfo.chooseFile')}
                </Button>
              </Box>
              {selectedFile && (
                <Box color="text-body-secondary">
                  {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)
                </Box>
              )}
              <Box variant="small" color="text-body-secondary">
                {t('modelInfo.constraint')}
              </Box>
            </SpaceBetween>
          </Box>
          <input
            ref={fileInputRef}
            data-testid="file-input"
            type="file"
            accept=".tar.gz,.gz,application/gzip,application/x-gzip"
            disabled={disabled}
            style={{ display: 'none' }}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      )}
    </FormField>
  );
};
