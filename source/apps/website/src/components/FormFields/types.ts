// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { FormFieldProps } from '@cloudscape-design/components/form-field';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';

export interface CommonFormFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPath<FormValues>,
> extends Omit<FormFieldProps, 'children' | 'controlId' | 'errorText' | 'i18nStrings'> {
  /**
   * The control for the field.
   *
   * Provided by `useForm` hook or `useFormContext` hook from `react-hook-form` library.
   */
  control: Control<FormValues>;
  /**
   * Specifies the name of the control used in HTML forms.
   *
   * Required for `react-hook-form` to properly manage field state.
   */
  name: FieldName;
  /**
   * Whether the field should be unregistered and defaultValues removed after unmount.
   *
   * @default false
   */
  shouldUnregister?: boolean;
}
