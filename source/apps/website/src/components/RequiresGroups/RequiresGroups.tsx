// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { checkUserGroupMembership } from '#utils/authUtils';

interface RequiresGroupsProps {
  /** Cognito groups permitted to view the guarded routes; membership in any one grants access. */
  groups: UserGroups[];
  /** Message shown in the Unauthorized alert when the user belongs to none of the groups. */
  message: string;
}

/**
 * Route guard that renders the child `<Outlet />` only for users in one of `groups`.
 * The per-role guards (RequiresAdmin, RequiresAdminOrFacilitator, RequiresRegistrationManager,
 * RequiresCommentator) are thin wrappers that supply their group set and message.
 */
const RequiresGroups = ({ groups, message }: RequiresGroupsProps) => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setIsAuthorized(await checkUserGroupMembership(groups));
      } catch {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };
    void checkAccess();
  }, [groups]);

  if (isLoading) return <Spinner />;
  if (!isAuthorized)
    return (
      <Alert type="error" header="Unauthorized">
        {message}
      </Alert>
    );
  return <Outlet />;
};

export default RequiresGroups;
