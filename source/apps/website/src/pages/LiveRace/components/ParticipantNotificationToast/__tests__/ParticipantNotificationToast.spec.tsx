// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import { useAppDispatch } from '#hooks/useAppDispatch';
import { displayInfoNotification } from '#store/notifications/notificationsSlice';
import { render } from '#utils/testUtils';

import type { EvaluationStartedEvent, ParticipantNotificationEvent } from '../../../types/events';
import ParticipantNotificationToast from '../ParticipantNotificationToast';

vi.mock('#hooks/useAppDispatch');
vi.mock('#store/notifications/notificationsSlice');

const mockDispatch = vi.fn();

const makeNotificationEvent = (
  overrides: Partial<ParticipantNotificationEvent> = {},
): ParticipantNotificationEvent => ({
  eventType: 'PARTICIPANT_NOTIFICATION',
  leaderboardId: 'lb-123',
  timestamp: new Date().toISOString(),
  profileId: 'user-alice',
  notificationType: 'EVALUATION_STARTED',
  participantName: 'Alice',
  modelName: 'SpeedDemon-v3',
  message: 'Your model is now being evaluated!',
  ...overrides,
});

describe('<ParticipantNotificationToast />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAppDispatch as unknown as Mock).mockReturnValue(mockDispatch);
  });

  it('dispatches notification for matching profileId', () => {
    const event = makeNotificationEvent();

    render(<ParticipantNotificationToast lastEvent={event} currentProfileId="user-alice" />);

    expect(mockDispatch).toHaveBeenCalledWith(displayInfoNotification({ content: event.message }));
  });

  it('does not dispatch for non-matching profileId', () => {
    const event = makeNotificationEvent({ profileId: 'user-bob' });

    render(<ParticipantNotificationToast lastEvent={event} currentProfileId="user-alice" />);

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch for non-PARTICIPANT_NOTIFICATION events', () => {
    const event: EvaluationStartedEvent = {
      eventType: 'EVALUATION_STARTED',
      leaderboardId: 'lb-123',
      timestamp: new Date().toISOString(),
      participantName: 'Alice',
      modelName: 'SpeedDemon-v3',
      submissionId: 'sub-1',
      queuePosition: 1,
      totalModels: 5,
      completedModels: 0,
    };

    render(<ParticipantNotificationToast lastEvent={event} currentProfileId="user-alice" />);

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('renders null (no visible output)', () => {
    const { container } = render(<ParticipantNotificationToast lastEvent={null} currentProfileId="user-alice" />);

    expect(container.innerHTML).toBe('');
  });
});
