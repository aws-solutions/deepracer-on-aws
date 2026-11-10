// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TilesProps } from '@cloudscape-design/components/tiles';
import { type CheckpointInfo, CheckpointSelection, type ModelCheckpoints } from '@deepracer-indy/typescript-client';
import type { TFunction } from 'i18next';

const describeCheckpoint = (t: TFunction<'common'>, checkpoint: CheckpointInfo, showCompletion: boolean) =>
  !showCompletion || checkpoint.completionPercentage === undefined
    ? t('checkpoint.iteration', { iteration: checkpoint.iteration })
    : t('checkpoint.iterationWithCompletion', {
        iteration: checkpoint.iteration,
        completionPercentage: Math.round(checkpoint.completionPercentage),
      });

/**
 * The Best and Last tiles, each describing the checkpoint it maps to. Last is disabled when the model
 * has no last checkpoint recorded, for example a model imported without one.
 */
export const getCheckpointTileItems = (
  t: TFunction<'common'>,
  checkpoints: ModelCheckpoints | undefined,
): TilesProps.TilesDefinition[] => {
  const { best, last } = checkpoints ?? {};
  const isSameCheckpoint = best !== undefined && last !== undefined && best.iteration === last.iteration;
  // When both name one checkpoint, as in a model uploaded with community tooling, the completion figure
  // does not help choose and may be a placeholder, so only the iteration is shown.
  const showCompletion = !isSameCheckpoint;

  let lastDescription = t('checkpoint.last.unavailable');
  if (last) {
    const lastCheckpoint = describeCheckpoint(t, last, showCompletion);
    lastDescription = isSameCheckpoint ? `${lastCheckpoint} ${t('checkpoint.last.sameAsBest')}` : lastCheckpoint;
  }

  return [
    {
      value: CheckpointSelection.BEST,
      label: t('checkpoint.best.label'),
      description: best ? describeCheckpoint(t, best, showCompletion) : t('checkpoint.best.description'),
    },
    {
      value: CheckpointSelection.LAST,
      label: t('checkpoint.last.label'),
      description: lastDescription,
      disabled: !last,
    },
  ];
};
