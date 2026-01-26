// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarOptionType } from '@deepracer-indy/config';
import { AvatarConfig } from '@deepracer-indy/typescript-client';
import i18n from 'i18next';

import { AvatarPiece, AVATAR_OPTIONS, DEFAULT_AVATAR_CONFIG } from '#constants/avatar';

export const getAvatarStringMapping = (
  avatarOption: AvatarOptionType,
  avatarPieceGrouping: typeof AVATAR_OPTIONS.accessories,
) => {
  return avatarPieceGrouping.map((grouping) => {
    const pieceNamesMapped = grouping.options.map((option) => {
      return { label: i18n.t(`avatar:${avatarOption}.${option}`, { defaultValue: '' }), value: option };
    });

    return { label: grouping.label === 'NoGroup' ? '' : grouping.label, options: pieceNamesMapped };
  });
};

export const isHairColorVisible = (avatarTop = '') => {
  return (
    avatarTop !== AvatarPiece.TOP_HELMET &&
    avatarTop !== AvatarPiece.TOP_BALD &&
    !AVATAR_OPTIONS.top[2].options.includes(avatarTop)
  );
};

export const isAccessoriesVisible = (avatarTop = '') => {
  return avatarTop !== AvatarPiece.TOP_HELMET;
};

export const isFacialHairVisisble = (avatarTop = '') => {
  return avatarTop !== AvatarPiece.TOP_HELMET && avatarTop !== AvatarPiece.TOP_HIJAB;
};

export const isFacialHairColorVisible = (avatarTop = '', avatarFacialHair = '') => {
  return (
    avatarTop !== AvatarPiece.TOP_HELMET &&
    avatarTop !== AvatarPiece.TOP_HIJAB &&
    avatarFacialHair &&
    avatarFacialHair !== AvatarPiece.FACIAL_HAIR_BLANK
  );
};

export const isClothingColorVisible = (avatarTop = '', avatarClothing = '') => {
  return (
    avatarTop !== AvatarPiece.TOP_HELMET &&
    avatarClothing &&
    !AVATAR_OPTIONS.clothing[1].options.includes(avatarClothing)
  );
};

export const isTshirtGraphicVisible = (avatarTop = '', avatarClothing = '') => {
  return avatarTop !== AvatarPiece.TOP_HELMET && avatarClothing === AvatarPiece.CLOTHING_GRAPHIC_SHIRT;
};

export const setTopDefaults = (avatarConfig: AvatarConfig, newTopOption: string, oldTopOption: string) => {
  let updatedAvatarConfig = { ...DEFAULT_AVATAR_CONFIG, ...avatarConfig };

  const toNotHelmet = oldTopOption === AvatarPiece.TOP_HELMET && newTopOption !== AvatarPiece.TOP_HELMET;
  const toHelmet = newTopOption === AvatarPiece.TOP_HELMET;
  const toHijab = newTopOption === AvatarPiece.TOP_HIJAB;
  const toHair =
    (oldTopOption === AvatarPiece.TOP_BALD || !AVATAR_OPTIONS.top[1].options.includes(oldTopOption)) &&
    newTopOption !== AvatarPiece.TOP_BALD &&
    AVATAR_OPTIONS.top[1].options.includes(newTopOption);
  const toNotHair =
    oldTopOption !== AvatarPiece.TOP_BALD &&
    AVATAR_OPTIONS.top[1].options.includes(oldTopOption) &&
    (newTopOption === AvatarPiece.TOP_BALD || AVATAR_OPTIONS.top[2].options.includes(newTopOption));

  if (toNotHelmet) {
    updatedAvatarConfig.skinColor = AvatarPiece.COLOR_BROWN;
    updatedAvatarConfig.eyes = AvatarPiece.DEFAULT;
    updatedAvatarConfig.eyebrows = AvatarPiece.DEFAULT;
    updatedAvatarConfig.mouth = AvatarPiece.DEFAULT;
    updatedAvatarConfig.clothing = AvatarPiece.CLOTHING_BLAZER_SHIRT;
  }

  if (toHelmet) {
    updatedAvatarConfig = { ...DEFAULT_AVATAR_CONFIG };
  } else if (toHijab) {
    updatedAvatarConfig.hairColor = '';
    updatedAvatarConfig.facialHair = '';
    updatedAvatarConfig.facialHairColor = '';
  } else if (toHair) {
    updatedAvatarConfig.hairColor = AvatarPiece.HAIR_COLOR_AUBURN;
  } else if (toNotHair) {
    updatedAvatarConfig.hairColor = '';
  }

  updatedAvatarConfig.top = newTopOption;

  return updatedAvatarConfig;
};

export const setFacialHairDefaults = (
  avatarConfig: AvatarConfig,
  newFacialHairOption: string,
  oldFacialHairOption: string,
) => {
  const updatedAvatarConfig = { ...DEFAULT_AVATAR_CONFIG, ...avatarConfig };

  const toBlank =
    oldFacialHairOption !== AvatarPiece.FACIAL_HAIR_BLANK && newFacialHairOption === AvatarPiece.FACIAL_HAIR_BLANK;
  const toNotBlank =
    (oldFacialHairOption === AvatarPiece.FACIAL_HAIR_BLANK || oldFacialHairOption === '') &&
    newFacialHairOption !== AvatarPiece.FACIAL_HAIR_BLANK;

  if (toBlank) {
    updatedAvatarConfig.facialHairColor = '';
  } else if (toNotBlank) {
    updatedAvatarConfig.facialHairColor = AvatarPiece.COLOR_BROWN;
  }

  updatedAvatarConfig.facialHair = newFacialHairOption;

  return updatedAvatarConfig;
};

export const setClothingDefaults = (
  avatarConfig: AvatarConfig,
  newClothingOption: string,
  oldClothingOption: string,
) => {
  const updatedAvatarConfig = { ...DEFAULT_AVATAR_CONFIG, ...avatarConfig };

  const toGraphicTshirt =
    oldClothingOption !== AvatarPiece.CLOTHING_GRAPHIC_SHIRT &&
    newClothingOption === AvatarPiece.CLOTHING_GRAPHIC_SHIRT;
  const toNotGraphicTshirt =
    oldClothingOption === AvatarPiece.CLOTHING_GRAPHIC_SHIRT &&
    newClothingOption !== AvatarPiece.CLOTHING_GRAPHIC_SHIRT;
  const toColoredClothing =
    // also covers old clothing being not set
    !AVATAR_OPTIONS.clothing[1].options.includes(newClothingOption) &&
    (AVATAR_OPTIONS.clothing[1].options.includes(oldClothingOption) || oldClothingOption === '');
  const toNotColoredClothing =
    AVATAR_OPTIONS.clothing[1].options.includes(newClothingOption) &&
    !AVATAR_OPTIONS.clothing[1].options.includes(oldClothingOption);

  if (toGraphicTshirt) {
    updatedAvatarConfig.tshirtGraphic = AvatarPiece.TSHIRT_GRAPHIC_PIZZA;
  } else if (toNotGraphicTshirt) {
    updatedAvatarConfig.tshirtGraphic = '';
  }

  if (toColoredClothing) {
    updatedAvatarConfig.clothingColor = AvatarPiece.CLOTHING_COLOR_BLACK;
  } else if (toNotColoredClothing) {
    updatedAvatarConfig.clothingColor = '';
  }

  updatedAvatarConfig.clothing = newClothingOption;

  return updatedAvatarConfig;
};
