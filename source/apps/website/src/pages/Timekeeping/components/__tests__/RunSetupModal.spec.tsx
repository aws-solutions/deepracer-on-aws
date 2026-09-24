// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SelectProps } from '@cloudscape-design/components/select';
import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import { RunSetupModal } from '../RunSetupModal';

const racerOptions: SelectProps.Options = [
  { label: 'rclove', value: 'rclove' },
  { label: 'SpeedRacer42', value: 'racer-2' },
];

describe('<RunSetupModal />', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the DREM-inspired race, racer, allowance, and proxy setup controls', () => {
    localStorage.setItem(
      'deepracer-timekeeping-selected-event-and-track',
      JSON.stringify({
        selectedEventId: 'event-1',
        selectedLeaderboardId: 'track-1',
        selectedEventName: 'AWS Paris Summit 2023',
        selectedTrackName: 'Paris AWS Summit',
      }),
    );
    render(<RunSetupModal isVisible onDismiss={vi.fn()} onNext={vi.fn()} racerOptions={racerOptions} />);

    expect(
      screen.getByText(
        i18n.t('timekeeping:runSetup.header', {
          event: 'AWS Paris Summit 2023',
          track: 'Paris AWS Summit',
        }),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(i18n.t('timekeeping:runSetup.raceAllowance'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('timekeeping:runSetup.racedByProxy'))).toBeInTheDocument();
    expect(screen.getByTestId('run-setup-racer-select')).toBeInTheDocument();
    expect(screen.getByTestId('run-setup-raced-by-proxy-toggle')).toBeInTheDocument();
  });

  it('calls onNext with the selected racer and proxy choice', () => {
    const onNext = vi.fn();
    render(<RunSetupModal isVisible onDismiss={vi.fn()} onNext={onNext} racerOptions={racerOptions} />);

    const wrapper = createWrapper();
    const racerSelect = wrapper.findSelect('[data-testid="run-setup-racer-select"]');
    racerSelect?.openDropdown();
    racerSelect?.selectOptionByValue('racer-2');

    const proxyToggle = wrapper.findToggle('[data-testid="run-setup-raced-by-proxy-toggle"]');
    const proxyToggleInput = proxyToggle?.findNativeInput().getElement();
    if (!proxyToggleInput) throw new Error('Expected race-by-proxy toggle input');
    fireEvent.click(proxyToggleInput);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.next') }));

    expect(onNext).toHaveBeenCalledWith({
      selectedRacer: { label: 'SpeedRacer42', value: 'racer-2' },
      racedByProxy: true,
    });
  });

  it('calls onDismiss when cancel is clicked', () => {
    const onDismiss = vi.fn();
    render(<RunSetupModal isVisible onDismiss={onDismiss} onNext={vi.fn()} racerOptions={racerOptions} />);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('timekeeping:runSetup.cancel') }));

    expect(onDismiss).toHaveBeenCalled();
  });
});
