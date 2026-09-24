// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Leaderboard, RaceType, TimingMethod, TrackDirection, TrackId } from '@deepracer-indy/typescript-client';
import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import RemoveTrackModal from './RemoveTrackModal';

const mockTrack: Leaderboard = {
  leaderboardId: 'lb-001',
  name: 'Summit Speedway - Qualifying',
  openTime: new Date('2026-01-01'),
  closeTime: new Date('2026-01-02'),
  trackConfig: { trackId: TrackId.AWS_SUMMIT_RACEWAY, trackDirection: TrackDirection.CLOCKWISE },
  raceType: RaceType.TIME_TRIAL,
  maxSubmissionsPerUser: 0,
  timingMethod: TimingMethod.BEST_LAP_TIME,
  resettingBehaviorConfig: { continuousLap: true },
  submissionTerminationConditions: { minimumLaps: 1, maximumLaps: 5 },
  participantCount: 0,
};

describe('<RemoveTrackModal />', () => {
  it('renders the track name in the confirmation message', () => {
    render(<RemoveTrackModal track={mockTrack} isRemoving={false} onRemove={vi.fn()} onDismiss={vi.fn()} />);

    expect(
      screen.getByText(i18n.t('events:detail.tracks.removeConfirmMessage', { name: mockTrack.name })),
    ).toBeInTheDocument();
  });

  it('calls onRemove when the confirm button is clicked', () => {
    const onRemove = vi.fn();

    render(<RemoveTrackModal track={mockTrack} isRemoving={false} onRemove={onRemove} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') }));

    expect(onRemove).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when the cancel button is clicked', () => {
    const onDismiss = vi.fn();

    render(<RemoveTrackModal track={mockTrack} isRemoving={false} onRemove={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('disables buttons and shows loading state while removing', () => {
    render(<RemoveTrackModal track={mockTrack} isRemoving={true} onRemove={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByRole('button', { name: i18n.t('events:detail.tracks.removeTrackButton') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') })).toBeDisabled();
  });
});
