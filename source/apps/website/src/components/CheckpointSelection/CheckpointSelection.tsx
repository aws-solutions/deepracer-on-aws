// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import Tiles from '@cloudscape-design/components/tiles';
import type {
  CheckpointSelection as CheckpointSelectionValue,
  ModelCheckpoints,
} from '@deepracer-indy/typescript-client';
import { useTranslation } from 'react-i18next';

import { getCheckpointTileItems } from './utils';

interface CheckpointSelectionProps {
  checkpoints: ModelCheckpoints | undefined;
  value: CheckpointSelectionValue;
  onChange: (value: CheckpointSelectionValue) => void;
}

/** Best or Last checkpoint choice for pages that keep their own state rather than a form. */
const CheckpointSelection = ({ checkpoints, value, onChange }: CheckpointSelectionProps) => {
  const { t } = useTranslation('common');

  return (
    <FormField label={t('checkpoint.label')} description={t('checkpoint.description')}>
      <Tiles
        columns={2}
        items={getCheckpointTileItems(t, checkpoints)}
        value={value}
        onChange={({ detail }) => onChange(detail.value as CheckpointSelectionValue)}
      />
    </FormField>
  );
};

export default CheckpointSelection;
