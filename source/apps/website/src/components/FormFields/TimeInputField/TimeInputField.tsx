// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import TimeInput, { TimeInputProps } from '@cloudscape-design/components/time-input';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import type { TimeInputFieldProps } from './types';

const TimeInputField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | undefined>,
>({
  constraintText,
  control,
  description,
  disabled,
  info,
  label,
  name,
  onBlur,
  onChange,
  secondaryControl,
  shouldUnregister,
  stretch,
  ...timeInputProps
}: TimeInputFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, disabled, name, shouldUnregister });

  const handleBlur: NonNullable<TimeInputProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onFieldBlur, onBlur],
  );

  const handleChange: NonNullable<TimeInputProps['onChange']> = useCallback(
    (event) => {
      onFieldChange(event.detail.value);
      onChange?.(event);
    },
    [onFieldChange, onChange],
  );

  return (
    <FormField
      constraintText={constraintText}
      description={description}
      errorText={fieldError?.message}
      info={info}
      label={label}
      secondaryControl={secondaryControl}
      stretch={stretch}
    >
      <TimeInput
        {...timeInputProps}
        disabled={disabled}
        name={fieldName}
        onBlur={handleBlur}
        onChange={handleChange}
        ref={fieldRef}
        value={fieldValue}
      />
    </FormField>
  );
};

export default TimeInputField;
