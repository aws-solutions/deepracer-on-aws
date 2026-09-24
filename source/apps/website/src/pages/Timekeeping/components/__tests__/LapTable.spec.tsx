// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Lap } from '@deepracer-indy/typescript-client';
import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import { LapTable } from '../LapTable';

const makeLap = (overrides: Partial<Lap> = {}): Lap => ({
  runId: 'run-001',
  leaderboardId: 'lb-001',
  lapNumber: 1,
  lapTimeMs: 12450,
  isValid: true,
  resets: 0,
  createdAt: new Date('2026-01-01T10:00:00Z'),
  updatedAt: new Date('2026-01-01T10:00:00Z'),
  ...overrides,
});

const baseProps = {
  dataTestId: 'recorded-laps-table',
  emptySubtitle: i18n.t('timekeeping:lapTable.emptySubtitle'),
  emptyTitle: i18n.t('timekeeping:lapTable.emptyTitle'),
  header: i18n.t('timekeeping:lapTable.header'),
  isLoading: false,
  laps: [] as Lap[],
};

describe('<LapTable />', () => {
  it('renders the empty state when there are no laps', () => {
    render(<LapTable {...baseProps} />);

    expect(screen.getByText(i18n.t('timekeeping:lapTable.emptyTitle'))).toBeInTheDocument();
  });

  it('renders a valid lap without strikethrough and no toggle column by default', () => {
    render(<LapTable {...baseProps} laps={[makeLap()]} />);

    expect(screen.getByText(i18n.t('timekeeping:lapTable.valid'))).toBeInTheDocument();
    expect(screen.queryByTestId('lap-time-invalid-1')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: i18n.t('timekeeping:lapTable.markInvalid', { lapNumber: 1 }),
      }),
    ).not.toBeInTheDocument();
  });

  it('strikes through the time of an invalid lap', () => {
    render(<LapTable {...baseProps} laps={[makeLap({ isValid: false })]} />);

    expect(screen.getByText(i18n.t('timekeeping:lapTable.invalid'))).toBeInTheDocument();
    expect(screen.getByTestId('lap-time-invalid-1')).toBeInTheDocument();
  });

  it('renders a "Mark invalid" toggle for a valid lap when onToggleValidity is provided', () => {
    const onToggleValidity = vi.fn();
    render(<LapTable {...baseProps} laps={[makeLap()]} onToggleValidity={onToggleValidity} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:lapTable.markInvalid', { lapNumber: 1 }) }));

    expect(onToggleValidity).toHaveBeenCalledWith(expect.objectContaining({ lapNumber: 1 }), false);
  });

  it('renders a "Mark valid" toggle for an invalid lap and requests the opposite validity', () => {
    const onToggleValidity = vi.fn();
    render(<LapTable {...baseProps} laps={[makeLap({ isValid: false })]} onToggleValidity={onToggleValidity} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:lapTable.markValid', { lapNumber: 1 }) }));

    expect(onToggleValidity).toHaveBeenCalledWith(expect.objectContaining({ lapNumber: 1 }), true);
  });

  it('shows an loading StatusIndicator for the lap being updated', () => {
    render(<LapTable {...baseProps} laps={[makeLap()]} onToggleValidity={vi.fn()} togglingLapNumber={1} />);

    const toggleButton = screen.getByRole('button', {
      name: i18n.t('timekeeping:lapTable.markInvalid', { lapNumber: 1 }),
    });
    expect(toggleButton).toBeDisabled();
    expect(toggleButton).toHaveTextContent(i18n.t('timekeeping:lapTable.valid'));
    expect(screen.getByTestId('lap-validity-status-1')).toHaveAttribute('data-status-type', 'loading');
  });
});
