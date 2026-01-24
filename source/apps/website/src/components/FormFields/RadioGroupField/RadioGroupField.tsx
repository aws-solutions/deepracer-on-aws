// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import RadioGroup, { RadioGroupProps } from '@cloudscape-design/components/radio-group';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import { transformToNumber } from '#utils/formUtils';

import type { NumberChangeEvent, RadioGroupFieldProps } from './types';

const RadioGroupField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
>({
  constraintText,
  control,
  description,
  info,
  items,
  label,
  name,
  onChange,
  secondaryControl,
  shouldUnregister,
  stretch,
  type,
  ...radioGroupProps
}: RadioGroupFieldProps<FormValues, FieldName>) => {
  const {
    field: { onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, name, shouldUnregister });

  const handleChange: NonNullable<RadioGroupProps['onChange']> = useCallback(
    (event) => {
      if (type === 'number') {
        onFieldChange(transformToNumber(event.detail.value));
        onChange?.({
          ...event,
          detail: { value: transformToNumber(event.detail.value) },
        } as NumberChangeEvent);
      } else {
        onFieldChange(event.detail.value);
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
      <RadioGroup
        {...radioGroupProps}
        items={items as RadioGroupProps['items']}
        onChange={handleChange}
        name={fieldName}
        ref={fieldRef}
        value={fieldValue}
      />
    </FormField>
  );
};

export default RadioGroupField;
