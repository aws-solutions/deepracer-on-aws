// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CloudscapeAppLayout from '@cloudscape-design/components/app-layout';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Breadcrumbs from './components/Breadcrumbs/index.js';
import SideNavigation from './components/SideNavigation/index.js';
import TopNavigation from './components/TopNavigation/index.js';
import { AUTH_PAGE_IDS } from '../../constants/pages.js';
import { AUTH_PAGE_MAX_CONTENT_WIDTH } from '../../constants/styles.js';
import { useAppDispatch } from '../../hooks/useAppDispatch.js';
import { clearAllNotifications } from '../../store/notifications/notificationsSlice.js';
import { getPageDetailsByPathname } from '../../utils/pageUtils.js';
import Notifications from '../Notifications/index.js';

const AppLayout = () => {
  const { pathname } = useLocation();
  const dispatch = useAppDispatch();

  const currentPageDetails = getPageDetailsByPathname(pathname);
  const isCurrentPageAuth = !!currentPageDetails && AUTH_PAGE_IDS.includes(currentPageDetails.pageId);

  useEffect(() => {
    dispatch(clearAllNotifications());
  }, [dispatch, pathname]);

  return (
    <>
      <TopNavigation />
      <CloudscapeAppLayout
        content={<Outlet />}
        contentType={currentPageDetails?.contentType}
        breadcrumbs={<Breadcrumbs />}
        maxContentWidth={isCurrentPageAuth ? AUTH_PAGE_MAX_CONTENT_WIDTH : undefined}
        headerSelector="#top-navigation"
        navigationHide={isCurrentPageAuth}
        toolsHide
        navigation={<SideNavigation />}
        notifications={<Notifications />}
      />
    </>
  );
};

export default AppLayout;
