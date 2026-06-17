// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '#hooks/useAppDispatch.js';
import { displayInfoNotification, displaySuccessNotification } from '#store/notifications/notificationsSlice.js';

import type { LiveRaceEvent, ParticipantNotificationEvent } from '../../types/events.js';

interface ParticipantNotificationToastProps {
  lastEvent: LiveRaceEvent | null;
  currentProfileId: string;
}

const isParticipantNotification = (event: LiveRaceEvent): event is ParticipantNotificationEvent =>
  event.eventType === 'PARTICIPANT_NOTIFICATION';

/**
 * Listens for PARTICIPANT_NOTIFICATION events and displays toast notifications
 * for the current user only. Filters client-side by profileId.
 */
const ParticipantNotificationToast = ({ lastEvent, currentProfileId }: ParticipantNotificationToastProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('liveRace');
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!lastEvent || !isParticipantNotification(lastEvent)) return;
    if (lastEvent.profileId !== currentProfileId) return;

    // Deduplicate by timestamp + notificationType
    const eventKey = `${lastEvent.timestamp}-${lastEvent.notificationType}`;
    if (processedRef.current.has(eventKey)) return;
    processedRef.current.add(eventKey);

    const message = lastEvent.message || t(`participantNotification.${lastEvent.notificationType}`);

    if (lastEvent.notificationType === 'TOP_3' || lastEvent.notificationType === 'FASTEST_TIME') {
      dispatch(displaySuccessNotification({ content: message }));
    } else {
      dispatch(displayInfoNotification({ content: message }));
    }
  }, [lastEvent, currentProfileId, dispatch, t]);

  return null;
};

export default ParticipantNotificationToast;
