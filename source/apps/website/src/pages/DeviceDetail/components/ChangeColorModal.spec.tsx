// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { DeviceColor } from '@deepracer-indy/typescript-client';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import i18n from '#i18n/index.js';
import { render, screen } from '#utils/testUtils';

import ChangeColorModal from './ChangeColorModal';

describe('<ChangeColorModal />', () => {
  const setup = () => {
    const onChangeColor = vi.fn();
    const onDismiss = vi.fn();
    render(<ChangeColorModal isChanging={false} isVisible onChangeColor={onChangeColor} onDismiss={onDismiss} />);
    return { onChangeColor, onDismiss };
  };

  it('disables confirm until a color is selected', () => {
    setup();
    expect(screen.getByRole('button', { name: i18n.t('devices:detail.confirm') })).toBeDisabled();
  });

  it('selects a color and confirms', async () => {
    const user = userEvent.setup();
    const { onChangeColor } = setup();

    const [colorTrigger] = screen.getAllByLabelText(i18n.t('devices:detail.colorLabel'));
    await user.click(colorTrigger);
    await user.click(screen.getByRole('option', { name: i18n.t('devices:color.RED') }));

    await user.click(screen.getByRole('button', { name: i18n.t('devices:detail.confirm') }));

    expect(onChangeColor).toHaveBeenCalledWith(DeviceColor.RED);
  });

  it('dismisses without confirming when cancel is clicked', async () => {
    const user = userEvent.setup();
    const { onDismiss, onChangeColor } = setup();

    await user.click(screen.getByRole('button', { name: i18n.t('devices:detail.cancel') }));

    expect(onDismiss).toHaveBeenCalled();
    expect(onChangeColor).not.toHaveBeenCalled();
  });
});
