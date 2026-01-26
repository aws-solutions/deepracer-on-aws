// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';
import userEvent from '@testing-library/user-event';
import i18n from 'i18next';
import { useForm } from 'react-hook-form';
import { vi } from 'vitest';

import SelectField from '#components/FormFields/SelectField';
import * as stories from '#pages/CreateEvaluation/CreateEvaluation.stories';
import { render, screen } from '#utils/testUtils';

const { Default } = composeStories(stories);

describe('CreateEvaluation Page', () => {
  it('renders the create evaluation page', () => {
    render(<Default />, { isStorybookStory: true });

    expect(screen.getByText(i18n.t('createEvaluation:raceType.header'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('createEvaluation:startButton') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('createEvaluation:cancelButton') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createEvaluation:raceType.nameInput.label'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createEvaluation:raceType.tiles.label'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createEvaluation:evaluateCriteria.header'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('createEvaluation:evaluateCriteria.numberOfLaps.header'))).toBeInTheDocument();
  });

  it('should allow selecting 5 laps from the dropdown', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();

    const TestComponent = () => {
      const { control } = useForm({ defaultValues: { maxLaps: 3 as number } });
      return (
        <SelectField
          control={control}
          name="maxLaps"
          label={i18n.t('createEvaluation:evaluateCriteria.numberOfLaps.header')}
          type="number"
          options={[3, 4, 5].map((count) => ({
            label: i18n.t('createEvaluation:evaluateCriteria.numberOfLaps.lapCount', { count }),
            value: count,
          }))}
          onChange={onChangeMock}
        />
      );
    };

    render(<TestComponent />);

    const lapDropdown = screen.getByLabelText(i18n.t('createEvaluation:evaluateCriteria.numberOfLaps.header'));
    await user.click(lapDropdown);

    const fiveLapsOption = screen.getByText(
      i18n.t('createEvaluation:evaluateCriteria.numberOfLaps.lapCount', { count: 5 }),
    );
    await user.click(fiveLapsOption);

    expect(onChangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          selectedOption: expect.objectContaining({
            value: 5,
          }),
        }),
      }),
    );

    const callArgs = onChangeMock.mock.calls[0][0];
    expect(typeof callArgs.detail.selectedOption.value).toBe('number');
    expect(callArgs.detail.selectedOption.value).toBe(5);
  });
});
