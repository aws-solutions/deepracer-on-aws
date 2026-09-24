// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Form from '@cloudscape-design/components/form';
import KeyValuePairs from '@cloudscape-design/components/key-value-pairs';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Lap } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import * as Yup from 'yup';

import InputField from '#components/FormFields/InputField';
import TextareaField from '#components/FormFields/TextareaField';
import i18n from '#i18n/index.js';
import { millisToMinutesAndSeconds, minutesAndSecondsToMillis } from '#utils/dateTimeUtils.js';

export interface LapEditFormValues {
  lapTimeMs: number;
  editReason: string;
}

interface LapEditFormFields {
  lapTime: string;
  editReason: string;
}

interface LapEditModalProps {
  lap: Lap;
  isSubmitting: boolean;
  onSubmit: (values: LapEditFormValues) => void;
  onDismiss: () => void;
}

const lapEditValidationSchema = Yup.object({
  lapTime: Yup.string()
    .required(() => i18n.t('events:detail.runs.lapEdit.validation.lapTimeRequired'))
    .test(
      'is-valid-lap-time',
      () => i18n.t('events:detail.runs.lapEdit.validation.lapTimeInvalid'),
      (value) => minutesAndSecondsToMillis(value ?? '') !== undefined,
    )
    .test(
      'is-positive-lap-time',
      () => i18n.t('events:detail.runs.lapEdit.validation.lapTimePositive'),
      (value) => (minutesAndSecondsToMillis(value ?? '') ?? 0) > 0,
    ),
  editReason: Yup.string()
    .trim()
    .required(() => i18n.t('events:detail.runs.lapEdit.validation.editReasonRequired')),
});

const LapEditModal = ({ lap, isSubmitting, onSubmit, onDismiss }: LapEditModalProps) => {
  const { t } = useTranslation('events');

  const { control, handleSubmit, trigger } = useForm<LapEditFormFields>({
    defaultValues: { lapTime: millisToMinutesAndSeconds(lap.lapTimeMs), editReason: '' },
    resolver: yupResolver(lapEditValidationSchema),
    mode: 'onBlur',
  });

  const handleFormSubmit = async (values: LapEditFormFields) => {
    if (await trigger()) {
      const lapTimeMs = minutesAndSecondsToMillis(values.lapTime);
      if (lapTimeMs === undefined) return;
      onSubmit({ lapTimeMs, editReason: values.editReason });
    }
  };

  return (
    <Modal visible onDismiss={onDismiss} header={t('detail.runs.lapEdit.modalHeader', { lapNumber: lap.lapNumber })}>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button formAction="none" onClick={onDismiss} disabled={isSubmitting}>
                {t('form.cancelButton')}
              </Button>
              <Button formAction="submit" variant="primary" loading={isSubmitting}>
                {t('detail.runs.lapEdit.saveButton')}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {lap.originalLapTimeMs !== undefined && (
              <Alert type="info" header={t('detail.runs.lapEdit.historyTitle')}>
                <KeyValuePairs
                  columns={2}
                  items={[
                    {
                      label: t('detail.runs.lapEdit.history.originalLapTime'),
                      value: millisToMinutesAndSeconds(lap.originalLapTimeMs),
                    },
                    {
                      label: t('detail.runs.lapEdit.history.editedBy'),
                      value: lap.editedBy ?? '—',
                    },
                    {
                      label: t('detail.runs.lapEdit.history.editedAt'),
                      value: lap.editedAt ? new Date(lap.editedAt).toLocaleString() : '—',
                    },
                    {
                      label: t('detail.runs.lapEdit.history.editReason'),
                      value: lap.editReason ?? '—',
                    },
                  ]}
                />
              </Alert>
            )}
            <Box>{t('detail.runs.lapEdit.description', { lapNumber: lap.lapNumber })}</Box>
            <InputField
              control={control}
              name="lapTime"
              type="text"
              label={t('detail.runs.lapEdit.fields.lapTimeMs.label')}
              description={t('detail.runs.lapEdit.fields.lapTimeMs.description')}
              placeholder="mm:ss.sss"
            />
            <TextareaField
              control={control}
              name="editReason"
              label={t('detail.runs.lapEdit.fields.editReason.label')}
              description={t('detail.runs.lapEdit.fields.editReason.description')}
              placeholder={t('detail.runs.lapEdit.fields.editReason.placeholder')}
            />
          </SpaceBetween>
        </Form>
      </form>
    </Modal>
  );
};

export default LapEditModal;
