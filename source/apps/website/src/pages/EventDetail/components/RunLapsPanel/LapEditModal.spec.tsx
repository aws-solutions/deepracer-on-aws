// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Lap } from '@deepracer-indy/typescript-client';
import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen, waitFor } from '#utils/testUtils';

import LapEditModal from './LapEditModal';

const mockLap: Lap = {
  runId: 'run-001',
  leaderboardId: 'lb-001',
  lapNumber: 2,
  lapTimeMs: 11230,
  isValid: true,
  resets: 1,
  createdAt: new Date('2026-09-15T10:31:45Z'),
  updatedAt: new Date('2026-09-15T10:31:45Z'),
};

const editedLap: Lap = {
  ...mockLap,
  lapTimeMs: 11050,
  originalLapTimeMs: 11230,
  editedBy: 'admin@example.com',
  editedAt: new Date('2026-09-15T11:00:00Z'),
  editReason: 'Timer strip double-triggered',
};

describe('<LapEditModal />', () => {
  it('renders the modal header with the lap number', () => {
    render(<LapEditModal lap={mockLap} isSubmitting={false} onSubmit={vi.fn()} onDismiss={vi.fn()} />);

    expect(
      screen.getByText(i18n.t('events:detail.runs.lapEdit.modalHeader', { lapNumber: mockLap.lapNumber })),
    ).toBeInTheDocument();
  });

  it('pre-fills the lap time field with the current lap time formatted as mm:ss.sss', () => {
    render(<LapEditModal lap={mockLap} isSubmitting={false} onSubmit={vi.fn()} onDismiss={vi.fn()} />);

    expect(
      screen.getByRole('textbox', { name: i18n.t('events:detail.runs.lapEdit.fields.lapTimeMs.label') }),
    ).toHaveValue('00:11.230');
  });

  it('does not render edit history for a lap that has never been edited', () => {
    render(<LapEditModal lap={mockLap} isSubmitting={false} onSubmit={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.queryByText(i18n.t('events:detail.runs.lapEdit.historyTitle'))).not.toBeInTheDocument();
  });

  it('renders edit history for a previously-edited lap', () => {
    render(<LapEditModal lap={editedLap} isSubmitting={false} onSubmit={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByText(i18n.t('events:detail.runs.lapEdit.historyTitle'))).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Timer strip double-triggered')).toBeInTheDocument();
  });

  it('calls onDismiss when the cancel button is clicked', () => {
    const onDismiss = vi.fn();
    render(<LapEditModal lap={mockLap} isSubmitting={false} onSubmit={vi.fn()} onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('shows a validation error and does not submit when editReason is empty', async () => {
    const onSubmit = vi.fn();
    render(<LapEditModal lap={mockLap} isSubmitting={false} onSubmit={onSubmit} onDismiss={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapEdit.saveButton') }));

    await waitFor(() => {
      expect(screen.getByText(i18n.t('events:detail.runs.lapEdit.validation.editReasonRequired'))).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with the new lapTimeMs and editReason when the form is valid', async () => {
    const onSubmit = vi.fn();
    render(<LapEditModal lap={mockLap} isSubmitting={false} onSubmit={onSubmit} onDismiss={vi.fn()} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: i18n.t('events:detail.runs.lapEdit.fields.lapTimeMs.label') }),
      { target: { value: '00:11.050' } },
    );
    fireEvent.change(
      screen.getByRole('textbox', { name: i18n.t('events:detail.runs.lapEdit.fields.editReason.label') }),
      { target: { value: 'Timing strip glitch' } },
    );

    fireEvent.click(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapEdit.saveButton') }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({ lapTimeMs: 11050, editReason: 'Timing strip glitch' });
    });
  });

  it('disables the cancel button and shows a loading save button while submitting', () => {
    render(<LapEditModal lap={mockLap} isSubmitting onSubmit={vi.fn()} onDismiss={vi.fn()} />);

    expect(screen.getByRole('button', { name: i18n.t('events:form.cancelButton') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('events:detail.runs.lapEdit.saveButton') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
