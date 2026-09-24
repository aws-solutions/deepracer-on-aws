// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CreateEventCommandInput, TrackId } from '@deepracer-indy/typescript-client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRef, useState } from 'react';
import { type Resolver, type SubmitHandler, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages';
import { useAppDispatch } from '#hooks/useAppDispatch';
import { CreateEventTracks } from '#pages/EventDetail/components/EventTracks';
import { AddTrackFormValues } from '#pages/EventDetail/components/EventTracks/components/validation.js';
import { useAddTrackToEventMutation, useCreateEventMutation } from '#services/deepRacer/eventsApi';
import { displayErrorNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';
import { getPath } from '#utils/pageUtils.js';

import { buildEventDefinition } from './components/EventForm/buildEventDefinition';
import EventDetailsSection from './components/EventForm/EventDetailsSection';
import EventFormShell from './components/EventForm/EventFormShell';
import RaceConfigurationSection from './components/EventForm/RaceConfigurationSection';
import { CREATE_EVENT_DEFAULTS, createEventValidationSchema, CreateEventFormValues } from './validation';

/**
 * Create-event form. Collects the event configuration plus a locally queued set of tracks
 * (there is no eventId until the event is created), then on Create creates the event and
 * adds each queued track via sequential AddTrackToEvent calls. Edit is a separate page
 * (EditEvent) that reuses the shared EventForm sections.
 *
 * Admin authorization is enforced at the route level by <RequiresAdmin> (see index.tsx),
 * so this page does not gate on group membership itself.
 */
const CreateEvent = () => {
  const { t } = useTranslation('events');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [createEvent, { isLoading: isCreating }] = useCreateEventMutation();
  const [addTrackToEvent] = useAddTrackToEventMutation();

  // Tracks queued during creation accumulate locally and are submitted via sequential
  // AddTrackToEvent calls once CreateEvent itself succeeds (our backend has separate
  // Create/AddTrack operations, unlike DREM's single eventConfig.tracks submission).
  const [queuedTracks, setQueuedTracks] = useState<AddTrackFormValues[]>([]);

  // useCreateEventMutation's isLoading only covers the CreateEvent call itself, so the
  // submit button must also stay disabled/loading while the subsequent AddTrackToEvent
  // calls are still in flight — otherwise it re-enables before the event is fully set up.
  const [isAddingTracks, setIsAddingTracks] = useState(false);

  // Use a ref so the resolver always closes over the latest track count without
  // needing to re-create the useForm instance when queuedTracks changes.
  const queuedTrackCountRef = useRef(0);
  queuedTrackCountRef.current = queuedTracks.length;

  const resolver: Resolver<CreateEventFormValues> = (values, ctx, opts) =>
    (
      yupResolver(
        createEventValidationSchema(false, queuedTrackCountRef.current),
      ) as unknown as Resolver<CreateEventFormValues>
    )(values, ctx, opts);

  const { control, handleSubmit, setValue } = useForm<CreateEventFormValues>({
    values: CREATE_EVENT_DEFAULTS,
    resolver,
    mode: 'onBlur',
  });

  const countryCode = useWatch({ control, name: 'countryCode' });
  const raceFormat = useWatch({ control, name: 'raceFormat' });
  const trackType = useWatch({ control, name: 'trackType' });
  const combinedLeaderBoardHeader = useWatch({ control, name: 'combinedLeaderBoardHeader' });
  const combinedLeaderBoardFooter = useWatch({ control, name: 'combinedLeaderBoardFooter' });

  const onSubmit: SubmitHandler<CreateEventFormValues> = async (data) => {
    const eventDefinition = buildEventDefinition(data) as CreateEventCommandInput['eventDefinition'];

    try {
      const newEventId = await createEvent({ eventDefinition }).unwrap();

      // The event was already created successfully, so a failed track doesn't block
      // navigation; failures are surfaced separately so the operator can add the missing
      // track(s) afterward.
      let failedTrackCount = 0;
      setIsAddingTracks(true);
      try {
        for (const track of queuedTracks) {
          try {
            await addTrackToEvent({
              eventId: newEventId,
              trackType: data.trackType as TrackId,
              leaderBoardTitle: track.leaderBoardTitle,
              leaderBoardFooter: track.leaderBoardFooter || undefined,
              fleetId: track.fleetId || undefined,
            }).unwrap();
          } catch (err: unknown) {
            console.error('Failed to add track to newly created event', err);
            failedTrackCount += 1;
          }
        }
      } finally {
        setIsAddingTracks(false);
      }

      dispatch(displaySuccessNotification({ content: t('form.createSuccessNotification'), persistForPageChanges: 1 }));
      if (failedTrackCount > 0) {
        dispatch(
          displayErrorNotification({
            content: t('form.createTracksPartialErrorNotification', { count: failedTrackCount }),
            persistForPageChanges: 1,
          }),
        );
      }
      navigate(getPath(PageId.EVENT_DETAIL, { eventId: newEventId }));
    } catch {
      dispatch(displayErrorNotification({ content: t('form.createErrorNotification') }));
    }
  };

  return (
    <EventFormShell
      title={t('form.createTitle')}
      isSubmitting={isCreating || isAddingTracks}
      onCancel={() => navigate(getPath(PageId.EVENTS))}
      onSave={handleSubmit(onSubmit)}
      submitLabel={t('form.createButton')}
    >
      <EventDetailsSection control={control} countryCode={countryCode} isConfigLocked={false} isAllLocked={false} />
      <RaceConfigurationSection
        control={control}
        raceFormat={raceFormat}
        isConfigLocked={false}
        trackCount={queuedTracks.length}
      />
      {/* Disabled until a track layout is chosen — there is nowhere else to pick one
          before the first track is added (mirrors "render it but disabled"). */}
      <CreateEventTracks
        queuedTracks={queuedTracks}
        onChange={setQueuedTracks}
        disabled={!trackType}
        combinedLeaderBoardHeader={combinedLeaderBoardHeader}
        combinedLeaderBoardFooter={combinedLeaderBoardFooter}
        onCombinedLeaderBoardHeaderChange={(value) => setValue('combinedLeaderBoardHeader', value)}
        onCombinedLeaderBoardFooterChange={(value) => setValue('combinedLeaderBoardFooter', value)}
      />
    </EventFormShell>
  );
};

export default CreateEvent;
