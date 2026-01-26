// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import FormField from '@cloudscape-design/components/form-field';
import TagEditor, { TagEditorProps } from '@cloudscape-design/components/tag-editor';
import { useCallback } from 'react';
import { FieldPath, FieldValues, useController } from 'react-hook-form';

import type { TagEditorFieldProps } from './types';

const TagEditorField = <FormValues extends FieldValues, FieldName extends FieldPath<FormValues>>({
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
  ...tagEditorProps
}: TagEditorFieldProps<FormValues, FieldName>) => {
  const {
    field: { onChange: onFieldChange, ref: fieldRef, value: fieldValue },
    fieldState: { error: fieldError },
  } = useController({ control, name, shouldUnregister });

  const handleChange: NonNullable<TagEditorProps['onChange']> = useCallback(
    (event) => {
      onFieldChange(event.detail.tags);
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
      <TagEditor {...tagEditorProps} onChange={handleChange} ref={fieldRef} tags={fieldValue} />
    </FormField>
  );
};

export default TagEditorField;
