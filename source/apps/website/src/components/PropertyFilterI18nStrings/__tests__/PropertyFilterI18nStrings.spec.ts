// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi } from 'vitest';

import { getPropertyFilterI18nStrings } from '../PropertyFilterI18nStrings';

describe('getPropertyFilterI18nStrings', () => {
  const mockT = vi.fn((key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce((result, [k, v]) => result.replace(`{{${k}}}`, String(v)), key);
    }
    return key;
  });

  const i18nStrings = getPropertyFilterI18nStrings(mockT as never, 'models');

  it('returns filteringAriaLabel with resource name', () => {
    const strings = getPropertyFilterI18nStrings(mockT as never, 'models');
    expect(mockT).toHaveBeenCalledWith('propertyFilter.filteringAriaLabel', { resource: 'models' });
    expect(strings.filteringAriaLabel).toBeDefined();
  });

  it('returns filteringPlaceholder with resource name', () => {
    const strings = getPropertyFilterI18nStrings(mockT as never, 'devices');
    expect(mockT).toHaveBeenCalledWith('propertyFilter.filteringPlaceholder', { resource: 'devices' });
    expect(strings.filteringPlaceholder).toBeDefined();
  });

  it('returns removeTokenButtonAriaLabel as a function that formats token details', () => {
    expect(typeof i18nStrings.removeTokenButtonAriaLabel).toBe('function');

    const token = { propertyKey: 'status', operator: '=', value: 'READY' } as never;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = i18nStrings.removeTokenButtonAriaLabel!(token);

    expect(mockT).toHaveBeenCalledWith('propertyFilter.removeTokenAriaLabel', {
      propertyKey: 'status',
      operator: '=',
      value: 'READY',
    });
    expect(result).toBeDefined();
  });

  it('returns enteredTextLabel as a function that formats entered text', () => {
    expect(typeof i18nStrings.enteredTextLabel).toBe('function');

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = i18nStrings.enteredTextLabel!('search term');

    expect(mockT).toHaveBeenCalledWith('propertyFilter.enteredTextLabel', { text: 'search term' });
    expect(result).toBeDefined();
  });

  it('returns all required static i18n keys', () => {
    expect(i18nStrings.groupValuesText).toBe('propertyFilter.groupValues');
    expect(i18nStrings.groupPropertiesText).toBe('propertyFilter.groupProperties');
    expect(i18nStrings.operatorsText).toBe('propertyFilter.operators');
    expect(i18nStrings.operationAndText).toBe('propertyFilter.operationAnd');
    expect(i18nStrings.operationOrText).toBe('propertyFilter.operationOr');
    expect(i18nStrings.operatorContainsText).toBe('propertyFilter.operatorContains');
    expect(i18nStrings.operatorDoesNotContainText).toBe('propertyFilter.operatorDoesNotContain');
    expect(i18nStrings.operatorEqualsText).toBe('propertyFilter.operatorEquals');
    expect(i18nStrings.operatorDoesNotEqualText).toBe('propertyFilter.operatorDoesNotEqual');
    expect(i18nStrings.editTokenHeader).toBe('propertyFilter.editTokenHeader');
    expect(i18nStrings.propertyText).toBe('propertyFilter.propertyText');
    expect(i18nStrings.operatorText).toBe('propertyFilter.operatorText');
    expect(i18nStrings.valueText).toBe('propertyFilter.valueText');
    expect(i18nStrings.cancelActionText).toBe('propertyFilter.cancelAction');
    expect(i18nStrings.applyActionText).toBe('propertyFilter.applyAction');
    expect(i18nStrings.allPropertiesLabel).toBe('propertyFilter.allProperties');
    expect(i18nStrings.clearFiltersText).toBe('propertyFilter.clearFilters');
    expect(i18nStrings.tokenLimitShowMore).toBe('propertyFilter.tokenLimitShowMore');
    expect(i18nStrings.tokenLimitShowFewer).toBe('propertyFilter.tokenLimitShowFewer');
  });
});
