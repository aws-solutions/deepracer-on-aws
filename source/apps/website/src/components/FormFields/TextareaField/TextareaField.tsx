// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import Textarea, { TextareaProps } from '@cloudscape-design/components/textarea';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import type { TextareaFieldProps } from './types';

const TextareaField = <
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
  ...textareaProps
}: TextareaFieldProps<FormValues, FieldName>) => {
  const {
    field: { onBlur: onFieldBlur, onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, disabled, name, shouldUnregister });

  const handleBlur: NonNullable<TextareaProps['onBlur']> = useCallback(
    (event) => {
      onFieldBlur();
      onBlur?.(event);
    },
    [onFieldBlur, onBlur],
  );

  const handleChange: NonNullable<TextareaProps['onChange']> = useCallback(
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
      <Textarea
        {...textareaProps}
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

export default TextareaField;
