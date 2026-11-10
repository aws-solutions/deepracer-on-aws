// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CheckpointSelection as CheckpointSelectionValue } from '@deepracer-indy/typescript-client';
import { userEvent } from '@storybook/test';

import i18n from '#i18n';
import { render, screen } from '#utils/testUtils';

import CheckpointSelection from './CheckpointSelection';
import { getCheckpointTileItems } from './utils';

const t = i18n.getFixedT(null, 'common');

describe('getCheckpointTileItems()', () => {
  it('describes each checkpoint by its iteration and average completion', () => {
    const [best, last] = getCheckpointTileItems(t, {
      best: { iteration: 12, completionPercentage: 100 },
      last: { iteration: 15, completionPercentage: 87.5 },
    });

    expect(best).toMatchObject({
      value: CheckpointSelectionValue.BEST,
      description: t('checkpoint.iterationWithCompletion', { iteration: 12, completionPercentage: 100 }),
    });
    expect(last).toMatchObject({
      value: CheckpointSelectionValue.LAST,
      description: t('checkpoint.iterationWithCompletion', { iteration: 15, completionPercentage: 88 }),
      disabled: false,
    });
  });

  it('describes a checkpoint without a completion percentage by its iteration only', () => {
    const [best] = getCheckpointTileItems(t, { best: { iteration: 3 } });

    expect(best.description).toBe(t('checkpoint.iteration', { iteration: 3 }));
  });

  it('notes when Best and Last are the same checkpoint, and shows only its iteration', () => {
    // Community upload tooling writes a placeholder completion of 50 when it collapses both to one checkpoint.
    const checkpoint = { iteration: 7, completionPercentage: 50 };
    const [best, last] = getCheckpointTileItems(t, { best: checkpoint, last: checkpoint });

    expect(best.description).toBe(t('checkpoint.iteration', { iteration: 7 }));
    expect(last.description).toBe(`${t('checkpoint.iteration', { iteration: 7 })} ${t('checkpoint.last.sameAsBest')}`);
  });

  it('keeps Best available and disables Last when the model has no checkpoints recorded', () => {
    const [best, last] = getCheckpointTileItems(t, undefined);

    expect(best).toMatchObject({ description: t('checkpoint.best.description') });
    expect(best.disabled).toBeUndefined();
    expect(last).toMatchObject({ description: t('checkpoint.last.unavailable'), disabled: true });
  });
});

describe('<CheckpointSelection />', () => {
  it('reports the chosen checkpoint', async () => {
    const onChange = vi.fn();
    render(
      <CheckpointSelection
        checkpoints={{ best: { iteration: 12 }, last: { iteration: 15 } }}
        value={CheckpointSelectionValue.BEST}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByText(t('checkpoint.last.label')));

    expect(onChange).toHaveBeenCalledWith(CheckpointSelectionValue.LAST);
  });
});
