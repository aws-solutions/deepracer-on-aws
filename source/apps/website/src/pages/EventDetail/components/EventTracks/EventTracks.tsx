// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Container from '@cloudscape-design/components/container';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Tabs, { TabsProps } from '@cloudscape-design/components/tabs';
import { Event, EventStatus, Leaderboard, TrackId } from '@deepracer-indy/typescript-client';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import {
  useAddTrackToEventMutation,
  useListEventTracksQuery,
  useRemoveTrackFromEventMutation,
} from '#services/deepRacer/eventsApi.js';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';

import CombinedLeaderboardPanel from './components/CombinedLeaderboardPanel';
import PersistedTrackTabPanel from './components/PersistedTrackTabPanel';
import RemoveTrackModal from './components/RemoveTrackModal';
import { TrackTabEmptyState } from './components/TrackTabContent';

/** Mirrors MAX_TRACKS_PER_EVENT in libs/lambda/src/api/handlers/addTrackToEvent.ts. */
export const MAX_TRACKS_PER_EVENT = 10;

/** Mirrors TRACK_ADDABLE_STATUSES in libs/lambda/src/api/handlers/addTrackToEvent.ts. */
const TRACK_ADDABLE_STATUSES: ReadonlySet<EventStatus> = new Set([EventStatus.DRAFT, EventStatus.OPEN]);

/** Mirrors the DRAFT-only guard in libs/lambda/src/api/handlers/removeTrackFromEvent.ts. */
const TRACK_REMOVABLE_STATUSES: ReadonlySet<EventStatus> = new Set([EventStatus.DRAFT]);

/** Sentinel tab id for the trailing "add track" tab, styled as an icon button (matches DREM's tracksPanel.tsx pattern). */
const ADD_TAB_ID = 'add';
/** Sentinel tab id for the combined-leaderboard tab, shown as a peer alongside per-track tabs (matches DREM). */
const COMBINED_TAB_ID = 'combined';

export interface EventTracksProps {
  event: Event;
  canManageTracks: boolean;
  isActive: boolean;
  /**
   * Track layout to use when adding the FIRST track to this event (no persisted track
   * exists yet to infer it from). Typically the Race configuration section's trackType
   * field value on the create/edit form. Once at least one track exists, its trackType
   * is used instead — the whole point being a single shared layout across the event,
   * without persisting trackType on the Event itself (Smithy/DynamoDB intentionally
   * keep it per-track on Leaderboard, preserving a future per-track override).
   */
  initialTrackType?: TrackId | '';
}

/**
 * Tracks tab for an already-created event (Event Detail page, and CreateEvent's own
 * Tracks section while editing). Matches DREM's tracksPanel.tsx: each track is an
 * editable tab (PersistedTrackTabPanel — name/footer/fleet commit on blur via
 * EditLeaderboard) with a bottom-right Delete button disabled at ≤1 track or on the
 * Combined tab; a "+" tab adds a new track. Add/remove/edit are all further gated by
 * the event's own lifecycle status (TRACK_ADDABLE_STATUSES/TRACK_REMOVABLE_STATUSES),
 * since — unlike DREM's pre-submission in-memory tracks — these are real, persisted
 * records once IN_PROGRESS.
 */
const EventTracks = ({ event, canManageTracks, isActive, initialTrackType = '' }: EventTracksProps) => {
  const { t } = useTranslation('events');
  const dispatch = useAppDispatch();
  const { eventId, eventStatus, combinedScoringStrategy } = event;

  const [trackToRemove, setTrackToRemove] = useState<Leaderboard | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>('');

  const { data: tracks = [], isLoading } = useListEventTracksQuery({ eventId }, { skip: !eventId || !isActive });
  const [addTrackToEvent, { isLoading: isAdding }] = useAddTrackToEventMutation();
  const [removeTrackFromEvent, { isLoading: isRemoving }] = useRemoveTrackFromEventMutation();

  const isTrackAddableEventStatus = TRACK_ADDABLE_STATUSES.has(eventStatus);
  const isAtMaxTrackCount = tracks.length >= MAX_TRACKS_PER_EVENT;

  // A single shared layout across the event: once a track exists, its layout is reused
  // for subsequent tracks; before any track exists, fall back to the caller-supplied
  // initial value (typically the Race configuration section's trackType field).
  const effectiveTrackType = tracks.at(-1)?.trackType ?? initialTrackType;

  const canAddTracks =
    canManageTracks && isTrackAddableEventStatus && !isAtMaxTrackCount && Boolean(effectiveTrackType);
  const canRemoveTracks = canManageTracks && TRACK_REMOVABLE_STATUSES.has(eventStatus);
  const showCombinedTab = Boolean(combinedScoringStrategy) && tracks.length >= 2;
  const deleteDisabled = !canRemoveTracks || tracks.length <= 1;

  // Shown by the Add-track button while disabled; reflects the first failing guard
  // (event status takes precedence over the per-event track cap).
  let addTrackDisabledReason: string | undefined;
  if (isTrackAddableEventStatus) {
    if (isAtMaxTrackCount) {
      addTrackDisabledReason = t('detail.tracks.table.addDisabledReasonMaxTracks');
    } else if (!effectiveTrackType) {
      addTrackDisabledReason = t('detail.tracks.table.addDisabledReasonNoTrackType');
    }
  } else {
    addTrackDisabledReason = t('detail.tracks.table.addDisabledReasonEventState');
  }

  // Mirrors DREM's addTrackHandler: clone the last track's fleet (fields carry forward,
  // matching the single-shared-configuration convention used elsewhere) with a fresh
  // generated name, and immediately create it — no separate "add track" sub-form.
  const handleAddTrack = useCallback(async () => {
    if (!effectiveTrackType) return;
    const lastTrack = tracks.at(-1);
    try {
      const result = await addTrackToEvent({
        eventId,
        trackType: effectiveTrackType as TrackId,
        leaderBoardTitle: t('detail.tracks.defaultTrackName', { number: tracks.length + 1 }),
        leaderBoardFooter: lastTrack?.leaderBoardFooter,
        fleetId: lastTrack?.fleetId,
      }).unwrap();
      setActiveTabId(result.leaderboardId);
    } catch (err: unknown) {
      console.error('Failed to add track', err);
      dispatch(displayErrorNotification({ content: t('detail.tracks.addErrorMessage') }));
    }
  }, [addTrackToEvent, dispatch, effectiveTrackType, eventId, t, tracks]);

  const handleRemoveTrack = useCallback(async () => {
    if (!trackToRemove) return;
    try {
      await removeTrackFromEvent({ eventId, leaderboardId: trackToRemove.leaderboardId }).unwrap();
      dispatch(
        displaySuccessNotification({ content: t('detail.tracks.removeSuccessMessage', { name: trackToRemove.name }) }),
      );
      setTrackToRemove(null);
    } catch (err: unknown) {
      console.error('Failed to remove track', err);
      dispatch(
        displayErrorNotification({ content: t('detail.tracks.removeErrorMessage', { name: trackToRemove.name }) }),
      );
    }
  }, [dispatch, eventId, removeTrackFromEvent, t, trackToRemove]);

  const tabs: TabsProps.Tab[] = useMemo(() => {
    const trackTabs: TabsProps.Tab[] = tracks.map((track, index) => ({
      id: track.leaderboardId,
      label: t('detail.tracks.defaultTrackName', { number: index + 1 }),
      content: (
        <PersistedTrackTabPanel
          track={track}
          onDelete={() => setTrackToRemove(track)}
          deleteDisabled={deleteDisabled}
          isDeleting={isRemoving && trackToRemove?.leaderboardId === track.leaderboardId}
        />
      ),
    }));

    if (showCombinedTab) {
      trackTabs.push({
        id: COMBINED_TAB_ID,
        label: t('detail.tracks.combinedTabLabel'),
        // Cloudscape Tabs only mounts the active tab's content by default, so this panel
        // (and its data hook) never mounts until the Combined tab is actually selected.
        content: (
          <Container>
            <SpaceBetween size="xl">
              <CombinedLeaderboardPanel eventId={eventId} isActive={isActive} />
              <Box float="right">
                <Button disabled>{t('detail.tracks.removeTrackButton')}</Button>
              </Box>
            </SpaceBetween>
          </Container>
        ),
      });
    }

    if (canManageTracks) {
      trackTabs.push({
        id: ADD_TAB_ID,
        label: (
          <Button
            variant="icon"
            iconName="add-plus"
            ariaLabel={t('detail.tracks.addTrackButton')}
            disabled={!canAddTracks || isAdding}
            disabledReason={addTrackDisabledReason}
            data-testid="btn-add-track"
            onClick={handleAddTrack}
          />
        ),
      });
    }

    return trackTabs;
  }, [
    tracks,
    deleteDisabled,
    isRemoving,
    trackToRemove,
    showCombinedTab,
    eventId,
    isActive,
    canManageTracks,
    canAddTracks,
    isAdding,
    addTrackDisabledReason,
    handleAddTrack,
    t,
  ]);

  const resolvedActiveTabId = useMemo(() => {
    if (tabs.some((tab) => tab.id === activeTabId)) return activeTabId;
    return tabs.find((tab) => tab.id !== ADD_TAB_ID)?.id;
  }, [tabs, activeTabId]);

  if (!isActive) {
    return null;
  }

  if (tracks.length === 0) {
    if (isLoading) return null;
    return <TrackTabEmptyState onAddTrack={handleAddTrack} canAdd={canManageTracks && canAddTracks} />;
  }

  return (
    <>
      <Tabs
        activeTabId={resolvedActiveTabId}
        onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
        tabs={tabs}
      />
      {trackToRemove && (
        <RemoveTrackModal
          track={trackToRemove}
          isRemoving={isRemoving}
          onRemove={handleRemoveTrack}
          onDismiss={() => setTrackToRemove(null)}
        />
      )}
    </>
  );
};

export default EventTracks;
