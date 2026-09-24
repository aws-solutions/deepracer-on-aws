// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import { TrackTabEmptyState } from './TrackTabContent';

describe('<TrackTabEmptyState />', () => {
  it('renders the empty state title and subtitle', () => {
    render(<TrackTabEmptyState onAddTrack={vi.fn()} canAdd={false} />);

    expect(screen.getByText(i18n.t('events:detail.tracks.emptyTitle'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('events:detail.tracks.emptySubtitle'))).toBeInTheDocument();
  });

  it('hides the add button when canAdd is false', () => {
    render(<TrackTabEmptyState onAddTrack={vi.fn()} canAdd={false} />);

    expect(
      screen.queryByRole('button', { name: i18n.t('events:detail.tracks.addTrackButton') }),
    ).not.toBeInTheDocument();
  });

  it('calls onAddTrack when the add button is clicked', () => {
    const onAddTrack = vi.fn();
    render(<TrackTabEmptyState onAddTrack={onAddTrack} canAdd={true} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.tracks.addTrackButton') }));

    expect(onAddTrack).toHaveBeenCalledOnce();
  });
});
