// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { SelectProps } from '@cloudscape-design/components/select';
import type { FieldPathByValue, FieldValues } from 'react-hook-form';

import SelectField from '#components/FormFields/SelectField';
import type { CommonFormFieldProps } from '#components/FormFields/types';
import { TRACKS } from '#constants/tracks.js';

/**
 * All ~60 specific DeepRacer tracks as Select options, keyed by trackId — the same
 * TRACKS list used by the Live/Community race card-grid picker (TrackSelection), just
 * presented as a plain dropdown here to mirror DREM's raceConfigPanel.tsx Select
 * (GetTrackOptionFromId/TrackTypeConfig), rather than DREM's coarser ~8-option list.
 */
const TRACK_TYPE_OPTIONS: SelectProps.Options = TRACKS.map((track) => ({
  value: track.trackId,
  label: track.name,
}));

/**
 * Track layout is always a string field, so this only exposes the plain-string Select
 * shape (mirrors CountrySelector's own narrowing of SelectField's generic props).
 */
export type TrackTypeDropdownProps<
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
> = CommonFormFieldProps<FormValues, FieldName> &
  Omit<SelectProps, 'controlId' | 'name' | 'onChange' | 'options' | 'selectedOption'>;

// See CountrySelector for why this cast is needed: SelectField's prop type is generic over
// a FieldName/options-shape conditional that TypeScript can't resolve while FormValues/FieldName
// remain type parameters — this component always supplies the plain-string-options branch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const UntypedSelectField = SelectField as React.ComponentType<any>;

const TrackTypeDropdown = <
  FormValues extends FieldValues,
  FieldName extends FieldPathByValue<FormValues, string | number | undefined>,
>(
  props: TrackTypeDropdownProps<FormValues, FieldName>,
) => <UntypedSelectField {...props} options={TRACK_TYPE_OPTIONS} filteringType="auto" />;

export default TrackTypeDropdown;
