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

export const getDeviceManagementNavigationItems = (groups: UserGroups[], t: TFunction): SideNavigationProps.Item[] => {
  if (!groups.some((g) => g === UserGroups.ADMIN || g === UserGroups.RACE_FACILITATORS)) return [];
  const items: SideNavigationProps.Item[] = [
    {
      type: 'link',
      text: t(`breadcrumbs.${PageId.DEVICES}`, { ns: 'navigation' }),
      href: getPath(PageId.DEVICES),
    },
  ];
  // Fleet management is Admin-only.
  if (groups.includes(UserGroups.ADMIN)) {
    items.push({
      type: 'link',
      text: t(`breadcrumbs.${PageId.FLEETS}`, { ns: 'navigation' }),
      href: getPath(PageId.FLEETS),
    });
  }
  return [
    {
      type: 'section',
      text: t('sections.deviceManagement', { ns: 'navigation' }),
      items,
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
          text: t(`breadcrumbs.${PageId.ADMIN_MODELS}`, { ns: 'navigation' }),
          href: getPath(PageId.ADMIN_MODELS),
        },
        {
          type: 'link',
          text: t(`breadcrumbs.${PageId.UPLOAD_STATUS}`, { ns: 'navigation' }),
          href: getPath(PageId.UPLOAD_STATUS),
        },
      ],
    },
  ];
};

export const getRaceManagementNavigationItems = (groups: UserGroups[], t: TFunction): SideNavigationProps.Item[] => {
  const isAdmin = groups.includes(UserGroups.ADMIN);
  const isFacilitator = groups.includes(UserGroups.RACE_FACILITATORS);
  const isRacer = groups.includes(UserGroups.RACERS);
  const isCommentator = groups.includes(UserGroups.COMMENTATORS);
  const isRegistrationManager = groups.includes(UserGroups.REGISTRATION_MANAGERS);

  // Races is available to Admin, Race Facilitators, and Racers only — Commentators and
  // Registration Managers have no defined use for the general race list.
  const items: SideNavigationProps.Item[] = [];
  if (isAdmin || isFacilitator || isRacer) {
    items.push(
      {
        type: 'link',
        text: t(`breadcrumbs.${PageId.RACES}`, { ns: 'navigation' }),
        href: getPath(PageId.RACES),
      },
      {
        type: 'link',
        text: t(`breadcrumbs.${PageId.EVENTS}`, { ns: 'navigation' }),
        href: getPath(PageId.EVENTS),
      },
      {
        type: 'link',
        text: t(`breadcrumbs.${PageId.TIMEKEEPING}`, { ns: 'navigation' }),
        href: getPath(PageId.TIMEKEEPING),
      },
    );
  }
  if (isCommentator || isFacilitator || isAdmin) {
    items.push({
      type: 'link',
      text: t(`breadcrumbs.${PageId.COMMENTATOR_VIEW}`, { ns: 'navigation' }),
      href: getPath(PageId.COMMENTATOR_VIEW),
    });
  }
  if (isRegistrationManager || isFacilitator || isAdmin) {
    items.push({
      type: 'link',
      text: t(`breadcrumbs.${PageId.REGISTER_RACER}`, { ns: 'navigation' }),
      href: getPath(PageId.REGISTER_RACER),
    });
  }
  if (isAdmin) {
    items.push({
      type: 'link',
      text: t(`breadcrumbs.${PageId.RACE_STATS}`, { ns: 'navigation' }),
      href: getPath(PageId.RACE_STATS),
    });
  }

  return items.length > 0
    ? [
        {
          type: 'section',
          text: t('sections.raceManagement', { ns: 'navigation' }),
          items,
        },
      ]
    : [];
};
