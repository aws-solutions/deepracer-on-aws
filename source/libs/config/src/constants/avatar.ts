// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export enum AvatarOptionType {
  ACCESSORIES = 'accessories',
  CLOTHING = 'clothing',
  CLOTHING_COLOR = 'clothingColor',
  EYEBROWS = 'eyebrows',
  EYES = 'eyes',
  FACIAL_HAIR_COLOR = 'facialHairColor',
  FACIAL_HAIR = 'facialHair',
  HAIR_COLOR = 'hairColor',
  MOUTH = 'mouth',
  SKIN_COLOR = 'skinColor',
  TOP = 'top',
  TSHIRT_GRAPHIC = 'tshirtGraphic',
}

export const DEFAULT_AVATAR = {
  [AvatarOptionType.TOP]: 'Helmet',
} as const;
