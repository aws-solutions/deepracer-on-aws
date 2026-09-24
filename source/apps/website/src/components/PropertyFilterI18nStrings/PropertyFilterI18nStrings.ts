// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { PropertyFilterProps } from '@cloudscape-design/components';
import { TFunction } from 'i18next';

/**
 * Generates i18n strings for the Cloudscape PropertyFilter component.
 * Reusable across any page that uses PropertyFilter (AdminModels, Devices, etc.).
 *
 * @param t - The translation function from `useTranslation`, scoped to `common` namespace
 * @param resourceName - Human-readable name of the filtered resource (e.g. "models", "devices")
 */
export const getPropertyFilterI18nStrings = (
  t: TFunction<'common'>,
  resourceName: string,
): PropertyFilterProps.I18nStrings => ({
  filteringAriaLabel: t('propertyFilter.filteringAriaLabel', { resource: resourceName }),
  filteringPlaceholder: t('propertyFilter.filteringPlaceholder', { resource: resourceName }),
  groupValuesText: t('propertyFilter.groupValues'),
  groupPropertiesText: t('propertyFilter.groupProperties'),
  operatorsText: t('propertyFilter.operators'),
  operationAndText: t('propertyFilter.operationAnd'),
  operationOrText: t('propertyFilter.operationOr'),
  operatorLessText: t('propertyFilter.operatorLess'),
  operatorLessOrEqualText: t('propertyFilter.operatorLessOrEqual'),
  operatorGreaterText: t('propertyFilter.operatorGreater'),
  operatorGreaterOrEqualText: t('propertyFilter.operatorGreaterOrEqual'),
  operatorContainsText: t('propertyFilter.operatorContains'),
  operatorDoesNotContainText: t('propertyFilter.operatorDoesNotContain'),
  operatorEqualsText: t('propertyFilter.operatorEquals'),
  operatorDoesNotEqualText: t('propertyFilter.operatorDoesNotEqual'),
  editTokenHeader: t('propertyFilter.editTokenHeader'),
  propertyText: t('propertyFilter.propertyText'),
  operatorText: t('propertyFilter.operatorText'),
  valueText: t('propertyFilter.valueText'),
  cancelActionText: t('propertyFilter.cancelAction'),
  applyActionText: t('propertyFilter.applyAction'),
  allPropertiesLabel: t('propertyFilter.allProperties'),
  clearFiltersText: t('propertyFilter.clearFilters'),
  tokenLimitShowMore: t('propertyFilter.tokenLimitShowMore'),
  tokenLimitShowFewer: t('propertyFilter.tokenLimitShowFewer'),
  removeTokenButtonAriaLabel: (token) =>
    t('propertyFilter.removeTokenAriaLabel', {
      propertyKey: token.propertyKey,
      operator: token.operator,
      value: token.value,
    }),
  enteredTextLabel: (text) => t('propertyFilter.enteredTextLabel', { text }),
});
