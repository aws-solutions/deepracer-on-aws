// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { CheckboxProps } from '@cloudscape-design/components/checkbox';
import type { FieldPathByValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export interface CheckboxFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, boolean | undefined>,
> extends CommonFormFieldProps<FormValues, FieldName>,
    Omit<CheckboxProps, 'controlId' | 'checked' | 'name'> {}
