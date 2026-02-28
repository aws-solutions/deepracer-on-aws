// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import i18n from '#i18n/index.js';
import { render, screen, fireEvent } from '#utils/testUtils.js';

import SubmissionVideoModal from '../SubmissionVideoModal.js';

const mockVideoUrl = 'https://example.com/video.mp4';
const mockTitle = 'testModelName #1';
const mockOnDismiss = vi.fn();

describe('<SubmissionVideoModal />', () => {
  beforeEach(() => {
    mockOnDismiss.mockClear();
  });

  it('renders the modal with the correct header', () => {
    render(<SubmissionVideoModal videoUrl={mockVideoUrl} title={mockTitle} onDismiss={mockOnDismiss} />);

    expect(screen.getByText(i18n.t('raceDetails:videoModal.header', { title: mockTitle }))).toBeInTheDocument();
  });

  it('renders a video element with the provided URL', () => {
    render(<SubmissionVideoModal videoUrl={mockVideoUrl} title={mockTitle} onDismiss={mockOnDismiss} />);

    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', mockVideoUrl);
  });

  it('renders the video with autoPlay and controls attributes, and muted property', () => {
    render(<SubmissionVideoModal videoUrl={mockVideoUrl} title={mockTitle} onDismiss={mockOnDismiss} />);

    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).toHaveAttribute('autoplay');
    expect(video).toHaveAttribute('controls');
    // jsdom does not reflect the muted React prop as an HTML attribute; check the property directly
    expect(video.muted).toBe(true);
  });

  it('calls onDismiss when the modal dismiss button is clicked', () => {
    render(<SubmissionVideoModal videoUrl={mockVideoUrl} title={mockTitle} onDismiss={mockOnDismiss} />);

    // Cloudscape modal dismiss button has no accessible text; target it by its CSS class
    const closeButton = document.querySelector('button[class*="dismiss-control"]') as HTMLButtonElement;
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
