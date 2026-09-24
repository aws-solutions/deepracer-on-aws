// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { EventStatus } from '@deepracer-indy/typescript-client';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useListEventsQuery, useListEventTracksQuery } from '#services/deepRacer/eventsApi.js';

export interface SelectEventAndTrackModalProps {
  isVisible: boolean;
  initialEventId?: string;
  initialLeaderboardId?: string;
  onDismiss: () => void;
  /** Called with the selected event and track IDs and names once confirmed. */
  onConfirm: (eventId: string, leaderboardId: string, eventName: string, trackName: string) => void;
}

export const SelectEventAndTrackModal = ({
  isVisible,
  initialEventId,
  initialLeaderboardId,
  onDismiss,
  onConfirm,
}: SelectEventAndTrackModalProps) => {
  const { t } = useTranslation('timekeeping');
  const [selectedEvent, setSelectedEvent] = useState<SelectProps.Option | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<SelectProps.Option | null>(null);

  const { data: events = [], isLoading: isLoadingEvents } = useListEventsQuery(
    { status: EventStatus.IN_PROGRESS },
    { skip: !isVisible },
  );
  const { data: tracks = [], isLoading: isLoadingTracks } = useListEventTracksQuery(
    { eventId: selectedEvent?.value ?? '' },
    { skip: !isVisible || !selectedEvent?.value },
  );

  const eventOptions: SelectProps.Options = useMemo(
    () => events.map((event) => ({ label: event.name, value: event.eventId })),
    [events],
  );
  const trackOptions: SelectProps.Options = useMemo(
    () => tracks.map((track) => ({ label: track.name, value: track.leaderboardId })),
    [tracks],
  );

  // Re-seed the selection from the persisted context whenever the modal opens, so reopening it
  // shows the racer's current event/track rather than always starting blank.
  useEffect(() => {
    if (!isVisible) return;
    setSelectedEvent(eventOptions.find((option) => option.value === initialEventId) ?? null);
  }, [isVisible, initialEventId, eventOptions]);

  useEffect(() => {
    if (!isVisible) return;
    setSelectedTrack(trackOptions.find((option) => option.value === initialLeaderboardId) ?? null);
  }, [isVisible, initialLeaderboardId, trackOptions]);

  const canConfirm = Boolean(selectedEvent?.value && selectedTrack?.value);

  const handleConfirm = () => {
    if (!selectedEvent?.value || !selectedTrack?.value) return;
    onConfirm(
      selectedEvent.value,
      selectedTrack.value,
      selectedEvent.label ?? selectedEvent.value,
      selectedTrack.label ?? selectedTrack.value,
    );
  };

  return (
    <Modal
      data-testid="select-event-and-track-modal"
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('contextSelection.header')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              {t('contextSelection.selectModalCancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm} disabled={!canConfirm}>
              {t('contextSelection.selectModalConfirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <SpaceBetween size="m">
        <FormField label={t('contextSelection.eventLabel')}>
          <Select
            selectedOption={selectedEvent}
            onChange={({ detail }) => {
              setSelectedEvent(detail.selectedOption);
              setSelectedTrack(null);
            }}
            options={eventOptions}
            placeholder={t('contextSelection.eventPlaceholder')}
            loadingText={t('contextSelection.loadingEvents')}
            statusType={isLoadingEvents ? 'loading' : 'finished'}
            filteringType="auto"
            data-testid="select-event-and-track-modal-event-select"
          />
        </FormField>
        <FormField label={t('contextSelection.trackLabel')}>
          <Select
            selectedOption={selectedTrack}
            onChange={({ detail }) => setSelectedTrack(detail.selectedOption)}
            options={trackOptions}
            placeholder={isLoadingTracks ? t('contextSelection.loadingTracks') : t('contextSelection.trackPlaceholder')}
            loadingText={t('contextSelection.loadingTracks')}
            statusType={isLoadingTracks ? 'loading' : 'finished'}
            disabled={!selectedEvent || isLoadingTracks}
            filteringType="auto"
            data-testid="select-event-and-track-modal-track-select"
          />
        </FormField>
      </SpaceBetween>
    </Modal>
  );
};
