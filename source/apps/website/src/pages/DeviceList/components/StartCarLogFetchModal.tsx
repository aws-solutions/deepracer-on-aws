// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Input from '@cloudscape-design/components/input';
import Modal from '@cloudscape-design/components/modal';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface StartCarLogFetchFilters {
  laterThan?: Date;
  modelId?: string;
  racerName?: string;
}

interface StartCarLogFetchModalProps {
  deviceNames: string[];
  isSubmitting: boolean;
  isVisible: boolean;
  onDismiss: () => void;
  onSubmit: (filters: StartCarLogFetchFilters) => void | Promise<void>;
}

const StartCarLogFetchModal = ({
  deviceNames,
  isSubmitting,
  isVisible,
  onDismiss,
  onSubmit,
}: StartCarLogFetchModalProps) => {
  const { t } = useTranslation('devices');
  const [racerName, setRacerName] = useState('');
  const [modelId, setModelId] = useState('');
  const [laterThanText, setLaterThanText] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isVisible) {
      setRacerName('');
      setModelId('');
      setLaterThanText('');
      setError(undefined);
    }
  }, [isVisible]);

  const handleSubmit = () => {
    if (!racerName.trim() && !modelId.trim()) {
      setError(t('carLogs.fetchModal.validation.requiresSelector'));
      return;
    }

    let laterThan: Date | undefined;
    if (laterThanText.trim()) {
      laterThan = new Date(laterThanText.trim());
      if (Number.isNaN(laterThan.getTime())) {
        setError(t('carLogs.fetchModal.validation.invalidLaterThan'));
        return;
      }
    }

    setError(undefined);
    void onSubmit({
      ...(racerName.trim() ? { racerName: racerName.trim() } : {}),
      ...(modelId.trim() ? { modelId: modelId.trim() } : {}),
      ...(laterThan ? { laterThan } : {}),
    });
  };

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('carLogs.fetchModal.header', { count: deviceNames.length })}
      closeAriaLabel={t('carLogs.fetchModal.closeAriaLabel')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isSubmitting}>
              {t('carLogs.fetchModal.cancel')}
            </Button>
            <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
              {t('carLogs.fetchModal.confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <Box>{t('carLogs.fetchModal.description')}</Box>
        <Alert type="info">{t('carLogs.fetchModal.help')}</Alert>
        <FormField
          label={t('carLogs.fetchModal.racerNameLabel')}
          description={t('carLogs.fetchModal.racerNameDescription')}
        >
          <Input value={racerName} onChange={({ detail }) => setRacerName(detail.value)} />
        </FormField>
        <FormField
          label={t('carLogs.fetchModal.modelIdLabel')}
          description={t('carLogs.fetchModal.modelIdDescription')}
        >
          <Input value={modelId} onChange={({ detail }) => setModelId(detail.value)} />
        </FormField>
        <FormField
          label={t('carLogs.fetchModal.laterThanLabel')}
          description={t('carLogs.fetchModal.laterThanDescription')}
        >
          <Input
            value={laterThanText}
            onChange={({ detail }) => setLaterThanText(detail.value)}
            placeholder={t('carLogs.fetchModal.laterThanPlaceholder')}
          />
        </FormField>
        {error && <Alert type="error">{error}</Alert>}
        <ul>
          {deviceNames.map((deviceName) => (
            <li key={deviceName}>{deviceName}</li>
          ))}
        </ul>
      </SpaceBetween>
    </Modal>
  );
};

export default StartCarLogFetchModal;
