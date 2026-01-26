// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import Toggle, { ToggleProps } from '@cloudscape-design/components/toggle';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import type { ToggleFieldProps } from './types';

const ToggleField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, boolean | undefined>,
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
  ...toggleProps
}: ToggleFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, disabled, name, shouldUnregister });

  const handleBlur: NonNullable<ToggleProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onFieldBlur, onBlur],
  );

  const handleChange: NonNullable<ToggleProps['onChange']> = useCallback(
    (event) => {
      onFieldChange(event.detail.checked);
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
      <Toggle
        {...toggleProps}
        checked={!!fieldValue}
        disabled={disabled}
        name={fieldName}
        onBlur={handleBlur}
        onChange={handleChange}
        ref={fieldRef}
      />
    </FormField>
  );
};

export default ToggleField;
