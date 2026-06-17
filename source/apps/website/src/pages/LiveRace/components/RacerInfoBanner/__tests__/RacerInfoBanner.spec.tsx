// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { render, screen } from '#utils/testUtils';

import RacerInfoBanner from '../RacerInfoBanner';

const defaultProps = {
  participantName: 'Alice',
  modelName: 'SpeedDemon-v3',
  queuePosition: 2,
  totalModels: 5,
};

describe('<RacerInfoBanner />', () => {
  it('shows racer name when participant is active', () => {
    render(<RacerInfoBanner {...defaultProps} />);

    expect(screen.getByTestId('racer-info-banner')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Now racing:')).toBeInTheDocument();
  });

  it('renders nothing when no participant', () => {
    const { container } = render(<RacerInfoBanner {...defaultProps} participantName={null} />);

    expect(container.innerHTML).toBe('');
  });

  it('renders avatar', () => {
    render(<RacerInfoBanner {...defaultProps} />);

    expect(screen.getByAltText('avatar')).toBeInTheDocument();
  });
});
