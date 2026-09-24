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

interface MoveToFleetModalProps {
  fleets: Fleet[];
  deviceCount: number;
  isMoving: boolean;
  isVisible: boolean;
  /** Called with the target fleetId, or undefined to unassign the selected devices. */
  onMove: (fleetId?: string) => void;
  onDismiss: () => void;
}

const MoveToFleetModal = ({ fleets, deviceCount, isMoving, isVisible, onMove, onDismiss }: MoveToFleetModalProps) => {
  const { t } = useTranslation('devices');

  const options: SelectProps.Options = [
    { label: t('list.moveToFleet.unassignedOption'), value: UNASSIGNED_VALUE },
    ...fleets.map((fleet) => ({ label: fleet.name, value: fleet.fleetId })),
  ];
  const [selectedOption, setSelectedOption] = useState<SelectProps.Option>(options[0]);

  return (
    <Modal
      visible={isVisible}
      onDismiss={onDismiss}
      header={t('list.moveToFleet.modalTitle', { count: deviceCount })}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss} disabled={isMoving}>
              {t('list.moveToFleet.cancel')}
            </Button>
            <Button variant="primary" onClick={() => onMove(selectedOption.value || undefined)} loading={isMoving}>
              {t('list.moveToFleet.confirm')}
            </Button>
          </SpaceBetween>
        </Box>
      }
    >
      <FormField label={t('list.moveToFleet.fleetLabel')}>
        <Select
          selectedOption={selectedOption}
          onChange={({ detail }) => setSelectedOption(detail.selectedOption)}
          options={options}
        />
      </FormField>
    </Modal>
  );
};

export default MoveToFleetModal;
