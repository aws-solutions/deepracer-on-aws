// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CloudscapeSideNavigation from '@cloudscape-design/components/side-navigation';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { PageId } from '#constants/pages.js';
import { getUserGroups } from '#utils/authUtils.js';
import { getPageBasePath, getPath } from '#utils/pageUtils.js';

import {
  getAdminNavigationItems,
  getDeviceManagementNavigationItems,
  getLearningAndModelsNavigationItems,
  getModelManagementNavigationItems,
  getRaceManagementNavigationItems,
} from './itemsUtils.js';
import { useVersionCheck } from '../../../../hooks/useVersionCheck.js';
import VersionAlert from '../VersionAlert/VersionAlert.js';

const SideNavigation = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'navigation']);

  const [userGroups, setUserGroups] = useState<UserGroups[]>([]);

  useEffect(() => {
    const getUserGroupsFn = async () => {
      const groups = await getUserGroups();
      setUserGroups(groups);
    };

    void getUserGroupsFn();
  }, []);

  const isAdmin = userGroups.includes(UserGroups.ADMIN);

  const { data: versionData } = useVersionCheck({ enabled: isAdmin });

  return (
    <div>
      <CloudscapeSideNavigation
        activeHref={getPageBasePath(pathname)}
        header={{ href: getPath(PageId.HOME), text: t('serviceName', { ns: 'common' }) }}
        onFollow={(e) => {
          e.preventDefault();
          navigate(e.detail.href);
        }}
        items={[
          ...getLearningAndModelsNavigationItems(userGroups, t),
          ...getRaceManagementNavigationItems(userGroups, t),
          ...getDeviceManagementNavigationItems(userGroups, t),
          ...getModelManagementNavigationItems(userGroups, t),
          ...getAdminNavigationItems(userGroups, t),
        ]}
      />
      {isAdmin && (
        <VersionAlert latestVersion={versionData?.latestVersion} isNewestVersion={versionData?.isNewestVersion} />
      )}
    </div>
  );
};

export default SideNavigation;
