// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { fireEvent, render, screen } from '#utils/testUtils';

import RaceStatusBanner from '../RaceStatusBanner';

describe('<RaceStatusBanner />', () => {
  it('renders nothing when status is null', () => {
    render(<RaceStatusBanner status={null} />);

    expect(screen.queryByText(/Submissions|Race/)).not.toBeInTheDocument();
  });

  it('renders submissions open message', () => {
    render(<RaceStatusBanner status="SUBMISSIONS_OPEN" />);

    expect(screen.getByText('Submissions are now open')).toBeInTheDocument();
  });

  it('renders submissions closed message', () => {
    render(<RaceStatusBanner status="SUBMISSIONS_CLOSED" />);

    expect(screen.getByText('Submissions are now closed')).toBeInTheDocument();
  });

  it('renders in progress message', () => {
    render(<RaceStatusBanner status="IN_PROGRESS" />);

    expect(screen.getByText('Race is in progress')).toBeInTheDocument();
  });

  it('renders completed message', () => {
    render(<RaceStatusBanner status="COMPLETED" />);

    expect(screen.getByText('Race completed')).toBeInTheDocument();
  });

  it('dismisses banner when close button is clicked', () => {
    render(<RaceStatusBanner status="IN_PROGRESS" />);

    expect(screen.getByText('Race is in progress')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Race is in progress')).not.toBeInTheDocument();
  });
});
