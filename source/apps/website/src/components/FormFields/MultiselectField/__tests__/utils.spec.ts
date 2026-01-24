// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { MultiselectProps } from '@cloudscape-design/components/multiselect';

import { getMatchingOptions } from '../utils';

describe('MultiselectField utils', () => {
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
  ] as const satisfies MultiselectProps.Options;

  describe('getMatchingOptions()', () => {
    it('should return matching options', () => {
      expect(getMatchingOptions(TEST_OPTIONS, [TEST_OPTIONS[0].value])).toEqual([TEST_OPTIONS[0]]);
      expect(getMatchingOptions(TEST_OPTIONS, [TEST_OPTIONS[0].value, TEST_OPTIONS[1].value])).toEqual([
        TEST_OPTIONS[0],
        TEST_OPTIONS[1],
      ]);
      expect(
        getMatchingOptions(TEST_OPTIONS, [
          TEST_OPTIONS[0].value,
          TEST_OPTIONS[1].value,
          TEST_OPTIONS[2].options[0].value,
        ]),
      ).toEqual([TEST_OPTIONS[0], TEST_OPTIONS[1], TEST_OPTIONS[2].options[0]]);
    });

    it('should return an empty array if no matching options', () => {
      expect(getMatchingOptions(TEST_OPTIONS, ['non-existing-option-value'])).toEqual([]);
    });
  });
});
