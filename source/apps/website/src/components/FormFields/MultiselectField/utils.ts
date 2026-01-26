// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { MultiselectProps } from '@cloudscape-design/components/multiselect';

export const getMatchingOptions = (options?: MultiselectProps.Options, selectedOptionValues: string[] = []) => {
  const selectedOptions: MultiselectProps.Option[] = [];

  if (options?.length && selectedOptionValues.length) {
    for (const option of options) {
      if ('options' in option) {
        for (const nestedOption of option.options) {
          if (selectedOptionValues.find((value) => value === nestedOption.value)) {
            selectedOptions.push(nestedOption);
          }
        }
      } else if (selectedOptionValues.find((value) => value === option.value)) {
        selectedOptions.push(option);
      }
    }
  }

  return selectedOptions;
};
