// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Textarea from '@cloudscape-design/components/textarea';
import { Control, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ImportModelFormValues } from '../types';

interface ModelInfoProps {
  control: Control<ImportModelFormValues>;
  nameErrorText?: string;
  descriptionErrorText?: string;
  isSubmitting?: boolean;
}

export const ModelInfo = ({ control, nameErrorText, descriptionErrorText, isSubmitting = false }: ModelInfoProps) => {
  const { t } = useTranslation('importModel');

  return (
    <>
      <Controller
        name="modelName"
        control={control}
        render={({ field }) => (
          <FormField
            stretch
            label={t('details.modelName.label')}
            errorText={nameErrorText}
            description={t('details.modelName.description')}
          >
            <Input
              data-testid="model-name-input"
              value={field.value ?? ''}
              onChange={(event) => field.onChange(event.detail.value)}
              disabled={isSubmitting}
            />
          </FormField>
        )}
      />
      <div style={{ marginTop: '20px' }}>
        <Controller
          name="modelDescription"
          control={control}
          render={({ field }) => (
            <FormField
              stretch
              label={t('details.modelDescription.label')}
              errorText={descriptionErrorText}
              description={t('details.modelDescription.description')}
            >
              <Textarea
                data-testid="model-description-input"
                value={field.value ?? ''}
                onChange={(event) => field.onChange(event.detail.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </FormField>
          )}
        />
      </div>
    </>
  );
};
