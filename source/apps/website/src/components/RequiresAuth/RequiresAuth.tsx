// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import Spinner from '@cloudscape-design/components/spinner';
import { getCurrentUser } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { getPath } from '#utils/pageUtils.js';

const RequiresAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    getCurrentUser()
      .then(() => setIsLoading(false))
      .catch(() => {
        navigate(getPath(PageId.SIGN_IN), {
          state: {
            redirectUrl: location.pathname,
          },
        });
      });
  }, [navigate, location.pathname]);
  if (isLoading) {
    return <Spinner />;
  }
  return <Outlet />;
};

export default RequiresAuth;
