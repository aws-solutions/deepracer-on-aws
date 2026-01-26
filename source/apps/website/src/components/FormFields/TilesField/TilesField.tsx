// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import Tiles, { TilesProps } from '@cloudscape-design/components/tiles';
import { useCallback } from 'react';
import { FieldPathByValue, FieldValues, useController } from 'react-hook-form';

import type { TilesFieldProps } from './types';

const TilesField = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | undefined>,
>({
  constraintText,
  control,
  description,
  info,
  label,
  name,
  onChange,
  secondaryControl,
  shouldUnregister,
  stretch,
  ...tilesProps
}: TilesFieldProps<FormValues, FieldName>) => {
  const {
    field: { onChange: onFieldChange, name: fieldName, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, name, shouldUnregister });

  const handleChange: NonNullable<TilesProps['onChange']> = useCallback(
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
      <Tiles {...tilesProps} onChange={handleChange} name={fieldName} ref={fieldRef} value={fieldValue} />
    </FormField>
  );
};

export default TilesField;
