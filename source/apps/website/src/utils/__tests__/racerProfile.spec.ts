// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { validateAvatarPieces } from '../racerProfile';

const VALID_AVATAR_CONFIG = {
  clothing: '',
  clothingColor: '',
  facialHair: '',
  facialHairColor: '',
  hairColor: '',
  mouth: '',
  skinColor: '',
  top: 'Helmet',
  tshirtGraphic: '',
};

describe('racerProfile utils', () => {
  describe('validateAvatarPieces()', () => {
    it('should return true for valid avatar config', () => {
      expect(validateAvatarPieces(VALID_AVATAR_CONFIG)).toBe(true);
    });

    it('should return false for invalid avatar config', () => {
      expect(validateAvatarPieces({ ...VALID_AVATAR_CONFIG, facialHair: 'brown' })).toBe(false);
    });
  });
});
