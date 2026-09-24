// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { UserGroups } from '@deepracer-indy/typescript-client';

import RequiresGroups from '#components/RequiresGroups';

const ADMIN_GROUPS = [UserGroups.ADMIN];

const RequiresAdmin = () => (
  <RequiresGroups groups={ADMIN_GROUPS} message="This page is only available to administrators." />
);

export default RequiresAdmin;
