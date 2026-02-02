// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DatePickerProps } from '@cloudscape-design/components/date-picker';
import type { FieldPathByValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export interface DatePickerFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | undefined>,
>
  extends CommonFormFieldProps<FormValues, FieldName>, Omit<DatePickerProps, 'controlId' | 'name' | 'value'> {}
