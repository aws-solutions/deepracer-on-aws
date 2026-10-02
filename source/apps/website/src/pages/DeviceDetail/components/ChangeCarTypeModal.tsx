// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { CarType } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChangeCarTypeModalProps {
  currentCarType?: CarType;
  isChanging: boolean;
  isVisible: boolean;
  /** Called with the target car type. */
  onChangeCarType: (carType: CarType) => void;
  onDismiss: () => void;
}

const ChangeCarTypeModal = ({
  currentCarType,
  isChanging,
  isVisible,
  onChangeCarType,
  onDismiss,
}: ChangeCarTypeModalProps) => {
  const { t } = useTranslation('devices');

  const options: SelectProps.Options = Object.values(CarType).map((carType) => ({
    label: t(`carType.${carType}`),
    value: carType,
  }));

  const [selectedOption, setSelectedOption] = useState<SelectProps.Option | null>(
    options.find((o) => o.value === currentCarType) ?? null,
  );

  const isConfirmDisabled = !selectedOption || selectedOption.value === currentCarType;

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('detail.changeCarTypeModalTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isChanging}>
              {t('detail.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => selectedOption && onChangeCarType(selectedOption.value as CarType)}
              loading={isChanging}
              disabled={isConfirmDisabled}
            >
              {t('detail.confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label={t('detail.carTypeLabel')} description={t('detail.carTypeDescription')}>
        <Select
          selectedOption={selectedOption}
          onChange={({ detail }) => setSelectedOption(detail.selectedOption)}
          options={options}
          placeholder={t('detail.carTypeNotSet')}
          data-testid="change-car-type-select"
        />
      </FormField>
    </Modal>
  );
};

export default ChangeCarTypeModal;
