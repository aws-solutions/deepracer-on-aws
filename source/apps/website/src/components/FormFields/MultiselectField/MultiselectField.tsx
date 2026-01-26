// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import Multiselect, { MultiselectProps } from '@cloudscape-design/components/multiselect';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import type { MultiselectFieldProps } from './types';
import { getMatchingOptions } from './utils';

const MultiselectField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string[] | undefined>,
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
  ...multiselectProps
}: MultiselectFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, disabled, name, shouldUnregister });

  const handleBlur: NonNullable<MultiselectProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onFieldBlur, onBlur],
  );

  const handleChange: NonNullable<MultiselectProps['onChange']> = useCallback(
    (event) => {
      onFieldChange(event.detail.selectedOptions.map((option) => option.value));
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
      <Multiselect
        {...multiselectProps}
        disabled={disabled}
        onBlur={handleBlur}
        onChange={handleChange}
        options={options}
        ref={fieldRef}
        selectedOptions={getMatchingOptions(options, fieldValue)}
      />
    </FormField>
  );
};

export default MultiselectField;
