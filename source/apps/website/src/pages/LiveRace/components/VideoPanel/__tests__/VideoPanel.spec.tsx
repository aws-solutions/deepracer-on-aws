// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';

import { render, screen } from '#utils/testUtils';

import VideoPanel from '../VideoPanel';

vi.mock('#components/VideoStreamPlayer', () => ({
  default: ({ src }: { src: string }) => (
    <div data-testid="video-stream-player" data-src={src}>
      Mock Video Player
    </div>
  ),
}));

describe('<VideoPanel />', () => {
  const defaultProps = {
    streamUrl: null as string | null,
    participantName: 'Alice',
    modelName: 'SpeedDemon-v3',
    allComplete: false,
    hasFailed: false,
  };

  it('shows transition screen when streamUrl is null', () => {
    render(<VideoPanel {...defaultProps} />);

    expect(screen.getByTestId('transition-screen')).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/SpeedDemon-v3/)).toBeInTheDocument();
    expect(screen.queryByTestId('video-stream-player')).not.toBeInTheDocument();
  });

  it('renders VideoStreamPlayer when streamUrl is provided', () => {
    render(<VideoPanel {...defaultProps} streamUrl="https://example.com/stream.m3u8" />);

    const player = screen.getByTestId('video-stream-player');
    expect(player).toBeInTheDocument();
    expect(player).toHaveAttribute('data-src', 'https://example.com/stream.m3u8');
    expect(screen.queryByTestId('transition-screen')).not.toBeInTheDocument();
  });

  it('remounts VideoStreamPlayer when streamUrl changes', () => {
    const { rerender } = render(<VideoPanel {...defaultProps} streamUrl="https://example.com/stream-a.m3u8" />);

    expect(screen.getByTestId('video-stream-player')).toHaveAttribute('data-src', 'https://example.com/stream-a.m3u8');

    rerender(<VideoPanel {...defaultProps} streamUrl="https://example.com/stream-b.m3u8" />);

    expect(screen.getByTestId('video-stream-player')).toHaveAttribute('data-src', 'https://example.com/stream-b.m3u8');
  });

  it('transitions from video to transition screen when streamUrl becomes null', () => {
    const { rerender } = render(<VideoPanel {...defaultProps} streamUrl="https://example.com/stream.m3u8" />);

    expect(screen.getByTestId('video-stream-player')).toBeInTheDocument();

    rerender(<VideoPanel {...defaultProps} streamUrl={null} />);

    expect(screen.getByTestId('transition-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('video-stream-player')).not.toBeInTheDocument();
  });

  it('shows all-complete message when allComplete is true', () => {
    render(<VideoPanel {...defaultProps} allComplete={true} />);

    expect(screen.getByRole('img', { name: 'checkered flag' })).toBeInTheDocument();
  });

  it('shows retry prompt when allComplete and hasFailed', () => {
    render(<VideoPanel {...defaultProps} allComplete={true} hasFailed={true} />);

    expect(screen.getByRole('img', { name: 'checkered flag' })).toBeInTheDocument();
  });
});
