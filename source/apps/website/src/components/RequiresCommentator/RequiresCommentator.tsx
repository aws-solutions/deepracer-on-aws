// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

import RequiresGroups from '#components/RequiresGroups';

const COMMENTATOR_GROUPS = [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.COMMENTATORS];

const RequiresCommentator = () => (
  <RequiresGroups
    groups={COMMENTATOR_GROUPS}
    message="This page is only available to commentators, facilitators, and administrators."
  />
);

export default RequiresCommentator;
