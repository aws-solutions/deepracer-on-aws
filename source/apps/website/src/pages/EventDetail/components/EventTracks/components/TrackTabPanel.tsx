// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useRef } from 'react';
import { type Resolver, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import AddTrackFields from './AddTrackFields';
import { addTrackValidationSchema, AddTrackFormValues } from './validation.js';

export interface TrackTabPanelProps {
  track: AddTrackFormValues;
  /** Called whenever any field changes, with the panel's current (possibly invalid) values. */
  onChange: (track: AddTrackFormValues) => void;
  onDelete: () => void;
  deleteDisabled: boolean;
}

/**
 * Editable per-track panel shown as a Tabs' tab content — matches DREM's
 * leaderboardConfigPanel.tsx (`LeaderBoardConfigPanel`) exactly: fields for name/footer/
 * fleet, live-synced back to the parent's track list as they change (DREM commits on
 * `onBlur` via raw local state; this achieves the same effect idiomatically through RHF
 * by watching the per-tab form and pushing every change up), plus a bottom-right Delete
 * button. Wrapped in its own Container (DREM's tab content has no such wrapper — Tabs
 * itself supplies the "container" chrome there — but a dedicated Container groups the
 * per-track editing area from the tab strip more explicitly here).
 */
const TrackTabPanel = ({ track, onChange, onDelete, deleteDisabled }: TrackTabPanelProps) => {
  const { t } = useTranslation('events');

  const { control, reset } = useForm<AddTrackFormValues>({
    defaultValues: track,
    resolver: yupResolver(addTrackValidationSchema) as unknown as Resolver<AddTrackFormValues>,
    mode: 'onBlur',
  });

  // React Hook Form only reads defaultValues at mount. When the parent hydrates or
  // replaces this track's values (e.g. Edit Event populating from the persisted
  // leaderboard after the query fulfills), reset the form so the fields reflect the
  // new values instead of the stale mount-time snapshot.
  const trackKey = `${track.leaderboardId ?? ''}|${track.leaderBoardTitle}|${track.leaderBoardFooter}|${track.fleetId}`;
  const isFirstRender = useRef(true);
  const skipNextSyncRef = useRef(false);
  const lastResetKeyRef = useRef(trackKey);
  useEffect(() => {
    if (lastResetKeyRef.current === trackKey) return;
    lastResetKeyRef.current = trackKey;
    skipNextSyncRef.current = true;
    reset(track);
    // Reset only when the incoming track identity/values change — `track` is a fresh
    // object each render, so key off its stable serialized values instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackKey, reset]);

  const watchedValues = useWatch({ control });

  // Skip the first run — useWatch's initial value is just the passed-in `track` echoed
  // back, so calling onChange with it would fire a redundant update on every mount
  // (including when a NEW tab is added, which would otherwise immediately re-report
  // the very values the parent just supplied).
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false;
      return;
    }
    onChange(watchedValues as AddTrackFormValues);
    // Only re-sync when the watched form values themselves change — including `onChange`
    // in deps would re-run this on every parent re-render triggered BY this same effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedValues]);

  return (
    <SpaceBetween size="xl">
      <Header variant="h2">{t('detail.tracks.trackSettingsHeader')}</Header>
      <AddTrackFields control={control} />
      <Box float="right">
        <Button onClick={onDelete} disabled={deleteDisabled}>
          {t('detail.tracks.removeTrackButton')}
        </Button>
      </Box>
    </SpaceBetween>
  );
};

export default TrackTabPanel;
