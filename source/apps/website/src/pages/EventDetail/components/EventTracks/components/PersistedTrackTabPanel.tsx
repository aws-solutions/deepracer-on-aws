// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Leaderboard } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { type Resolver, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { useEditLeaderboardMutation } from '#services/deepRacer/leaderboardsApi.js';
import { displayErrorNotification } from '#store/notifications/notificationsSlice.js';

import AddTrackFields from './AddTrackFields';
import { buildTrackEditDefinition } from './buildTrackEditDefinition.js';
import { addTrackValidationSchema, AddTrackFormValues } from './validation.js';

export interface PersistedTrackTabPanelProps {
  track: Leaderboard;
  onDelete: () => void;
  deleteDisabled: boolean;
  isDeleting: boolean;
}

const toFormValues = (track: Leaderboard): AddTrackFormValues => ({
  leaderBoardTitle: track.name,
  leaderBoardFooter: track.leaderBoardFooter ?? '',
  fleetId: track.fleetId ?? '',
});

/**
 * Editable per-track panel for an already-persisted track (Event Detail's Tracks tab /
 * CreateEvent's edit-mode Tracks section) — the persisted counterpart of TrackTabPanel.
 * Matches DREM's leaderboardConfigPanel.tsx exactly: fields for name/footer/fleet commit
 * on blur (here via EditLeaderboard, since these are real, already-created Leaderboard
 * records — DREM's equivalent is purely local in-memory state), plus a bottom-right
 * Delete button.
 */
const PersistedTrackTabPanel = ({ track, onDelete, deleteDisabled, isDeleting }: PersistedTrackTabPanelProps) => {
  const { t } = useTranslation('events');
  const dispatch = useAppDispatch();
  const [editLeaderboard, { isLoading: isSaving }] = useEditLeaderboardMutation();

  const { control, getValues, handleSubmit } = useForm<AddTrackFormValues>({
    defaultValues: toFormValues(track),
    resolver: yupResolver(addTrackValidationSchema) as unknown as Resolver<AddTrackFormValues>,
    mode: 'onBlur',
  });

  // Commits the full form on blur of any field (matches DREM's per-Input onBlur commit,
  // just batched across all three fields rather than one API call per field). Compare
  // current values with the persisted track instead of formState.isDirty: blur can run
  // before React Hook Form publishes its dirty-state update after a field change.
  const handleFieldBlur = async () => {
    const values = getValues();
    if (
      values.leaderBoardTitle === track.name &&
      values.leaderBoardFooter === (track.leaderBoardFooter ?? '') &&
      values.fleetId === (track.fleetId ?? '')
    ) {
      return;
    }

    await handleSubmit(async (validValues) => {
      try {
        await editLeaderboard({
          leaderboardId: track.leaderboardId,
          leaderboardDefinition: buildTrackEditDefinition(track, {
            name: validValues.leaderBoardTitle,
            leaderBoardFooter: validValues.leaderBoardFooter || undefined,
            fleetId: validValues.fleetId || undefined,
          }),
        }).unwrap();
      } catch (err: unknown) {
        console.error('Failed to save track edit', err);
        dispatch(displayErrorNotification({ content: t('detail.tracks.editErrorMessage') }));
      }
    })();
  };

  return (
    <Container header={<Header variant="h2">{t('detail.tracks.addModal.header')}</Header>}>
      <SpaceBetween size="xl">
        <AddTrackFields control={control} onFieldBlur={handleFieldBlur} />
        <Box float="right">
          <Button onClick={onDelete} disabled={deleteDisabled || isSaving} loading={isDeleting}>
            {t('detail.tracks.removeTrackButton')}
          </Button>
        </Box>
      </SpaceBetween>
    </Container>
  );
};

export default PersistedTrackTabPanel;
