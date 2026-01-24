// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { NonCancelableCustomEvent } from '@cloudscape-design/components/interfaces';
import type { SelectProps } from '@cloudscape-design/components/select';
import type { FieldPathByValue, FieldPathValue, FieldValues } from 'react-hook-form';

import type { CommonFormFieldProps } from '#components/FormFields/types';

export type SelectFieldProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
> = CommonFormFieldProps<FormValues, FieldName> &
  Omit<SelectProps, 'controlId' | 'name' | 'onChange' | 'options' | 'selectedOption'> &
  (FieldPathValue<FormValues, FieldName> extends number
    ? {
        /**
         * Called when the user selects an option.
         * The event `detail` contains the current `selectedOption`.
         */
        onChange?: (e: NonCancelableCustomEvent<NumberOptionChangeDetail>) => void;
        /**
         * Specifies whether the value of the select option is a number instead of a string.
         */
        type: 'number';
        options: NonNullable<NumberOptions>;
      }
    : {
        /**
         * Called whenever a user changes the input value (by typing or pasting).
         * The event `detail` contains the current value of the field.
         */
        onChange?: SelectProps['onChange'];
        type?: never;
        options: NonNullable<SelectProps['options']>;
      });

export type NumberOptionChangeDetail = {
  selectedOption: Omit<SelectProps.Option, 'value'> & {
    value: number;
  };
};
export type NumberOption = Omit<SelectProps.Option, 'value'> & {
  value: number;
};

export type NumberOptionGroup = Omit<SelectProps.OptionGroup, 'options'> & {
  options: ReadonlyArray<NumberOption>;
};

export type NumberOptions = ReadonlyArray<NumberOption | NumberOptionGroup>;
