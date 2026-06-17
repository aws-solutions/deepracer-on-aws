// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';

import { render, screen } from '#utils/testUtils';

import RaceProgressBar from '../RaceProgressBar';

describe('<RaceProgressBar />', () => {
  it('shows progress description with completed and total counts', () => {
    render(<RaceProgressBar completedModels={5} totalModels={20} />);

    expect(screen.getByTestId('race-progress-bar')).toBeInTheDocument();
    expect(screen.getByText('5 of 20 models evaluated')).toBeInTheDocument();
  });

  it('shows zero progress when no models completed', () => {
    render(<RaceProgressBar completedModels={0} totalModels={10} />);

    expect(screen.getByText('0 of 10 models evaluated')).toBeInTheDocument();
  });

  it('handles zero total models', () => {
    render(<RaceProgressBar completedModels={0} totalModels={0} />);

    expect(screen.getByText('0 of 0 models evaluated')).toBeInTheDocument();
  });

  it('updates when props change', () => {
    const { rerender } = render(<RaceProgressBar completedModels={3} totalModels={10} />);

    expect(screen.getByText('3 of 10 models evaluated')).toBeInTheDocument();

    rerender(<RaceProgressBar completedModels={7} totalModels={10} />);

    expect(screen.getByText('7 of 10 models evaluated')).toBeInTheDocument();
  });
});
