// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import CloudscapeSideNavigation, { SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { checkUserGroupMembership } from '#utils/authUtils.js';

import { PageId } from '../../../../constants/pages.js';
import { getPageBasePath, getPath } from '../../../../utils/pageUtils.js';

const SideNavigation = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'navigation']);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsAdmin(await checkUserGroupMembership([UserGroups.ADMIN]));
    };

    void checkAdminStatus();
  }, []);

  const baseNavigationItems: SideNavigationProps.Item[] = [
    {
      type: 'section',
      text: t('sections.raceHub', { ns: 'navigation' }),
      items: [
        {
          type: 'link',
          text: t(`breadcrumbs.${PageId.RACES}`, { ns: 'navigation' }),
          href: getPath(PageId.RACES),
        },
      ],
    },
    {
      type: 'section',
      text: t('sections.learningAndModels', { ns: 'navigation' }),
      items: [
        {
          type: 'link',
          text: t(`breadcrumbs.${PageId.GET_STARTED}`, { ns: 'navigation' }),
          href: getPath(PageId.GET_STARTED),
        },
        {
          type: 'link',
          text: t(`breadcrumbs.${PageId.MODELS}`, { ns: 'navigation' }),
          href: getPath(PageId.MODELS),
        },
      ],
    },
  ];

  const adminNavigationItem: SideNavigationProps.Item = {
    type: 'section',
    text: t('sections.admin', { ns: 'navigation' }),
    items: [
      {
        type: 'link',
        text: t(`breadcrumbs.${PageId.MANAGE_INSTANCE}`, { ns: 'navigation' }),
        href: getPath(PageId.MANAGE_INSTANCE),
      },
    ],
  };

  return (
    <CloudscapeSideNavigation
      activeHref={getPageBasePath(pathname)}
      header={{ href: getPath(PageId.HOME), text: t('serviceName', { ns: 'common' }) }}
      onFollow={(e) => {
        e.preventDefault();
        navigate(e.detail.href);
      }}
      items={[...baseNavigationItems, ...(isAdmin ? [adminNavigationItem] : [])]}
    />
  );
};

export default SideNavigation;
