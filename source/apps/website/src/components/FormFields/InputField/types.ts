// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { NonCancelableCustomEvent } from '@cloudscape-design/components';
import type { InputProps } from '@cloudscape-design/components/input';
import type { FieldPathByValue, FieldPathValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export type InputFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
> = CommonFormFieldProps<FormValues, FieldName> &
  Omit<InputProps, 'controlId' | 'name' | 'value' | 'type' | 'onChange'> &
  (FieldPathValue<FormValues, FieldName> extends string
    ? {
        /**
         * Called whenever a user changes the input value (by typing or pasting).
         * The event `detail` contains the current value of the field.
         */
        onChange?: InputProps['onChange'];
        /**
         * Specifies the type of control to render.
         * Inputs with a `number` type use the native element behavior, which might
         * be slightly different across browsers.
         */
        type?: Exclude<InputProps['type'], 'number'>;
      }
    : {
        /**
         * Called whenever a user changes the input value (by typing or pasting).
         * The event `detail` contains the current value of the field.
         */
        onChange?: (e: NumberChangeEvent) => void;
        /**
         * Specifies the type of control to render.
         * Inputs with a `number` type use the native element behavior, which might
         * be slightly different across browsers. Use 'text' to remove +/- selectors
         * while maintaining numeric validation.
         */
        type: 'number' | 'text';
      });

export type NumberChangeDetail = { value: number };
export type NumberChangeEvent = NonCancelableCustomEvent<NumberChangeDetail>;
