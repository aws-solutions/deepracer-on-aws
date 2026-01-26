// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ObjectPosition } from '@deepracer-indy/typescript-client';

export const validateObjectPositions = (objectPositions: ObjectPosition[], currentIndex: number) => {
  let isValid = true;
  objectPositions?.forEach((_, index) => {
    if (index === currentIndex) return;
    if (Math.abs(objectPositions[index].trackPercentage - objectPositions[currentIndex].trackPercentage) < 0.13)
      isValid = false;
  });
  return isValid;
};
