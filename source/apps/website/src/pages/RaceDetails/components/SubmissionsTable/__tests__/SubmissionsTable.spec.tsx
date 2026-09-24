// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { JobStatus, Leaderboard, Submission } from '@deepracer-indy/typescript-client';
import { describe, it, expect, afterEach } from 'vitest';

import { render, screen, fireEvent, waitFor } from '#utils/testUtils';

import SubmissionsTable from '../SubmissionsTable';

const mockLeaderboard = {
  leaderboardId: 'lb-1',
  name: 'Test Race',
  openTime: new Date(Date.now() - 86400000),
  closeTime: new Date(Date.now() + 86400000),
} as Leaderboard;

const videoUrl = 'https://example.com/video.mp4';

const completedSubmission: Submission = {
  modelId: 'm-1',
  modelName: 'Model A',
  status: JobStatus.COMPLETED,
  submissionNumber: 1,
  submittedAt: new Date(),
  rankingScore: 12000,
  videoUrl,
};

const pendingSubmission: Submission = {
  ...completedSubmission,
  modelId: 'm-2',
  modelName: 'Model B',
  submissionNumber: 2,
  status: JobStatus.IN_PROGRESS,
  videoUrl: '',
};

describe('<SubmissionsTable />', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a row per submission', () => {
    const { container } = render(
      <SubmissionsTable submissions={[completedSubmission, pendingSubmission]} leaderboard={mockLeaderboard} />,
    );

    const table = createWrapper(container).findTable();
    expect(table?.findRows()).toHaveLength(2);
  });

  it('enables the video actions only for a completed submission with a video', () => {
    render(<SubmissionsTable submissions={[completedSubmission, pendingSubmission]} leaderboard={mockLeaderboard} />);

    const watchButtons = screen.getAllByRole('button', { name: 'Watch video' });
    expect(watchButtons[0]).toBeEnabled();
    expect(watchButtons[1]).toBeDisabled();
  });

  it('opens the video modal when the play button is clicked', () => {
    render(<SubmissionsTable submissions={[completedSubmission]} leaderboard={mockLeaderboard} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Watch video' })[0]);

    const video = document.querySelector('video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', videoUrl);
  });

  it('fetches the video when the download button is clicked', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) } as Response);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<SubmissionsTable submissions={[completedSubmission]} leaderboard={mockLeaderboard} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Download video' })[0]);

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith(videoUrl));
  });

  it('invokes onRefresh when the refresh button is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <SubmissionsTable submissions={[completedSubmission]} leaderboard={mockLeaderboard} onRefresh={onRefresh} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Refresh submissions' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
