// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

export const roleOptions = [
  { label: 'Racer', value: UserGroups.RACERS },
  { label: 'Race facilitator', value: UserGroups.RACE_FACILITATORS },
  { label: 'Admin', value: UserGroups.ADMIN },
];
