// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AvatarConfig } from '@deepracer-indy/typescript-client';
import Avatar from 'avataaars';

import defaultAvatar from '../../../assets/images/defaultAvatar.svg';
import { AvatarPiece } from '../../../constants/avatar.js';

const AvatarDisplay = ({ avatarConfig, displaySize = 150 }: { avatarConfig?: AvatarConfig; displaySize?: number }) => {
  const displaySizeString = String(displaySize) + 'px';

  return !avatarConfig?.top || avatarConfig.top === AvatarPiece.TOP_HELMET ? (
    <img alt="avatar" src={defaultAvatar} style={{ height: displaySizeString, width: displaySizeString }} />
  ) : (
    <Avatar
      style={{ width: displaySizeString, height: displaySizeString }}
      avatarStyle="Circle"
      topType={avatarConfig?.top}
      accessoriesType={avatarConfig?.accessories}
      hairColor={avatarConfig?.hairColor}
      facialHairType={avatarConfig?.facialHair}
      facialHairColor={avatarConfig?.facialHairColor}
      clotheType={avatarConfig?.clothing}
      clotheColor={avatarConfig?.clothingColor}
      graphicType={avatarConfig?.tshirtGraphic}
      eyeType={avatarConfig?.eyes}
      eyebrowType={avatarConfig?.eyebrows}
      mouthType={avatarConfig?.mouth}
      skinColor={avatarConfig?.skinColor}
    />
  );
};

export default AvatarDisplay;
