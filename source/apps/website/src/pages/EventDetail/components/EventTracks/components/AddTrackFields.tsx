// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SpaceBetween from '@cloudscape-design/components/space-between';
import { useTranslation } from 'react-i18next';

import InputField from '#components/FormFields/InputField/InputField';
import SelectField from '#components/FormFields/SelectField/SelectField';
import { useListFleetsQuery } from '#services/deepRacer/fleetsApi.js';

import { AddTrackFormValues } from './validation.js';

export interface AddTrackFieldsProps {
  control: import('react-hook-form').Control<AddTrackFormValues>;
  /** Called when any field blurs — matches DREM's leaderboardConfigPanel.tsx per-Input onBlur commit. */
  onFieldBlur?: () => void;
}

/**
 * The per-track field set (name, footer, fleet) shared between every place a track
 * gets added — the inline "add track" form on an existing event's Tracks tab, and the
 * queued-track builder in the event creation/edit wizard's Tracks section. Track layout
 * (trackType) is NOT included here — it's a single field on the event's Race
 * configuration section, applied to every track added to that event. Deliberately has
 * no submit button or modal chrome of its own so callers can embed it inline.
 */
const AddTrackFields = ({ control, onFieldBlur }: AddTrackFieldsProps) => {
  const { t } = useTranslation('events');
  // ListFleets (Epic 2) has no handler yet — this selector degrades to "no fleets
  // available" rather than failing the whole form if the request errors.
  const { data: fleets = [] } = useListFleetsQuery({});

  return (
    <SpaceBetween size="m" direction="vertical">
      <InputField
        name="leaderBoardTitle"
        control={control}
        label={t('detail.tracks.addModal.fields.leaderBoardTitle.label')}
        description={t('detail.tracks.addModal.fields.leaderBoardTitle.description')}
        placeholder={t('detail.tracks.addModal.fields.leaderBoardTitle.placeholder')}
        onBlur={onFieldBlur}
        stretch
      />
      <InputField
        name="leaderBoardFooter"
        control={control}
        label={t('detail.tracks.addModal.fields.leaderBoardFooter.label')}
        description={t('detail.tracks.addModal.fields.leaderBoardFooter.description')}
        placeholder={t('detail.tracks.addModal.fields.leaderBoardFooter.placeholder')}
        onBlur={onFieldBlur}
        stretch
      />
      <SelectField
        name="fleetId"
        control={control}
        label={t('detail.tracks.addModal.fields.fleetId.label')}
        description={t('detail.tracks.addModal.fields.fleetId.description')}
        placeholder={t('detail.tracks.addModal.fields.fleetId.placeholder')}
        options={[
          { value: '', label: t('detail.tracks.addModal.fields.fleetId.noFleetOption') },
          ...fleets.map((fleet) => ({ label: fleet.name, value: fleet.fleetId })),
        ]}
        filteringType="auto"
        onBlur={onFieldBlur}
        stretch
      />
    </SpaceBetween>
  );
};

export default AddTrackFields;
