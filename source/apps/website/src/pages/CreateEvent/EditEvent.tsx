// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ContentLayout from '@cloudscape-design/components/content-layout';
import Header from '@cloudscape-design/components/header';
import { EditEventCommandInput, EventStatus, TrackId } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useRef, useState } from 'react';
import { type Resolver, type SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { CreateEventTracks } from '#pages/EventDetail/components/EventTracks';
import { buildTrackEditDefinition } from '#pages/EventDetail/components/EventTracks/components/buildTrackEditDefinition.js';
import { AddTrackFormValues } from '#pages/EventDetail/components/EventTracks/components/validation.js';
import {
  useAddTrackToEventMutation,
  useEditEventMutation,
  useGetEventQuery,
  useListEventTracksQuery,
  useRemoveTrackFromEventMutation,
} from '#services/deepRacer/eventsApi';
import { useEditLeaderboardMutation } from '#services/deepRacer/leaderboardsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

import { buildEventDefinition } from './components/EventForm/buildEventDefinition';
import EventDetailsSection from './components/EventForm/EventDetailsSection';
import EventFormShell from './components/EventForm/EventFormShell';
import RaceConfigurationSection from './components/EventForm/RaceConfigurationSection';
import { CREATE_EVENT_DEFAULTS, createEventValidationSchema, CreateEventFormValues } from './validation';

/** Maps a persisted leaderboard (event track) to the local editable track draft shape. */
const toTrackDraft = (track: {
  leaderboardId: string;
  trackType?: TrackId;
  name: string;
  leaderBoardFooter?: string;
  fleetId?: string;
}): AddTrackFormValues => ({
  leaderboardId: track.leaderboardId,
  trackType: track.trackType,
  leaderBoardTitle: track.name,
  leaderBoardFooter: track.leaderBoardFooter ?? '',
  fleetId: track.fleetId ?? '',
});

/**
 * Edit-event form. Loads the existing event and its tracks, hydrates a local editable
 * draft, and on Save applies event changes plus a staged track diff (remove / edit /
 * add) using the existing per-resource mutations. Track add/edit/delete stay local until
 * Save. Field lock rules follow the event lifecycle:
 * - DRAFT: everything editable, tracks add/edit/delete
 * - OPEN: only sponsor editable, no track changes
 * - IN_PROGRESS+: fully locked
 */
const EditEvent = () => {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { eventId } = useParams<{ eventId: string }>();

  const { data: existingEvent, isLoading: isEventLoading } = useGetEventQuery(
    { eventId: eventId ?? '' },
    { skip: !eventId },
  );
  const {
    data: persistedTracks,
    isLoading: isTrackLoading,
    isSuccess: hasLoadedTracks,
  } = useListEventTracksQuery({ eventId: eventId ?? '' }, { skip: !eventId });

  const [editEvent, { isLoading: isEditing }] = useEditEventMutation();
  const [addTrackToEvent] = useAddTrackToEventMutation();
  const [removeTrackFromEvent] = useRemoveTrackFromEventMutation();
  const [editLeaderboard] = useEditLeaderboardMutation();
  const [isSavingTracks, setIsSavingTracks] = useState(false);
  const isSubmitting = isEditing || isSavingTracks;

  const [initialEditTracks, setInitialEditTracks] = useState<AddTrackFormValues[]>([]);
  const [editTracks, setEditTracks] = useState<AddTrackFormValues[]>([]);
  const [hasInitializedEditTracks, setHasInitializedEditTracks] = useState(false);

  // Hydrate the local track draft once the track list query has actually fulfilled.
  // Gating on isSuccess (not merely !isLoading) avoids snapshotting the skipped/empty
  // result before the query resolves, which would seed defaults over — and on Save
  // delete — the real persisted tracks.
  useEffect(() => {
    if (!hasLoadedTracks || hasInitializedEditTracks) return;

    const tracks = persistedTracks.map(toTrackDraft);
    setInitialEditTracks(tracks);
    setEditTracks(tracks);
    setHasInitializedEditTracks(true);
  }, [hasInitializedEditTracks, hasLoadedTracks, persistedTracks]);

  const editDefaultValues: CreateEventFormValues | undefined = existingEvent
    ? {
        name: existingEvent.name,
        eventType: existingEvent.eventType,
        eventDate: existingEvent.eventDate,
        countryCode: existingEvent.countryCode,
        sponsor: existingEvent.sponsor ?? '',
        raceFormat: existingEvent.raceFormat,
        combinedScoringStrategy: existingEvent.combinedScoringStrategy ?? '',
        combinedLeaderBoardHeader: existingEvent.combinedLeaderBoardHeader ?? '',
        combinedLeaderBoardFooter: existingEvent.combinedLeaderBoardFooter ?? '',
        maxLaps: existingEvent.maxLaps,
        maxTimeInMinutes: String(existingEvent.maxTimeInMinutes),
        maxRunsPerRacer: existingEvent.maxRunsPerRacer === undefined ? '' : String(existingEvent.maxRunsPerRacer),
        maxResets: String(existingEvent.maxResets),
        averageLapsWindow:
          existingEvent.averageLapsWindow === undefined ? '3' : String(existingEvent.averageLapsWindow),
        // Not persisted on the Event — EventTracks derives its own effective layout from
        // the event's existing tracks instead.
        trackType: '',
      }
    : undefined;

  // Fields locked once the event advances past DRAFT.
  // OPEN: only sponsor is editable. IN_PROGRESS+: all fields locked.
  const isDraft = !existingEvent || existingEvent.eventStatus === EventStatus.DRAFT;
  const isOpen = existingEvent?.eventStatus === EventStatus.OPEN;
  const isConfigLocked = !isDraft; // true for OPEN and beyond
  const isAllLocked = !isDraft && !isOpen; // true for IN_PROGRESS and beyond

  // Use a ref so the resolver always closes over the latest track count without
  // needing to re-create the useForm instance when editTracks changes.
  const editTrackCountRef = useRef(0);
  editTrackCountRef.current = editTracks.length;

  const resolver: Resolver<CreateEventFormValues> = (values, ctx, opts) =>
    (
      yupResolver(
        createEventValidationSchema(true, editTrackCountRef.current),
      ) as unknown as Resolver<CreateEventFormValues>
    )(values, ctx, opts);

  const { control, handleSubmit, setValue } = useForm<CreateEventFormValues>({
    values: editDefaultValues ?? CREATE_EVENT_DEFAULTS,
    resolver,
    mode: 'onBlur',
  });

  const countryCode = useWatch({ control, name: 'countryCode' });
  const raceFormat = useWatch({ control, name: 'raceFormat' });
  const combinedLeaderBoardHeader = useWatch({ control, name: 'combinedLeaderBoardHeader' });
  const combinedLeaderBoardFooter = useWatch({ control, name: 'combinedLeaderBoardFooter' });

  if (isEventLoading || isTrackLoading) {
    return <div>Loading...</div>;
  }

  if (!existingEvent) {
    return (
      <ContentLayout header={<Header variant="h1">{t('form.editTitle')}</Header>}>
        <p>{t('detail.notFound')}</p>
      </ContentLayout>
    );
  }

  const persistedTracksForSave = persistedTracks ?? [];

  const saveEditedTracks = async () => {
    for (const editedTrack of editTracks) {
      if (!editedTrack.leaderboardId) continue;
      const originalTrack = persistedTracksForSave.find(
        ({ leaderboardId }) => leaderboardId === editedTrack.leaderboardId,
      );
      if (!originalTrack) continue;
      if (
        editedTrack.leaderBoardTitle === originalTrack.name &&
        editedTrack.leaderBoardFooter === (originalTrack.leaderBoardFooter ?? '') &&
        editedTrack.fleetId === (originalTrack.fleetId ?? '')
      ) {
        continue;
      }

      await editLeaderboard({
        leaderboardId: editedTrack.leaderboardId,
        leaderboardDefinition: buildTrackEditDefinition(originalTrack, {
          name: editedTrack.leaderBoardTitle,
          leaderBoardFooter: editedTrack.leaderBoardFooter || undefined,
          fleetId: editedTrack.fleetId || undefined,
        }),
      }).unwrap();
    }
  };

  const onSubmit: SubmitHandler<CreateEventFormValues> = async (data) => {
    if (!eventId) return;
    const eventDefinition = buildEventDefinition(data, {
      existingEvent,
      isConfigLocked,
    }) as EditEventCommandInput['eventDefinition'];

    try {
      setIsSavingTracks(true);
      await editEvent({ eventId, eventDefinition }).unwrap();

      const editedTrackIds = new Set(editTracks.flatMap(({ leaderboardId }) => (leaderboardId ? [leaderboardId] : [])));
      const deletedTracks = initialEditTracks.filter(
        ({ leaderboardId }) => leaderboardId && !editedTrackIds.has(leaderboardId),
      );
      const newTracks = editTracks.filter(({ leaderboardId }) => !leaderboardId);

      for (const { leaderboardId } of deletedTracks) {
        if (leaderboardId) {
          await removeTrackFromEvent({ eventId, leaderboardId }).unwrap();
        }
      }

      await saveEditedTracks();

      // Edit mode's Race configuration section leaves the form's trackType field blank
      // (see editDefaultValues above) since it isn't persisted on the Event itself — mirror
      // EventTracks.tsx's effectiveTrackType fallback here too, so queuing a new track while
      // editing an event that already has tracks reuses the existing tracks' layout instead
      // of being silently skipped.
      const persistedTrackType = persistedTracksForSave.at(-1)?.trackType;

      for (const newTrack of newTracks) {
        const selectedTrackType = newTrack.trackType || data.trackType || persistedTrackType;
        if (!selectedTrackType) continue;
        await addTrackToEvent({
          eventId,
          trackType: selectedTrackType as TrackId,
          leaderBoardTitle: newTrack.leaderBoardTitle,
          leaderBoardFooter: newTrack.leaderBoardFooter || undefined,
          fleetId: newTrack.fleetId || undefined,
        }).unwrap();
      }

      dispatch(displaySuccessNotification({ content: t('form.editSuccessNotification'), persistForPageChanges: 1 }));
      navigate(getPath(PageId.EVENT_DETAIL, { eventId }));
    } catch {
      dispatch(displayErrorNotification({ content: t('form.editErrorNotification') }));
    } finally {
      setIsSavingTracks(false);
    }
  };

  return (
    <EventFormShell
      title={t('form.editTitle')}
      isSubmitting={isSubmitting}
      onCancel={() => navigate(getPath(PageId.EVENT_DETAIL, { eventId: eventId ?? '' }))}
      onSave={handleSubmit(onSubmit)}
    >
      <EventDetailsSection
        control={control}
        countryCode={countryCode}
        isConfigLocked={isConfigLocked}
        isAllLocked={isAllLocked}
      />
      <RaceConfigurationSection
        control={control}
        raceFormat={raceFormat}
        isConfigLocked={isConfigLocked}
        trackCount={editTracks.length}
      />
      <CreateEventTracks
        queuedTracks={editTracks}
        onChange={setEditTracks}
        disabled={!isDraft || !hasLoadedTracks || isSubmitting}
        seedInitialTrack={false}
        combinedLeaderBoardHeader={combinedLeaderBoardHeader}
        combinedLeaderBoardFooter={combinedLeaderBoardFooter}
        onCombinedLeaderBoardHeaderChange={
          isAllLocked ? undefined : (value) => setValue('combinedLeaderBoardHeader', value)
        }
        onCombinedLeaderBoardFooterChange={
          isAllLocked ? undefined : (value) => setValue('combinedLeaderBoardFooter', value)
        }
      />
    </EventFormShell>
  );
};

export default EditEvent;
