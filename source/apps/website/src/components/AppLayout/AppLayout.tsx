// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CloudscapeAppLayout from '@cloudscape-design/components/app-layout';
import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import Breadcrumbs from './components/Breadcrumbs/index.js';
import SideNavigation from './components/SideNavigation/index.js';
import TopNavigation from './components/TopNavigation/index.js';
import { AUTH_PAGE_IDS, PageId } from '../../constants/pages.js';
import { AUTH_PAGE_MAX_CONTENT_WIDTH } from '../../constants/styles.js';
import { useAppDispatch } from '../../hooks/useAppDispatch.js';
import { clearAllNotifications } from '../../store/notifications/notificationsSlice.js';
import { getPageDetailsByPathname } from '../../utils/pageUtils.js';
import Notifications from '../Notifications/index.js';

const getMaxContentWidth = (isAuthPage: boolean, isLiveRace: boolean): number | undefined => {
  if (isAuthPage) return AUTH_PAGE_MAX_CONTENT_WIDTH;
  if (isLiveRace) return Number.MAX_SAFE_INTEGER;
  return undefined;
};

const AppLayout = () => {
  const { pathname, search } = useLocation();
  const dispatch = useAppDispatch();

  const currentPageDetails = getPageDetailsByPathname(pathname);
  const isCurrentPageAuth = !!currentPageDetails && AUTH_PAGE_IDS.includes(currentPageDetails.pageId);
  const isLiveRacePage = currentPageDetails?.pageId === PageId.LIVE_RACE;
  const isBroadcastMode = new URLSearchParams(search).get('mode') === 'broadcast';

  useEffect(() => {
    dispatch(clearAllNotifications());
  }, [dispatch, pathname]);

  // Broadcast mode: render content without any app chrome
  if (isBroadcastMode) {
    return <Outlet />;
  }

  return (
    <>
      <TopNavigation />
      <CloudscapeAppLayout
        content={<Outlet />}
        contentType={currentPageDetails?.contentType}
        breadcrumbs={<Breadcrumbs />}
        maxContentWidth={getMaxContentWidth(isCurrentPageAuth, isLiveRacePage)}
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
