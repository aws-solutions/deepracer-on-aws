// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SelectProps } from '@cloudscape-design/components/select';

import { NumberOptions } from './types';

export const getMatchingOption = (
  options?: SelectProps['options'] | NumberOptions,
  selectedOptionValue: string | number | null = null,
) => {
  if (options?.length && selectedOptionValue !== null) {
    for (const option of options) {
      if ('options' in option) {
        for (const nestedOption of option.options) {
          if (nestedOption.value === selectedOptionValue) {
            return nestedOption as SelectProps.Option;
          }
        }
      } else if (option.value === selectedOptionValue) {
        return option as SelectProps.Option;
      }
    }
  }

  return null;
};
