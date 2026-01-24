// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Box from '@cloudscape-design/components/box';
import Grid from '@cloudscape-design/components/grid';
import { SelectProps } from '@cloudscape-design/components/select';
import { AvatarOptionType } from '@deepracer-indy/config';
import { AvatarConfig } from '@deepracer-indy/typescript-client';
import { Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { UpdatedProfileData } from '../../../constants/avatar.js';
import SelectField from '../../FormFields/SelectField/index.js';

interface AvatarSelectOptionProps {
  avatarOption: AvatarOptionType;
  control: Control<UpdatedProfileData>;
  disabled?: boolean;
  handleAvatarDefaults: (
    avatarOption: AvatarOptionType,
    avatarConfig: AvatarConfig,
    selectedAvatarPiece: string,
    oldAvatarPiece: string,
  ) => void;
  avatarConfig: AvatarConfig;
  oldAvatarPiece: string;
  options: SelectProps.Options;
}

const AvatarSelectOption = ({
  avatarOption,
  control,
  disabled,
  handleAvatarDefaults,
  avatarConfig,
  oldAvatarPiece,
  options,
}: AvatarSelectOptionProps) => {
  const { t } = useTranslation('racerProfile');

  return (
    <Grid disableGutters gridDefinition={[{ colspan: { default: 4, s: 4 } }, { colspan: { default: 8, s: 8 } }]}>
      <Box fontWeight="bold" padding={{ top: 'xxs' }}>
        {t(`profileModal.selectLabels.${avatarOption}`, { defaultValue: '' })}
      </Box>
      <SelectField
        data-testid={avatarOption}
        control={control}
        disabled={disabled}
        name={`avatar.${avatarOption}`}
        options={options}
        placeholder="--"
        onChange={(event) => {
          handleAvatarDefaults(avatarOption, avatarConfig, event.detail.selectedOption.value ?? '', oldAvatarPiece);
        }}
      />
    </Grid>
  );
};

export default AvatarSelectOption;
