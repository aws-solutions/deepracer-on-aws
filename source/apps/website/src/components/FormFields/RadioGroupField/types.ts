// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { NonCancelableCustomEvent } from '@cloudscape-design/components';
import type { RadioGroupProps } from '@cloudscape-design/components/radio-group';
import type { FieldPathByValue, FieldPathValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export type RadioGroupFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
> = CommonFormFieldProps<FormValues, FieldName> &
  Omit<RadioGroupProps, 'controlId' | 'name' | 'value' | 'onChange' | 'items'> &
  (FieldPathValue<FormValues, FieldName> extends number
    ? {
        /**
         * Called whenever a user changes the input value (by typing or pasting).
         * The event `detail` contains the current value of the field.
         */
        onChange?: (e: NumberChangeEvent) => void;
        /**
         * Specifies the type of control to render.
         */
        type: 'number';
        items: ReadonlyArray<NumberRadioButtonDefinition>;
      }
    : {
        /**
         * Called whenever a user changes the input value (by typing or pasting).
         * The event `detail` contains the current value of the field.
         */
        onChange?: RadioGroupProps['onChange'];
        type?: never;
        items: RadioGroupProps.RadioButtonDefinition[];
      });

export type NumberChangeDetail = { value: number };
export type NumberChangeEvent = NonCancelableCustomEvent<NumberChangeDetail>;
export type NumberRadioButtonDefinition = Omit<RadioGroupProps.RadioButtonDefinition, 'value'> & {
  value: number;
};
