// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import Toggle from '@cloudscape-design/components/toggle';
import { EventStatus } from '@deepracer-indy/typescript-client';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useTimekeepingContext } from '#hooks/useTimekeepingContext.js';
import { useListEventsQuery, useListEventTracksQuery } from '#services/deepRacer/eventsApi.js';

export const EventAndTrackInfo = () => {
  const { t } = useTranslation('timekeeping');
  const { t: tEvents } = useTranslation('events');
  const { fetchCarLogsOnRunFinish, selectedEventId, selectedLeaderboardId, setFetchCarLogsOnRunFinish } =
    useTimekeepingContext();
  const { data: events = [] } = useListEventsQuery({ status: EventStatus.IN_PROGRESS });
  const { data: tracks = [] } = useListEventTracksQuery({ eventId: selectedEventId ?? '' }, { skip: !selectedEventId });

  const selectedEvent = useMemo(
    () => events.find((event) => event.eventId === selectedEventId),
    [events, selectedEventId],
  );
  const selectedTrack = useMemo(
    () => tracks.find((track) => track.leaderboardId === selectedLeaderboardId),
    [selectedLeaderboardId, tracks],
  );
  const raceFormatText = selectedEvent && selectedTrack ? tEvents(`raceFormat.${selectedEvent.raceFormat}`) : '';

  return (
    <Container data-id="EventAndTrackInfo" data-testid="event-and-track-info">
      <ColumnLayout columns={3} minColumnWidth={180} variant="text-grid">
        <Box data-testid="race-format-info" display="inline-block">
          <Box display="inline" variant="awsui-key-label">
            {t('contextSelection.raceFormatLabel')}
          </Box>{' '}
          {raceFormatText}
        </Box>
        <Box data-testid="automatic-timer-info" display="inline-block">
          <Box display="inline" variant="awsui-key-label">
            {t('contextSelection.automaticTimerLabel')}
          </Box>{' '}
          {t('contextSelection.timerNotConnected')}
        </Box>
        <Toggle
          checked={fetchCarLogsOnRunFinish}
          description={t('contextSelection.fetchCarLogsDescription')}
          onChange={({ detail }) => setFetchCarLogsOnRunFinish(detail.checked)}
        >
          {t('contextSelection.fetchCarLogsLabel')}
        </Toggle>
      </ColumnLayout>
    </Container>
  );
};
