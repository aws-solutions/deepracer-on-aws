// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

import RequiresGroups from '#components/RequiresGroups';

const REGISTRATION_MANAGER_GROUPS = [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS, UserGroups.REGISTRATION_MANAGERS];

const RequiresRegistrationManager = () => (
  <RequiresGroups
    groups={REGISTRATION_MANAGER_GROUPS}
    message="This page is only available to registration managers, facilitators, and administrators."
  />
);

export default RequiresRegistrationManager;
