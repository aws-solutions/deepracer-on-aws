// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { CarColor, CarShell } from '@deepracer-indy/typescript-client';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { ShellColorHexValue, carShellAvailableColors } from '#constants/carShell.js';
import { CreateModelFormValues } from '#pages/CreateModel/types';

import './styles.css';

interface TrimSelectionProps {
  control: Control<CreateModelFormValues>;
  selectedShell: CarShell;
  setValue: UseFormSetValue<CreateModelFormValues>;
}

const TrimSelection = ({ control, selectedShell, setValue }: TrimSelectionProps) => {
  const { t } = useTranslation('createModel', { keyPrefix: 'carShellSelection' });

  const selectedColor = useWatch({ control, name: 'carCustomization.carColor' });

  const carColorSelections = carShellAvailableColors[selectedShell];

  return (
    <div>
      <div>
        <Box padding={{ bottom: 'l' }} variant="h5">
          {t('vehicleShell.trimTitle')}
        </Box>
        <SpaceBetween size="xl" direction="horizontal">
          {carColorSelections.map((color: CarColor) => (
            <div
              className={`selectableCircle ${selectedColor === color ? 'selectableCircleActive' : null}`}
              key={color}
              onClick={() => {
                setValue('carCustomization.carColor', color);
              }}
              role="button"
              style={{ backgroundColor: ShellColorHexValue[color] }}
              title={color}
            ></div>
          ))}
        </SpaceBetween>
      </div>
    </div>
  );
};

export default TrimSelection;
