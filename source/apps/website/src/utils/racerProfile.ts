// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig } from '@deepracer-indy/typescript-client';

import { AVATAR_OPTIONS, AvatarPiece } from '#constants/avatar';

export const validateAvatarPieces = (customAvatar: AvatarConfig) => {
  const helmetCheck =
    customAvatar.top === AvatarPiece.TOP_HELMET &&
    (customAvatar.accessories ||
      customAvatar.clothing ||
      customAvatar.clothingColor ||
      customAvatar.eyebrows ||
      customAvatar.eyes ||
      customAvatar.facialHair ||
      customAvatar.facialHairColor ||
      customAvatar.hairColor ||
      customAvatar.mouth ||
      customAvatar.skinColor ||
      customAvatar.tshirtGraphic);

  const defaultTypesCheck =
    customAvatar.top !== AvatarPiece.TOP_HELMET &&
    (!customAvatar.top ||
      !customAvatar.eyes ||
      !customAvatar.eyebrows ||
      !customAvatar.mouth ||
      !customAvatar.clothing ||
      !customAvatar.skinColor);

  const topColorCheck =
    (customAvatar.top &&
      AVATAR_OPTIONS.top[1].options.includes(customAvatar.top) &&
      customAvatar.top !== AvatarPiece.TOP_BALD &&
      !customAvatar.hairColor) ||
    (customAvatar.top === AvatarPiece.TOP_HIJAB &&
      (customAvatar.hairColor || customAvatar.facialHair || customAvatar.facialHairColor)) ||
    (customAvatar.top &&
      (!AVATAR_OPTIONS.top[1].options.includes(customAvatar.top) || customAvatar.top === AvatarPiece.TOP_BALD) &&
      customAvatar.hairColor);

  const facialHairColorCheck =
    (customAvatar.facialHair && !customAvatar.facialHairColor) ||
    (!customAvatar.facialHair && customAvatar.facialHairColor);

  const clothingColorCheck =
    (customAvatar.clothing &&
      !AVATAR_OPTIONS.clothing[1].options.includes(customAvatar.clothing) &&
      !customAvatar.clothingColor) ||
    (customAvatar.clothing &&
      AVATAR_OPTIONS.clothing[1].options.includes(customAvatar.clothing) &&
      customAvatar.clothingColor);

  const graphicCheck =
    (customAvatar.clothing === AvatarPiece.CLOTHING_GRAPHIC_SHIRT && !customAvatar.tshirtGraphic) ||
    (customAvatar.clothing !== AvatarPiece.CLOTHING_GRAPHIC_SHIRT && customAvatar.tshirtGraphic);

  return !(
    helmetCheck ||
    defaultTypesCheck ||
    topColorCheck ||
    facialHairColorCheck ||
    clothingColorCheck ||
    graphicCheck
  );
};
