// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';

import VideoStreamPlayer from '#components/VideoStreamPlayer/VideoStreamPlayer.js';
import { render, screen } from '#utils/testUtils.js';

vi.mock('hls.js', () => ({
  default: class MockHls {
    static isSupported = vi.fn(() => true);
    static Events = {
      ERROR: 'hlsError',
      MANIFEST_LOADED: 'hlsManifestLoaded',
    };
    static ErrorTypes = {
      NETWORK_ERROR: 'networkError',
      MEDIA_ERROR: 'mediaError',
    };

    loadSource = vi.fn();
    attachMedia = vi.fn();
    on = vi.fn();
    destroy = vi.fn();
  },
}));

describe('VideoStreamPlayer', () => {
  const mockSrc = 'https://example.com/stream.m3u8';

  it('renders video element', () => {
    render(<VideoStreamPlayer src={mockSrc} />);
    const video = screen.getByTestId('video-stream-player');
    expect(video).toBeInTheDocument();
    expect(video).toHaveClass('videoStreamPlayer');
  });

  it('has autoPlay and controls attributes', () => {
    render(<VideoStreamPlayer src={mockSrc} />);
    const video = screen.getByTestId('video-stream-player');
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('controls');
  });
});
