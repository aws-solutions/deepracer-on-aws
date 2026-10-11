// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListAdminModelsQuery, useListAdminProfilesQuery } from '#services/deepRacer/adminApi.js';

const ANY_VALUE = '';
const MINUTE_MS = 60 * 1000;

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
  const [racerName, setRacerName] = useState(ANY_VALUE);
  const [modelId, setModelId] = useState(ANY_VALUE);
  const [laterThanMinutes, setLaterThanMinutes] = useState(ANY_VALUE);

  const { data: profiles = [], isFetching: isLoadingProfiles } = useListAdminProfilesQuery(undefined, {
    skip: !isVisible,
  });
  const { data: models = [], isFetching: isLoadingModels } = useListAdminModelsQuery({}, { skip: !isVisible });

  useEffect(() => {
    if (!isVisible) {
      setRacerName(ANY_VALUE);
      setModelId(ANY_VALUE);
      setLaterThanMinutes(ANY_VALUE);
    }
  }, [isVisible]);

  const racerOptions = useMemo<SelectProps.Option[]>(
    () => [
      { value: ANY_VALUE, label: t('carLogs.fetchModal.anyRacer') },
      ...profiles
        .map((profile) => ({ value: profile.alias, label: profile.alias }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [profiles, t],
  );

  const modelOptions = useMemo<SelectProps.Option[]>(
    () => [
      { value: ANY_VALUE, label: t('carLogs.fetchModal.anyModel') },
      ...models
        .map((model) => ({
          value: model.modelId,
          label: model.name,
          description: model.username,
          tags: [model.modelId],
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [models, t],
  );

  const laterThanOptions = useMemo<SelectProps.Option[]>(
    () => [
      { value: ANY_VALUE, label: t('carLogs.fetchModal.anyTime') },
      { value: '5', label: t('carLogs.fetchModal.laterThanOptions.m5') },
      { value: '10', label: t('carLogs.fetchModal.laterThanOptions.m10') },
      { value: '30', label: t('carLogs.fetchModal.laterThanOptions.m30') },
      { value: '60', label: t('carLogs.fetchModal.laterThanOptions.h1') },
      { value: '360', label: t('carLogs.fetchModal.laterThanOptions.h6') },
      { value: '1440', label: t('carLogs.fetchModal.laterThanOptions.h24') },
    ],
    [t],
  );

  const findOption = (options: SelectProps.Option[], value: string) =>
    options.find((option) => option.value === value) ?? null;

  const handleSubmit = () => {
    void onSubmit({
      ...(racerName ? { racerName } : {}),
      ...(modelId ? { modelId } : {}),
      ...(laterThanMinutes ? { laterThan: new Date(Date.now() - Number(laterThanMinutes) * MINUTE_MS) } : {}),
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
          <Select
            selectedOption={findOption(racerOptions, racerName)}
            onChange={({ detail }) => setRacerName(detail.selectedOption.value ?? ANY_VALUE)}
            options={racerOptions}
            filteringType="auto"
            statusType={isLoadingProfiles ? 'loading' : 'finished'}
            loadingText={t('carLogs.fetchModal.loading')}
            filteringPlaceholder={t('carLogs.fetchModal.searchPlaceholder')}
            noMatch={t('carLogs.fetchModal.noMatch')}
          />
        </FormField>
        <FormField
          label={t('carLogs.fetchModal.modelIdLabel')}
          description={t('carLogs.fetchModal.modelIdDescription')}
        >
          <Select
            selectedOption={findOption(modelOptions, modelId)}
            onChange={({ detail }) => setModelId(detail.selectedOption.value ?? ANY_VALUE)}
            options={modelOptions}
            filteringType="auto"
            statusType={isLoadingModels ? 'loading' : 'finished'}
            loadingText={t('carLogs.fetchModal.loading')}
            filteringPlaceholder={t('carLogs.fetchModal.searchPlaceholder')}
            noMatch={t('carLogs.fetchModal.noMatch')}
          />
        </FormField>
        <FormField
          label={t('carLogs.fetchModal.laterThanLabel')}
          description={t('carLogs.fetchModal.laterThanDescription')}
        >
          <Select
            selectedOption={findOption(laterThanOptions, laterThanMinutes)}
            onChange={({ detail }) => setLaterThanMinutes(detail.selectedOption.value ?? ANY_VALUE)}
            options={laterThanOptions}
          />
        </FormField>
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
