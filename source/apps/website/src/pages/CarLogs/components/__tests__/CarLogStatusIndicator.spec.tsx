// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogFetchStatus } from '@deepracer-indy/typescript-client';
import { describe, expect, it } from 'vitest';

import { render, screen } from '#utils/testUtils';

import CarLogStatusIndicator from '../CarLogStatusIndicator';

describe('<CarLogStatusIndicator />', () => {
  it('renders pending statuses', () => {
    render(<CarLogStatusIndicator status={CarLogFetchStatus.CREATED} />);

    expect(screen.getByText('Created')).toBeInTheDocument();
  });

  it('renders success statuses', () => {
    render(<CarLogStatusIndicator status={CarLogFetchStatus.DONE} />);

    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders error statuses', () => {
    render(<CarLogStatusIndicator status={CarLogFetchStatus.FAILED} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
  });
});
