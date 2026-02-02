// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TimeInputProps } from '@cloudscape-design/components/time-input';
import type { FieldPathByValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export interface TimeInputFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | undefined>,
>
  extends CommonFormFieldProps<FormValues, FieldName>, Omit<TimeInputProps, 'controlId' | 'name' | 'value'> {}
