// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import Input, { InputProps } from '@cloudscape-design/components/input';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import { transformToNumber } from '#utils/formUtils';

import type { InputFieldProps, NumberChangeEvent } from './types';

const InputField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
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
  type,
  ...inputProps
}: InputFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, disabled, name, shouldUnregister });

  const handleBlur: NonNullable<InputProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onBlur, onFieldBlur],
  );

  const handleChange: NonNullable<InputProps['onChange']> = useCallback(
    (event) => {
      if (type === 'number' || (type === 'text' && typeof fieldValue === 'number')) {
        const filteredValue = event.detail.value.replace(/[^0-9.-]/g, '');
        const negativeFiltered = filteredValue.replace(/(?!^)-/g, '');
        const decimalFiltered = negativeFiltered.replace(/\.(?=.*\.)/g, '');

        const numericValue = transformToNumber(decimalFiltered);
        onFieldChange(numericValue);

        if (onChange && (type === 'number' || (type === 'text' && typeof fieldValue === 'number'))) {
          (onChange as (e: NumberChangeEvent) => void)({
            ...event,
            detail: { value: numericValue },
          } as NumberChangeEvent);
        }
      } else {
        onFieldChange(event.detail.value);
        if (onChange) {
          (onChange as InputProps['onChange'])?.(event);
        }
      }
    },
    [onChange, onFieldChange, type, fieldValue],
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
      <Input
        {...inputProps}
        disabled={disabled}
        name={fieldName}
        onBlur={handleBlur}
        onChange={handleChange}
        ref={fieldRef}
        type={type}
        value={fieldValue === undefined || fieldValue === null ? '' : String(fieldValue)}
      />
    </FormField>
  );
};

export default InputField;
