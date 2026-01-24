// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Checkbox, { CheckboxProps } from '@cloudscape-design/components/checkbox';
import FormField from '@cloudscape-design/components/form-field';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import type { CheckboxFieldProps } from './types';

const CheckboxField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, boolean | undefined>,
>({
  children,
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
  ...checkboxProps
}: CheckboxFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, disabled, name, shouldUnregister });

  const handleBlur: NonNullable<CheckboxProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onFieldBlur, onBlur],
  );

  const handleChange: NonNullable<CheckboxProps['onChange']> = useCallback(
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
      <Checkbox
        {...checkboxProps}
        checked={!!fieldValue}
        disabled={disabled}
        name={fieldName}
        onBlur={handleBlur}
        onChange={handleChange}
        ref={fieldRef}
      >
        {children}
      </Checkbox>
    </FormField>
  );
};

export default CheckboxField;
