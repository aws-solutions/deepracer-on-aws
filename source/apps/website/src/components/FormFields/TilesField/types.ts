// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TilesProps } from '@cloudscape-design/components/tiles';
import type { FieldPathByValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export interface TilesFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | undefined>,
> extends CommonFormFieldProps<FormValues, FieldName>,
    Omit<TilesProps, 'controlId' | 'name' | 'value'> {}
