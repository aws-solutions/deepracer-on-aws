// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Container from '@cloudscape-design/components/container';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Spinner from '@cloudscape-design/components/spinner';
import StatusIndicator from '@cloudscape-design/components/status-indicator';
import Tabs from '@cloudscape-design/components/tabs';
import { EventStatus, EventTransitionAction, UserGroups } from '@deepracer-indy/typescript-client';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { MAX_RESETS_UNLIMITED_SENTINEL } from '#pages/CreateEvent/validation.js';
import {
  useGetEventQuery,
  useListEventTracksQuery,
  useTransitionEventStatusMutation,
} from '#services/deepRacer/eventsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { checkUserGroupMembership } from '#utils/authUtils.js';
import { countryCodeToFlagEmoji } from '#utils/flagUtil.js';
import { getPath } from '#utils/pageUtils.js';
import { getTrackById } from '#utils/trackUtils.js';

import EventStatistics from './components/EventStatistics';
import CombinedLeaderboardPanel from './components/EventTracks/components/CombinedLeaderboardPanel';
import Leaderboards from './components/Leaderboards';
import RunLapsPanel from './components/RunLapsPanel';
import { EVENT_STATUS_COLOR_OVERRIDE_MAP, EVENT_STATUS_TYPE_MAP } from '../Events/eventStatusUtils.js';

/**
 * Maps each current EventStatus to the next valid transition action, if any.
 * COMPLETED → ARCHIVED uses the ARCHIVE action.
 */
const NEXT_TRANSITION_MAP: Partial<Record<EventStatus, EventTransitionAction>> = {
  [EventStatus.DRAFT]: EventTransitionAction.OPEN,
  [EventStatus.OPEN]: EventTransitionAction.START,
  [EventStatus.IN_PROGRESS]: EventTransitionAction.COMPLETE,
  [EventStatus.COMPLETED]: EventTransitionAction.ARCHIVE,
};

const EventDetail = () => {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const { eventId } = useParams<{ eventId: string }>();

  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminOrFacilitator, setIsAdminOrFacilitator] = useState(false);
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);
  const [activeTabId, setActiveTabId] = useState('tracks');

  const { data: event, isLoading } = useGetEventQuery({ eventId: eventId ?? '' }, { skip: !eventId });
  const { data: tracks = [], isLoading: isTracksLoading } = useListEventTracksQuery(
    { eventId: eventId ?? '' },
    { skip: !eventId },
  );
  const [transitionEventStatus, { isLoading: isTransitioning }] = useTransitionEventStatusMutation();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const loadPermissions = async () => {
      const [admin, adminOrFacilitator] = await Promise.all([
        checkUserGroupMembership([UserGroups.ADMIN]),
        checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.RACERS]),
      ]);
      setIsAdmin(admin);
      setIsAdminOrFacilitator(adminOrFacilitator);
    };

    loadPermissions()
      .catch((err: unknown) => {
        console.error('Failed to load permissions', err);
      })
      .finally(() => setIsPermissionLoading(false));
  }, []);

  const nextAction = event ? NEXT_TRANSITION_MAP[event.eventStatus] : undefined;

  // Combined leaderboard only exists once an event has a scoring strategy (multi-track
  // events) and at least 2 tracks; matches EventTracks.tsx's showCombinedTab convention.
  // Rendered after Leaderboards on the Tracks tab, so it always appears below all tracks.
  const showCombinedLeaderboard = Boolean(event?.combinedScoringStrategy) && tracks.length >= 2;

  const handleTransition = useCallback(async () => {
    if (!nextAction || !eventId) return;
    try {
      await transitionEventStatus({ eventId, action: nextAction }).unwrap();
      dispatch(displaySuccessNotification({ content: t('detail.lifecycle.transitionSuccess') }));
    } catch (err: unknown) {
      console.error('Failed to transition event status', err);
      dispatch(displayErrorNotification({ content: t('detail.lifecycle.transitionError') }));
    }
  }, [nextAction, eventId, transitionEventStatus, dispatch, t]);

  if (!isAdminOrFacilitator && !isPermissionLoading) {
    return (
      <ContentLayout header={<Header variant="h1">{t('unauthorized.header')}</Header>}>
        <p>{t('unauthorized.message')}</p>
      </ContentLayout>
    );
  }

  if (isLoading || isTracksLoading || isPermissionLoading) {
    return (
      <ContentLayout header={<Header variant="h1">{t('detail.header')}</Header>}>
        <Spinner />
      </ContentLayout>
    );
  }

  if (!event) {
    return (
      <ContentLayout header={<Header variant="h1">{t('detail.header')}</Header>}>
        <Box>{t('detail.notFound')}</Box>
      </ContentLayout>
    );
  }

  const headerActions = (
    <SpaceBetween direction="horizontal" size="xs">
      {isAdmin && (
        <Button onClick={() => navigate(getPath(PageId.EDIT_EVENT, { eventId: eventId ?? '' }))}>
          {t('list.editEventButton')}
        </Button>
      )}
      {isAdmin && nextAction && (
        <Button variant="primary" onClick={() => handleTransition()} loading={isTransitioning}>
          {t(`detail.lifecycle.transitionButton.${nextAction}`)}
        </Button>
      )}
    </SpaceBetween>
  );

  const attributeField = (header: string, value: React.ReactNode): JSX.Element => {
    return (
      <SpaceBetween size="xxxs">
        <Box fontWeight="bold">{header}</Box>
        <div>{value ?? '-'}</div>
      </SpaceBetween>
    );
  };

  return (
    <ContentLayout
      header={
        <Header
          variant="h1"
          actions={headerActions}
          description={
            <StatusIndicator
              type={EVENT_STATUS_TYPE_MAP[event.eventStatus]}
              colorOverride={EVENT_STATUS_COLOR_OVERRIDE_MAP[event.eventStatus]}
            >
              {t(`status.${event.eventStatus}`)}
            </StatusIndicator>
          }
        >
          {event.name}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container>
          <ColumnLayout columns={4} variant="text-grid">
            {attributeField(t('list.columnHeaders.eventType'), t(`eventType.${event.eventType}`))}
            {attributeField(t('list.columnHeaders.createdBy'), event.createdBy)}
            {attributeField(t('list.columnHeaders.eventDate'), event.eventDate)}
            {attributeField(
              t('list.columnHeaders.countryCode'),
              <SpaceBetween size="xxxs" direction="horizontal">
                {event.countryCode}
                {countryCodeToFlagEmoji(event.countryCode)}
              </SpaceBetween>,
            )}
            {attributeField(t('list.columnHeaders.raceFormat'), t(`raceFormat.${event.raceFormat}`))}
            {attributeField(
              t('form.fields.trackType.label'),
              tracks[0] ? getTrackById(tracks[0].trackConfig.trackId).name : '-',
            )}
            {attributeField(t('form.fields.maxTimeInMinutes.label'), `${event.maxTimeInMinutes} min`)}
            {attributeField(
              t('form.fields.maxResets.label'),
              event.maxResets === Number(MAX_RESETS_UNLIMITED_SENTINEL)
                ? t('form.fields.maxResets.unlimitedOption')
                : String(event.maxResets),
            )}
            {event.averageLapsWindow &&
              attributeField(t('form.fields.averageLapsWindow.label'), String(event.averageLapsWindow))}
            {attributeField(t('list.columnHeaders.sponsor'), event.sponsor ?? '-')}
            {attributeField(t('form.fields.maxLaps.label'), String(event.maxLaps))}
            {attributeField(
              t('form.fields.maxRunsPerRacer.label'),
              event.maxRunsPerRacer === undefined
                ? t('form.fields.maxRunsPerRacer.unlimitedOption')
                : String(event.maxRunsPerRacer),
            )}
          </ColumnLayout>
        </Container>

        <Container>
          <Tabs
            activeTabId={activeTabId}
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            tabs={[
              {
                id: 'tracks',
                label: t('detail.tabs.tracks'),
                content: (
                  <SpaceBetween size="l">
                    <Leaderboards eventId={eventId ?? ''} tracks={tracks} eventStatus={event.eventStatus} />
                    {showCombinedLeaderboard && (
                      <CombinedLeaderboardPanel eventId={eventId ?? ''} isActive={activeTabId === 'tracks'} />
                    )}
                  </SpaceBetween>
                ),
              },
              {
                id: 'runs',
                label: t('detail.tabs.runs'),
                content: <RunLapsPanel eventId={eventId ?? ''} tracks={tracks} isAdmin={isAdmin} />,
              },
              {
                id: 'statistics',
                label: t('detail.tabs.statistics'),
                content: <EventStatistics eventId={eventId ?? ''} isActive={activeTabId === 'statistics'} />,
              },
            ]}
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default EventDetail;
