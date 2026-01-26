// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DiscreteActionSpaceItem } from '@deepracer-indy/typescript-client';

export interface IndexedDiscreteActionSpaceItem extends DiscreteActionSpaceItem {
  index: number;
}
