// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

import RequiresGroups from '#components/RequiresGroups';

const ADMIN_OR_FACILITATOR_GROUPS = [UserGroups.ADMIN, UserGroups.RACE_FACILITATORS];

const RequiresAdminOrFacilitator = () => (
  <RequiresGroups
    groups={ADMIN_OR_FACILITATOR_GROUPS}
    message="This page is only available to administrators and facilitators."
  />
);

export default RequiresAdminOrFacilitator;
