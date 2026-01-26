// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import SpaceBetween from '@cloudscape-design/components/space-between';
import { AvatarOptionType } from '@deepracer-indy/config';
import { AvatarConfig } from '@deepracer-indy/typescript-client';
import { Control } from 'react-hook-form';

import { AvatarPiece, AVATAR_OPTIONS, UpdatedProfileData } from '../../../constants/avatar.js';
import {
  getAvatarStringMapping,
  isHairColorVisible,
  isAccessoriesVisible,
  isFacialHairVisisble,
  isFacialHairColorVisible,
  isClothingColorVisible,
  isTshirtGraphicVisible,
} from '../../../utils/avatarUtils.js';
import AvatarSelectOption from '../AvatarSelectOption/index.js';

const AvatarAllOptions = ({
  control,
  handleAvatarDefaults,
  avatarConfig,
}: {
  control: Control<UpdatedProfileData>;
  handleAvatarDefaults: (
    avatarOption: AvatarOptionType,
    avatarConfig: AvatarConfig,
    selectedAvatarPiece: string,
    oldAvatarPiece: string,
  ) => void;
  avatarConfig: AvatarConfig;
}) => {
  return (
    <SpaceBetween direction="vertical" size="xs">
      <AvatarSelectOption
        avatarOption={AvatarOptionType.SKIN_COLOR}
        control={control}
        disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
        handleAvatarDefaults={handleAvatarDefaults}
        avatarConfig={avatarConfig}
        oldAvatarPiece={avatarConfig.skinColor ?? ''}
        options={getAvatarStringMapping(AvatarOptionType.SKIN_COLOR, AVATAR_OPTIONS.skinColor)}
      />
      <AvatarSelectOption
        avatarOption={AvatarOptionType.TOP}
        control={control}
        handleAvatarDefaults={handleAvatarDefaults}
        avatarConfig={avatarConfig}
        oldAvatarPiece={avatarConfig.top ?? ''}
        options={getAvatarStringMapping(AvatarOptionType.TOP, AVATAR_OPTIONS.top)}
      />
      {isHairColorVisible(avatarConfig.top) && (
        <AvatarSelectOption
          avatarOption={AvatarOptionType.HAIR_COLOR}
          control={control}
          disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
          handleAvatarDefaults={handleAvatarDefaults}
          avatarConfig={avatarConfig}
          oldAvatarPiece={avatarConfig.hairColor ?? ''}
          options={getAvatarStringMapping(AvatarOptionType.HAIR_COLOR, AVATAR_OPTIONS.hairColor)}
        />
      )}
      {isAccessoriesVisible(avatarConfig.top) && (
        <AvatarSelectOption
          avatarOption={AvatarOptionType.ACCESSORIES}
          control={control}
          disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
          handleAvatarDefaults={handleAvatarDefaults}
          avatarConfig={avatarConfig}
          oldAvatarPiece={avatarConfig.accessories ?? ''}
          options={getAvatarStringMapping(AvatarOptionType.ACCESSORIES, AVATAR_OPTIONS.accessories)}
        />
      )}
      {isFacialHairVisisble(avatarConfig.top) && (
        <AvatarSelectOption
          avatarOption={AvatarOptionType.FACIAL_HAIR}
          control={control}
          disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
          handleAvatarDefaults={handleAvatarDefaults}
          avatarConfig={avatarConfig}
          oldAvatarPiece={avatarConfig.facialHair ?? ''}
          options={getAvatarStringMapping(AvatarOptionType.FACIAL_HAIR, AVATAR_OPTIONS.facialHair)}
        />
      )}
      {isFacialHairColorVisible(avatarConfig.top, avatarConfig.facialHair) && (
        <AvatarSelectOption
          avatarOption={AvatarOptionType.FACIAL_HAIR_COLOR}
          control={control}
          disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
          handleAvatarDefaults={handleAvatarDefaults}
          avatarConfig={avatarConfig}
          oldAvatarPiece={avatarConfig.facialHairColor ?? ''}
          options={getAvatarStringMapping(AvatarOptionType.FACIAL_HAIR_COLOR, AVATAR_OPTIONS.facialHairColor)}
        />
      )}
      <AvatarSelectOption
        avatarOption={AvatarOptionType.EYES}
        control={control}
        disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
        handleAvatarDefaults={handleAvatarDefaults}
        avatarConfig={avatarConfig}
        oldAvatarPiece={avatarConfig.eyes ?? ''}
        options={getAvatarStringMapping(AvatarOptionType.EYES, AVATAR_OPTIONS.eyes)}
      />
      <AvatarSelectOption
        avatarOption={AvatarOptionType.EYEBROWS}
        control={control}
        disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
        handleAvatarDefaults={handleAvatarDefaults}
        avatarConfig={avatarConfig}
        oldAvatarPiece={avatarConfig.eyebrows ?? ''}
        options={getAvatarStringMapping(AvatarOptionType.EYEBROWS, AVATAR_OPTIONS.eyebrows)}
      />
      <AvatarSelectOption
        avatarOption={AvatarOptionType.MOUTH}
        control={control}
        disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
        handleAvatarDefaults={handleAvatarDefaults}
        avatarConfig={avatarConfig}
        oldAvatarPiece={avatarConfig.mouth ?? ''}
        options={getAvatarStringMapping(AvatarOptionType.MOUTH, AVATAR_OPTIONS.mouth)}
      />
      <AvatarSelectOption
        avatarOption={AvatarOptionType.CLOTHING}
        control={control}
        disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
        handleAvatarDefaults={handleAvatarDefaults}
        avatarConfig={avatarConfig}
        oldAvatarPiece={avatarConfig.clothing ?? ''}
        options={getAvatarStringMapping(AvatarOptionType.CLOTHING, AVATAR_OPTIONS.clothing)}
      />
      {isClothingColorVisible(avatarConfig.top, avatarConfig.clothing) && (
        <AvatarSelectOption
          avatarOption={AvatarOptionType.CLOTHING_COLOR}
          control={control}
          disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
          handleAvatarDefaults={handleAvatarDefaults}
          avatarConfig={avatarConfig}
          oldAvatarPiece={avatarConfig.clothingColor ?? ''}
          options={getAvatarStringMapping(AvatarOptionType.CLOTHING_COLOR, AVATAR_OPTIONS.clothingColor)}
        />
      )}
      {isTshirtGraphicVisible(avatarConfig.top, avatarConfig.clothing) && (
        <AvatarSelectOption
          avatarOption={AvatarOptionType.TSHIRT_GRAPHIC}
          control={control}
          disabled={avatarConfig.top === AvatarPiece.TOP_HELMET}
          handleAvatarDefaults={handleAvatarDefaults}
          avatarConfig={avatarConfig}
          oldAvatarPiece={avatarConfig.tshirtGraphic ?? ''}
          options={getAvatarStringMapping(AvatarOptionType.TSHIRT_GRAPHIC, AVATAR_OPTIONS.tshirtGraphic)}
        />
      )}
    </SpaceBetween>
  );
};

export default AvatarAllOptions;
