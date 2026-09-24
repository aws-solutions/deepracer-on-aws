// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { EventStatus, EventType, RaceFormat } from '@deepracer-indy/typescript-client';
import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import DeleteEventModal from './DeleteEventModal';

const mockEvent = {
  eventId: 'evt-001',
  name: 're:Invent 2025 Race',
  eventType: EventType.AWS_SUMMIT,
  eventDate: '2025-12-01',
  countryCode: 'US',
  raceFormat: RaceFormat.BEST_LAP,
  maxLaps: 5,
  maxTimeInMinutes: 3,
  maxResets: 3,
  eventStatus: EventStatus.DRAFT,
  createdBy: 'TestAdmin',
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
};

describe('<DeleteEventModal />', () => {
  it('renders the event name in the confirmation message', () => {
    render(<DeleteEventModal event={mockEvent} isDeleting={false} onDelete={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText(i18n.t('events:list.deleteConfirmMessage', { name: mockEvent.name }))).toBeInTheDocument();
  });

  it('calls onDelete when the confirm button is clicked', () => {
    const onDelete = vi.fn();

    render(<DeleteEventModal event={mockEvent} isDeleting={false} onDelete={onDelete} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') }));

    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when the cancel button is clicked', () => {
    const onDismiss = vi.fn();

    render(<DeleteEventModal event={mockEvent} isDeleting={false} onDelete={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('disables buttons and shows loading state while deleting', () => {
    render(<DeleteEventModal event={mockEvent} isDeleting={true} onDelete={vi.fn()} onDismiss={vi.fn()} />);

    // Primary button uses loading={isDeleting} → Cloudscape renders aria-disabled
    expect(screen.getByRole('button', { name: i18n.t('events:list.deleteEventButton') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    // Link variant button uses disabled={isDeleting} → native disabled attribute
    expect(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') })).toBeDisabled();
  });
});
