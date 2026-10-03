// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import createWrapper from '@cloudscape-design/components/test-utils/dom';
import { CarType } from '@deepracer-indy/typescript-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { fireEvent, render, screen } from '#utils/testUtils';

import ChangeCarTypeModal from './ChangeCarTypeModal';

const onChangeCarType = vi.fn();
const onDismiss = vi.fn();

const renderModal = (props: Partial<React.ComponentProps<typeof ChangeCarTypeModal>> = {}) =>
  render(
    <ChangeCarTypeModal
      isChanging={false}
      isVisible
      onChangeCarType={onChangeCarType}
      onDismiss={onDismiss}
      {...props}
    />,
  );

const confirmButton = () => screen.getByRole('button', { name: i18n.t('devices:detail.confirm') });

describe('<ChangeCarTypeModal />', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables Confirm when the device has no car type and nothing is selected', () => {
    renderModal({ currentCarType: undefined });

    // No preselection (placeholder shown), so Confirm is disabled and cannot write a default value.
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(onChangeCarType).not.toHaveBeenCalled();
  });

  it('disables Confirm while the selection still equals the current car type', () => {
    renderModal({ currentCarType: CarType.DEEPRACER });

    // Opens preselected to the current value → confirming would be a no-op, so it stays disabled.
    expect(confirmButton()).toBeDisabled();
    fireEvent.click(confirmButton());
    expect(onChangeCarType).not.toHaveBeenCalled();
  });

  it('enables Confirm once a different car type is selected and returns the chosen value', () => {
    renderModal({ currentCarType: undefined });

    // Drive the Cloudscape Select via its test-utils wrapper (reliable in jsdom, unlike raw clicks).
    const select = createWrapper().findSelect('[data-testid="change-car-type-select"]');
    select?.openDropdown();
    select?.selectOptionByValue(CarType.DEEPRACER_RPI);

    expect(confirmButton()).toBeEnabled();
    fireEvent.click(confirmButton());
    expect(onChangeCarType).toHaveBeenCalledWith(CarType.DEEPRACER_RPI);
  });
});
