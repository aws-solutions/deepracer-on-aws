// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { DeviceColor } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChangeColorModalProps {
  isChanging: boolean;
  isVisible: boolean;
  onChangeColor: (color: DeviceColor) => void;
  onDismiss: () => void;
}

const COLOR_OPTIONS: DeviceColor[] = [
  DeviceColor.RED,
  DeviceColor.GREEN,
  DeviceColor.BLUE,
  DeviceColor.YELLOW,
  DeviceColor.CYAN,
  DeviceColor.MAGENTA,
  DeviceColor.WHITE,
];

const ChangeColorModal = ({ isChanging, isVisible, onChangeColor, onDismiss }: ChangeColorModalProps) => {
  const { t } = useTranslation('devices');
  const [selectedOption, setSelectedOption] = useState<SelectProps.Option | null>(null);

  const options: SelectProps.Options = COLOR_OPTIONS.map((color) => ({
    label: t(`color.${color}`),
    value: color,
  }));

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('detail.colorModalTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isChanging}>
              {t('detail.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (selectedOption?.value) {
                  onChangeColor(selectedOption.value as DeviceColor);
                }
              }}
              loading={isChanging}
              disabled={!selectedOption}
            >
              {t('detail.confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label={t('detail.colorLabel')}>
        <Select
          selectedOption={selectedOption}
          onChange={({ detail }) => setSelectedOption(detail.selectedOption)}
          options={options}
          placeholder={t('detail.colorLabel')}
        />
      </FormField>
    </Modal>
  );
};

export default ChangeColorModal;
