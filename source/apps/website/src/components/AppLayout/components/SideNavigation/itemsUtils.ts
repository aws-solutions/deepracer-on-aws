// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { SideNavigationProps } from '@cloudscape-design/components';
import { UserGroups } from '@deepracer-indy/typescript-client';
import { TFunction } from 'i18next';

import { PageId } from '#constants/pages.js';
import { getPath } from '#utils/pageUtils.js';

export const getAdminNavigationItems = (groups: UserGroups[], t: TFunction): SideNavigationProps.Item[] => {
  if (!groups.includes(UserGroups.ADMIN)) return [];
  return [
    {
      type: 'section',
      text: t('sections.admin', { ns: 'navigation' }),
      items: [
        {
          type: 'link',
          text: t(`breadcrumbs.${PageId.MANAGE_INSTANCE}`, { ns: 'navigation' }),
          href: getPath(PageId.MANAGE_INSTANCE),
        },
      ],
    },
  ];
};

export const getModelManagementNavigationItems = (groups: UserGroups[], t: TFunction): SideNavigationProps.Item[] => {
  if (!groups.some((g) => g === UserGroups.ADMIN || g === UserGroups.RACE_FACILITATORS)) return [];
  return [
    {
      type: 'section',
      text: t('sections.modelManagement', { ns: 'navigation' }),
      items: [
        {
          type: 'link',
          text: t(`breadcrumbs.${PageId.ADMIN_MODEL_DOWNLOAD}`, { ns: 'navigation' }),
          href: getPath(PageId.ADMIN_MODEL_DOWNLOAD),
        },
      ],
    },
  ];
};
