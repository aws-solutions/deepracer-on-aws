// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';

import { fireEvent, render, screen } from '#utils/testUtils';

import WinnerOverlay, { Winner } from '../WinnerOverlay';

const mockWinner: Winner = {
  participantName: 'Alice',
  modelName: 'SpeedDemon-v3',
  bestLapTime: 12450,
  rank: 1,
  avatar: {},
};

describe('<WinnerOverlay />', () => {
  it('renders winner info when winner is provided', () => {
    render(<WinnerOverlay winner={mockWinner} />);

    expect(screen.getByTestId('winner-overlay')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('SpeedDemon-v3')).toBeInTheDocument();
  });

  it('displays formatted lap time', () => {
    render(<WinnerOverlay winner={mockWinner} />);

    expect(screen.getByText(/12\.450/)).toBeInTheDocument();
  });

  it('renders nothing when winner is null', () => {
    const { container } = render(<WinnerOverlay winner={null} />);

    expect(container.innerHTML).toBe('');
  });

  it('shows dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(<WinnerOverlay winner={mockWinner} onDismiss={onDismiss} />);

    const dismissButton = screen.getByTestId('winner-overlay-dismiss');
    fireEvent.click(dismissButton);

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('hides dismiss button when onDismiss is not provided', () => {
    render(<WinnerOverlay winner={mockWinner} />);

    expect(screen.queryByTestId('winner-overlay-dismiss')).not.toBeInTheDocument();
  });
});
