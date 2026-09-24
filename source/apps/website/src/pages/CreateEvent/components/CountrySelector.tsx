// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import { SelectProps } from '@cloudscape-design/components/select';
import { getNames, registerLocale } from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';
import { useMemo } from 'react';
import { FieldPathByValue, FieldValues } from 'react-hook-form';

import SelectField from '#components/FormFields/SelectField';
import type { CommonFormFieldProps } from '#components/FormFields/types';
import { countryCodeToFlagEmoji } from '#utils/flagUtil.js';

registerLocale(enLocale);

/**
 * All ISO 3166-1 official English country names as Select options, keyed by their
 * two-letter code. Mirrors DREM's `generalInfoPanel.tsx`/`countrySelector.tsx`
 * (`getNames('en', { select: 'official' })`).
 */
const COUNTRY_OPTIONS: SelectProps.Options = Object.entries(getNames('en', { select: 'official' })).map(
  ([code, name]) => ({ value: code, label: name }),
);

/**
 * A country code is always a string field, so this only exposes the plain-string Select
 * shape (no `type`/number-options branch — see SelectField's own types for that variant).
 */
export type CountrySelectorProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
> = CommonFormFieldProps<FormValues, FieldName> &
  Omit<SelectProps, 'controlId' | 'name' | 'onChange' | 'options' | 'selectedOption'> & {
    /** Current selected country code (two-letter ISO 3166-1 alpha-2), used to render the flag. */
    countryCode?: string;
  };

/**
 * SelectField's declared prop type is generic over a FieldName/options-shape conditional
 * (string options vs. number options) that TypeScript cannot resolve while FormValues/FieldName
 * remain type parameters rather than concrete types — which is exactly CountrySelector's
 * situation, since it forwards its own generics through untouched. This component always
 * supplies the plain-string-options branch by construction (COUNTRY_OPTIONS, no `type` prop),
 * so the mismatch is a limitation of expressing that generically, not an actual type-safety gap.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UntypedSelectField = SelectField as React.ComponentType<any>;

/**
 * Country code Select paired with the selected country's flag emoji, matching DREM's
 * `generalInfoPanel.tsx` (Select + Flag laid out via Cloudscape's Grid, here via
 * FormField's `secondaryControl`).
 */
const CountrySelector = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
>({
  countryCode,
  ...selectFieldProps
}: CountrySelectorProps<FormValues, FieldName>) => {
  const flag = useMemo(() => (countryCode ? countryCodeToFlagEmoji(countryCode) : undefined), [countryCode]);

  return (
    <UntypedSelectField
      {...selectFieldProps}
      options={COUNTRY_OPTIONS}
      filteringType="auto"
      secondaryControl={
        flag && (
          <Box textAlign="center" fontSize="display-l" data-testid="country-flag">
            {flag}
          </Box>
        )
      }
    />
  );
};

export default CountrySelector;
