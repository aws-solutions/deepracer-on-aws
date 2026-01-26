// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import { NonCancelableCustomEvent } from '@cloudscape-design/components/interfaces';
import Select, { SelectProps } from '@cloudscape-design/components/select';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import { transformToNumber } from '#utils/formUtils';

import type { NumberOptionChangeDetail, SelectFieldProps } from './types';
import { getMatchingOption } from './utils';

const SelectField = <
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
  options,
  secondaryControl,
  shouldUnregister,
  stretch,
  type,
  ...selectProps
}: SelectFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, name, shouldUnregister });

  const handleBlur: NonNullable<SelectProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onFieldBlur, onBlur],
  );

  const handleChange: NonNullable<SelectProps['onChange']> = useCallback(
    (event) => {
      if (type === 'number') {
        onFieldChange(transformToNumber(event.detail.selectedOption.value));
        onChange?.({
          ...event,
          detail: {
            selectedOption: {
              ...event.detail.selectedOption,
              value: transformToNumber(event.detail.selectedOption.value),
            },
          },
        } as NonCancelableCustomEvent<NumberOptionChangeDetail>);
      } else {
        onFieldChange(event.detail.selectedOption.value);
        onChange?.(event);
      }
    },
    [onChange, onFieldChange, type],
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
      <Select
        {...selectProps}
        disabled={disabled}
        onBlur={handleBlur}
        onChange={handleChange}
        options={options as SelectProps.Options}
        ref={fieldRef}
        selectedOption={getMatchingOption(options, fieldValue)}
      />
    </FormField>
  );
};

export default SelectField;
