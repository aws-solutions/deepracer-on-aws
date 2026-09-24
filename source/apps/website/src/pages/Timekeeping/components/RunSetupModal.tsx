// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Toggle from '@cloudscape-design/components/toggle';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';

export interface RunSetupSelection {
  selectedRacer: SelectProps.Option;
  racedByProxy: boolean;
}

export interface RunSetupModalProps {
  isVisible: boolean;
  isSubmitting?: boolean;
  error?: string;
  onDismiss: () => void;
  onNext: (selection: RunSetupSelection) => void | Promise<void>;
  racerOptions: SelectProps.Options;
  completedRacesByProfileId?: Record<string, number>;
  maxRaces?: number;
}

export const RunSetupModal = ({
  isVisible,
  isSubmitting = false,
  error,
  onDismiss,
  onNext,
  racerOptions,
  completedRacesByProfileId = {},
  maxRaces,
}: RunSetupModalProps) => {
  const { t } = useTranslation('timekeeping');
  const { selectedEventName, selectedTrackName } = useTimekeepingContext();
  const [selectedRacer, setSelectedRacer] = useState<SelectProps.Option | null>(null);
  const [racedByProxy, setRacedByProxy] = useState(false);
  const completedRaces = selectedRacer?.value ? (completedRacesByProfileId[selectedRacer.value] ?? 0) : 0;
  const hasReachedMaxRaces = maxRaces !== undefined && completedRaces >= maxRaces;

  useEffect(() => {
    if (!isVisible) return;
    setSelectedRacer(racerOptions?.length > 0 ? racerOptions[0] : null);
    setRacedByProxy(false);
  }, [isVisible, racerOptions]);

  const handleNext = () => {
    if (!selectedRacer || hasReachedMaxRaces) return;
    void onNext({ selectedRacer, racedByProxy });
  };

  return (
    <Modal
      data-testid="run-setup-modal"
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('runSetup.header', { event: selectedEventName, track: selectedTrackName })}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isSubmitting}>
              {t('runSetup.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              loading={isSubmitting}
              disabled={!selectedRacer?.value || hasReachedMaxRaces}
            >
              {t('runSetup.next')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        {error && <Alert type="error">{error}</Alert>}
        {hasReachedMaxRaces && (
          <Alert type="warning">{t('runSetup.maxRacesReached', { racer: selectedRacer?.label, maxRaces })}</Alert>
        )}
        <ColumnLayout columns={3} minColumnWidth={200}>
          <FormField label={t('runSetup.racerLabel')} description={t('runSetup.racerDescription')}>
            <Select
              selectedOption={selectedRacer}
              onChange={({ detail }) => setSelectedRacer(detail.selectedOption)}
              options={racerOptions}
              placeholder={t('racerSelector.placeholder')}
              filteringType="auto"
              data-testid="run-setup-racer-select"
            />
          </FormField>
          <SpaceBetween size="xs">
            <Box variant="awsui-key-label">{t('runSetup.raceAllowance')}</Box>
            <Box>
              <Box display="inline" variant="awsui-key-label">
                {t('runSetup.completedRaces')}
              </Box>{' '}
              <Box data-testid="run-setup-completed-races" display="inline">
                {completedRaces}
              </Box>
            </Box>
            <Box>
              <Box display="inline" variant="awsui-key-label">
                {t('runSetup.maxRaces')}
              </Box>{' '}
              {maxRaces}
            </Box>
          </SpaceBetween>
          <FormField label={t('runSetup.racedByProxy')} description={t('runSetup.racedByProxyDescription')}>
            <Toggle
              checked={racedByProxy}
              onChange={({ detail }) => setRacedByProxy(detail.checked)}
              data-testid="run-setup-raced-by-proxy-toggle"
            />
          </FormField>
        </ColumnLayout>
      </SpaceBetween>
    </Modal>
  );
};
