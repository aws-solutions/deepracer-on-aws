// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SelectProps } from '@cloudscape-design/components/select';

import { getMatchingOption } from '../utils';

describe('SelectField utils', () => {
  const TEST_OPTIONS = [
    {
      value: '1',
      label: 'Option 1',
    },
    {
      value: '2',
      label: 'Option 2',
    },
    {
      label: 'Group 1',
      options: [
        {
          value: '3',
          label: 'Option 3',
        },
        {
          value: '4',
          label: 'Option 4',
        },
      ],
    },
  ] as const satisfies SelectProps.Options;

  describe('getMatchingOption()', () => {
    it('should return matching option', () => {
      expect(getMatchingOption(TEST_OPTIONS, TEST_OPTIONS[0].value)).toEqual(TEST_OPTIONS[0]);
      expect(getMatchingOption(TEST_OPTIONS, TEST_OPTIONS[1].value)).toEqual(TEST_OPTIONS[1]);
      expect(getMatchingOption(TEST_OPTIONS, TEST_OPTIONS[2].options[0].value)).toEqual(TEST_OPTIONS[2].options[0]);
      expect(getMatchingOption(TEST_OPTIONS, TEST_OPTIONS[2].options[1].value)).toEqual(TEST_OPTIONS[2].options[1]);
    });

    it('should return null if no matching option', () => {
      expect(getMatchingOption(TEST_OPTIONS, 'non-existing-option-value')).toBeNull();
    });
  });
});
