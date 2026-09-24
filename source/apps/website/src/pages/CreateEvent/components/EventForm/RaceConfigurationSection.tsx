// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { CombinedScoringStrategy, RaceFormat } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import InputField from '#components/FormFields/InputField';
import SelectField from '#components/FormFields/SelectField';
import TrackTypeDropdown from '#pages/EventDetail/components/EventTracks/components/TrackTypeDropdown';

import {
  AVERAGE_LAPS_WINDOW_OPTION_VALUES,
  CreateEventFormValues,
  MAX_RESETS_OPTION_VALUES,
  MAX_RESETS_UNLIMITED_SENTINEL,
  MAX_RUNS_PER_RACER_OPTION_VALUES,
  MAX_TIME_IN_MINUTES_OPTION_VALUES,
} from '../../validation';

export interface RaceConfigurationSectionProps {
  control: Control<CreateEventFormValues>;
  /** Current raceFormat, used to enable the average-laps window only for AVERAGE_LAPS. */
  raceFormat: RaceFormat | '';
  /** Locked once the event advances past DRAFT (OPEN and beyond). */
  isConfigLocked: boolean;
  /** Number of tracks currently configured. Combined scoring is only relevant when ≥2. */
  trackCount?: number;
}

/**
 * The "Race configuration" form section (track layout, race format, lap/time/reset caps,
 * combined scoring) shared by the Create and Edit event pages. All Select options are
 * built here (mirroring DREM's raceConfigPanel.tsx) so both pages stay consistent.
 */
const RaceConfigurationSection = ({
  control,
  raceFormat,
  isConfigLocked,
  trackCount = 0,
}: RaceConfigurationSectionProps) => {
  const { t } = useTranslation('events');

  const raceFormatOptions = useMemo(
    () => Object.values(RaceFormat).map((value) => ({ value, label: t(`raceFormat.${value}`) })),
    [t],
  );

  const combinedScoringOptions = useMemo(
    () => [
      { value: '', label: '—' },
      ...Object.values(CombinedScoringStrategy).map((value) => ({
        value,
        label: t(`combinedScoringStrategy.${value}`),
      })),
    ],
    [t],
  );

  // Mirrors DREM's MaxRunsPerRacerConfig (raceConfigPanel.tsx): "Unlimited" plus a fixed set of caps.
  const maxRunsPerRacerOptions = useMemo(
    () => [
      { value: '', label: t('form.fields.maxRunsPerRacer.unlimitedOption') },
      ...MAX_RUNS_PER_RACER_OPTION_VALUES.filter((value) => value !== '').map((value) => ({ value, label: value })),
    ],
    [t],
  );

  // Mirrors DREM's RaceTimeConfig (raceConfigPanel.tsx): fixed 1-10 minutes, no "Unlimited" option.
  const maxTimeInMinutesOptions = useMemo(
    () => MAX_TIME_IN_MINUTES_OPTION_VALUES.map((value) => ({ value, label: value })),
    [],
  );

  // Mirrors DREM's ResetConfig (raceConfigPanel.tsx): "Unlimited" (sentinel 9999) plus a fixed set of caps.
  const maxResetsOptions = useMemo(
    () =>
      MAX_RESETS_OPTION_VALUES.map((value) => ({
        value,
        label: value === MAX_RESETS_UNLIMITED_SENTINEL ? t('form.fields.maxResets.unlimitedOption') : value,
      })),
    [t],
  );

  // Mirrors DREM's AverageLapWindowConfig (raceConfigPanel.tsx): fixed 3-7, no "Unlimited" option.
  const averageLapsWindowOptions = useMemo(
    () => AVERAGE_LAPS_WINDOW_OPTION_VALUES.map((value) => ({ value, label: value })),
    [],
  );

  // Only meaningful when raceFormat is AVERAGE_LAPS — DREM disables (rather than hides) the
  // equivalent field otherwise (raceConfigPanel.tsx), so this mirrors that via `disabled`.
  const isAverageLapsFormat = raceFormat === RaceFormat.AVERAGE_LAPS;

  // Combined scoring only applies to multi-track events (≥2 tracks).
  const isCombinedScoringEnabled = !isConfigLocked && trackCount >= 2;

  return (
    <Container header={<Header variant="h2">{t('form.sections.raceConfiguration')}</Header>}>
      <SpaceBetween size="m">
        <TrackTypeDropdown
          control={control}
          name="trackType"
          label={t('form.fields.trackType.label')}
          placeholder={t('form.fields.trackType.placeholder')}
          description={t('form.fields.trackType.description')}
          disabled={isConfigLocked}
          data-testid="select-track-type"
        />
        <SelectField
          control={control}
          name="raceFormat"
          label={t('form.fields.raceFormat.label')}
          placeholder={t('form.fields.raceFormat.placeholder')}
          description={t('form.fields.raceFormat.description')}
          options={raceFormatOptions}
          disabled={isConfigLocked}
          data-testid="select-race-format"
        />
        <InputField
          control={control}
          name="maxLaps"
          label={t('form.fields.maxLaps.label')}
          description={t('form.fields.maxLaps.description')}
          type="number"
          disabled={isConfigLocked}
        />
        <SelectField
          control={control}
          name="maxTimeInMinutes"
          label={t('form.fields.maxTimeInMinutes.label')}
          description={t('form.fields.maxTimeInMinutes.description')}
          options={maxTimeInMinutesOptions}
          disabled={isConfigLocked}
          data-testid="select-max-time-in-minutes"
        />
        <SelectField
          control={control}
          name="maxRunsPerRacer"
          label={t('form.fields.maxRunsPerRacer.label')}
          description={t('form.fields.maxRunsPerRacer.description')}
          options={maxRunsPerRacerOptions}
          disabled={isConfigLocked}
          data-testid="select-max-runs-per-racer"
        />
        <SelectField
          control={control}
          name="maxResets"
          label={t('form.fields.maxResets.label')}
          description={t('form.fields.maxResets.description')}
          options={maxResetsOptions}
          disabled={isConfigLocked}
          data-testid="select-max-resets"
        />
        <SelectField
          control={control}
          name="averageLapsWindow"
          label={t('form.fields.averageLapsWindow.label')}
          description={t('form.fields.averageLapsWindow.description')}
          options={averageLapsWindowOptions}
          disabled={isConfigLocked || !isAverageLapsFormat}
          data-testid="select-average-laps-window"
        />
        <SelectField
          control={control}
          name="combinedScoringStrategy"
          label={t('form.fields.combinedScoringStrategy.label')}
          placeholder={t('form.fields.combinedScoringStrategy.placeholder')}
          description={t('form.fields.combinedScoringStrategy.description')}
          options={combinedScoringOptions}
          disabled={!isCombinedScoringEnabled}
          data-testid="select-combined-scoring-strategy"
        />
      </SpaceBetween>
    </Container>
  );
};

export default RaceConfigurationSection;
