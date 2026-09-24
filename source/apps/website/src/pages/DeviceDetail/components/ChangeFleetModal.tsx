// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import FormField from '@cloudscape-design/components/form-field';
import Modal from '@cloudscape-design/components/modal';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { Fleet } from '@deepracer-indy/typescript-client';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const UNASSIGNED_VALUE = '';

interface ChangeFleetModalProps {
  fleets: Fleet[];
  currentFleetId?: string;
  isChanging: boolean;
  isVisible: boolean;
  /** Called with the target fleetId, or undefined to unassign. */
  onChangeFleet: (fleetId?: string) => void;
  onDismiss: () => void;
}

const ChangeFleetModal = ({
  fleets,
  currentFleetId,
  isChanging,
  isVisible,
  onChangeFleet,
  onDismiss,
}: ChangeFleetModalProps) => {
  const { t } = useTranslation('devices');

  const options: SelectProps.Options = [
    { label: t('detail.unassignedOption'), value: UNASSIGNED_VALUE },
    ...fleets.map((fleet) => ({ label: fleet.name, value: fleet.fleetId })),
  ];

  const [selectedOption, setSelectedOption] = useState<SelectProps.Option>(
    options.find((o) => o.value === (currentFleetId ?? UNASSIGNED_VALUE)) ?? options[0],
  );

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('detail.changeFleetModalTitle')}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isChanging}>
              {t('detail.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => onChangeFleet(selectedOption.value || undefined)}
              loading={isChanging}
            >
              {t('detail.confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label={t('detail.fleetLabel')}>
        <Select
          selectedOption={selectedOption}
          onChange={({ detail }) => setSelectedOption(detail.selectedOption)}
          options={options}
        />
      </FormField>
    </Modal>
  );
};

export default ChangeFleetModal;
