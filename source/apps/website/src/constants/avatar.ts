// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig } from '@deepracer-indy/typescript-client';
import i18n from 'i18next';

export interface UpdatedProfileData {
  alias: string;
  avatar: AvatarConfig;
}

export enum AvatarPiece {
  CLOTHING_BLAZER_SHIRT = 'BlazerShirt',
  CLOTHING_COLOR_BLACK = 'Black',
  CLOTHING_GRAPHIC_SHIRT = 'GraphicShirt',
  COLOR_BROWN = 'Brown',
  DEFAULT = 'Default',
  FACIAL_HAIR_BEARD_MAJESTIC = 'BeardMajestic',
  FACIAL_HAIR_BLANK = 'Blank',
  HAIR_COLOR_AUBURN = 'Auburn',
  TOP_BALD = 'NoHair',
  TOP_HELMET = 'Helmet',
  TOP_HIJAB = 'Hijab',
  TOP_LONG_HAIR_STRAIGHT = 'LongHairStraight',
  TSHIRT_GRAPHIC_PIZZA = 'Pizza',
}

export const AVATAR_OPTIONS = {
  accessories: [
    { label: i18n.t('avatar:accessories.groupNames.noGroup'), options: ['Blank'] },
    {
      label: i18n.t('avatar:accessories.groupNames.prescriptionGlasses'),
      options: ['Prescription02', 'Round', 'Prescription01'],
    },
    {
      label: i18n.t('avatar:accessories.groupNames.sunglasses'),
      options: ['Sunglasses', 'Wayfarers', 'Kurt'],
    },
  ],
  clothing: [
    { label: i18n.t('avatar:clothing.groupNames.noGroup'), options: ['CollarSweater', 'Hoodie', 'Overall'] },
    {
      label: i18n.t('avatar:clothing.groupNames.blazers'),
      options: ['BlazerSweater', 'BlazerShirt'],
    },
    {
      label: i18n.t('avatar:clothing.groupNames.shirts'),
      options: ['ShirtCrewNeck', 'GraphicShirt', 'ShirtScoopNeck', 'ShirtVNeck'],
    },
  ],
  clothingColor: [
    {
      label: i18n.t('avatar:clothingColor.groupNames.blue'),
      options: ['Blue01', 'Blue02', 'Blue03'],
    },
    {
      label: i18n.t('avatar:clothingColor.groupNames.red'),
      options: ['Pink', 'Red'],
    },
    {
      label: i18n.t('avatar:clothingColor.groupNames.pastel'),
      options: ['PastelBlue', 'PastelGreen', 'PastelOrange', 'PastelRed', 'PastelYellow'],
    },
    {
      label: i18n.t('avatar:clothingColor.groupNames.gray'),
      options: ['Gray01', 'Gray02', 'Heather'],
    },
    {
      label: i18n.t('avatar:clothingColor.groupNames.neutral'),
      options: ['Black', 'White'],
    },
  ],
  eyebrows: [
    {
      label: i18n.t('avatar:eyebrows.groupNames.noGroup'),
      options: [
        'Angry',
        'AngryNatural',
        'SadConcerned',
        'SadConcernedNatural',
        'RaisedExcited',
        'RaisedExcitedNatural',
        'DefaultNatural',
        'Default',
        'FlatNatural',
        'UpDown',
        'UpDownNatural',
        'UnibrowNatural',
      ],
    },
  ],
  eyes: [
    {
      label: i18n.t('avatar:eyes.groupNames.noGroup'),
      options: [
        'Close',
        'Cry',
        'EyeRoll',
        'Happy',
        'Hearts',
        'Default',
        'Side',
        'Squint',
        'Surprised',
        'Wink',
        'WinkWacky',
      ],
    },
  ],
  facialHair: [
    {
      label: i18n.t('avatar:facialHair.groupNames.noGroup'),
      options: ['Blank', 'BeardMajestic', 'BeardMedium', 'MoustacheFancy', 'BeardLight', 'MoustacheMagnum'],
    },
  ],
  facialHairColor: [
    { label: i18n.t('avatar:facialHairColor.groupNames.noGroup'), options: ['Red', 'Black'] },
    {
      label: i18n.t('avatar:facialHairColor.groupNames.blond'),
      options: ['BlondeGolden', 'Blonde', 'Platinum'],
    },
    {
      label: i18n.t('avatar:facialHairColor.groupNames.brown'),
      options: ['Auburn', 'Brown', 'BrownDark'],
    },
  ],
  hairColor: [
    { label: i18n.t('avatar:hairColor.groupNames.noGroup'), options: ['Red', 'PastelPink', 'SilverGray', 'Black'] },
    {
      label: i18n.t('avatar:hairColor.groupNames.blond'),
      options: ['BlondeGolden', 'Blonde', 'Platinum'],
    },
    {
      label: i18n.t('avatar:hairColor.groupNames.brown'),
      options: ['Auburn', 'Brown', 'BrownDark'],
    },
  ],
  mouth: [
    {
      label: i18n.t('avatar:mouth.groupNames.noGroup'),
      options: [
        'Concerned',
        'Default',
        'Disbelief',
        'Eating',
        'Grimace',
        'Sad',
        'ScreamOpen',
        'Serious',
        'Smile',
        'Tongue',
        'Twinkle',
      ],
    },
  ],
  skinColor: [
    {
      label: i18n.t('avatar:skinColor.groupNames.noGroup'),
      options: ['Pale', 'Light', 'Brown', 'DarkBrown', 'Black'],
    },
  ],
  top: [
    { label: i18n.t('avatar:top.groupNames.noGroup'), options: ['Helmet'] },
    {
      label: i18n.t('avatar:top.groupNames.hair'),
      options: [
        'LongHairFro',
        'LongHairFroBand',
        'NoHair',
        'ShortHairSides',
        'LongHairBigHair',
        'LongHairBob',
        'LongHairBun',
        'LongHairCurly',
        'LongHairCurvy',
        'LongHairDreads',
        'LongHairNotTooLong',
        'LongHairMiaWallace',
        'LongHairStraight',
        'LongHairStraight2',
        'LongHairStraightStrand',
        'ShortHairDreads01',
        'ShortHairDreads02',
        'ShortHairFrizzle',
        'ShortHairShaggyMullet',
        'ShortHairShortCurly',
        'ShortHairShortFlat',
        'ShortHairShortRound',
        'ShortHairShortWaved',
        'ShortHairTheCaesar',
        'ShortHairTheCaesarSidePart',
      ],
    },
    {
      label: i18n.t('avatar:top.groupNames.headwear'),
      options: ['LongHairFrida', 'Hat', 'Hijab', 'WinterHat2', 'WinterHat3', 'WinterHat4', 'Turban', 'WinterHat1'],
    },
  ],
  tshirtGraphic: [{ label: i18n.t('avatar:tshirtGraphic.groupNames.noGroup'), options: ['Diamond', 'Hola', 'Pizza'] }],
};

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  accessories: '',
  clothing: '',
  clothingColor: '',
  eyes: '',
  eyebrows: '',
  facialHair: '',
  facialHairColor: '',
  hairColor: '',
  mouth: '',
  skinColor: '',
  top: AvatarPiece.TOP_HELMET,
  tshirtGraphic: '',
};
