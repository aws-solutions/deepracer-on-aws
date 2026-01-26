// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Input from '@cloudscape-design/components/input';
import { memo, useEffect, useState } from 'react';

import { IndexedDiscreteActionSpaceItem } from '#pages/CreateModel/components/ActionSpace/components/DiscreteActionSpace/types';
import { DiscreteActionValueType } from '#pages/CreateModel/components/ActionSpace/constants';

interface DiscreteTableProps {
  ariaLabelledby?: string;
  graphId: number;
  valueType: DiscreteActionValueType;
  min: number;
  max: number;
  isEnabledAction: boolean;
  defaultValue: number;
  action: IndexedDiscreteActionSpaceItem;
  isFocused: boolean;
  updateActionSpaceItem(graphID: number, valueType: string, value: number): void;
  onFocusChange(graphId: number, valueType: DiscreteActionValueType, focused: boolean): void;
}

const arePropsEqual = (prevProps: DiscreteTableProps, nextProps: DiscreteTableProps) => {
  return (
    prevProps.action?.steeringAngle === nextProps.action?.steeringAngle &&
    prevProps.action?.speed === nextProps.action?.speed &&
    prevProps.isFocused === nextProps.isFocused &&
    prevProps.isEnabledAction === nextProps.isEnabledAction
  );
};

const DiscreteTableInput = ({
  graphId,
  valueType,
  min,
  max,
  action,
  updateActionSpaceItem,
  ariaLabelledby,
  isFocused,
  onFocusChange,
}: DiscreteTableProps) => {
  const [inputValue, setInputValue] = useState('');
  const [isInvalid, setIsInvalid] = useState(false);

  // Get current value from action based on type
  const currentValue = valueType === DiscreteActionValueType.SPEED ? action.speed : action.steeringAngle;

  // Update input value when action changes and input is not focused
  useEffect(() => {
    if (!isFocused) {
      setInputValue(String(currentValue));
    }
  }, [currentValue, isFocused]);

  // Set step attribute for speed inputs
  useEffect(() => {
    if (valueType === DiscreteActionValueType.SPEED) {
      const nativeInput = document.getElementById(`input_${valueType}_${graphId}`);
      nativeInput?.setAttribute('step', '0.1');
    }
  }, [valueType, graphId]);

  return (
    <Input
      ariaLabelledby={ariaLabelledby}
      controlId={`input_${valueType}_${graphId}`}
      onFocus={() => {
        onFocusChange(graphId, valueType, true);
        setInputValue(String(currentValue));
        setIsInvalid(false);
      }}
      onBlur={() => {
        onFocusChange(graphId, valueType, false);
      }}
      onChange={({ detail }) => {
        setInputValue(detail.value);
        if (
          detail.value !== '' &&
          !isNaN(Number(detail.value)) &&
          Number(detail.value) <= max &&
          Number(detail.value) >= min
        ) {
          const roundedValue =
            valueType === DiscreteActionValueType.SPEED
              ? Number(Number(detail.value).toFixed(2))
              : Number(Number(detail.value).toFixed(1));
          updateActionSpaceItem(graphId, valueType, roundedValue);
          setIsInvalid(false);
        } else if (detail.value !== '') {
          // Only mark as invalid if there's actually a value to validate
          setIsInvalid(true);
        } else {
          // Clear invalid state when input is empty (user is typing)
          setIsInvalid(false);
        }
      }}
      value={isFocused ? inputValue : String(currentValue)}
      autoComplete={false}
      invalid={isFocused && isInvalid}
      type="number"
    />
  );
};

export default memo(DiscreteTableInput, arePropsEqual);
