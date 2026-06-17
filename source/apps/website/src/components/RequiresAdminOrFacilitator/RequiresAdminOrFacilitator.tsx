// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';

import { checkUserGroupMembership } from '#utils/authUtils';

const RequiresAdminOrFacilitator = () => {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        setIsAuthorized(await checkUserGroupMembership([UserGroups.ADMIN, UserGroups.RACE_FACILITATORS]));
      } catch {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    };
    void checkAccess();
  }, []);

  if (isLoading) return <Spinner />;
  if (!isAuthorized)
    return (
      <Alert type="error" header="Unauthorized">
        This page is only available to administrators and facilitators.
      </Alert>
    );
  return <Outlet />;
};

export default RequiresAdminOrFacilitator;
