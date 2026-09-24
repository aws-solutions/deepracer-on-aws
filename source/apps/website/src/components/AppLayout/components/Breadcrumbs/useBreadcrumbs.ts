// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';

import { AUTH_PAGE_IDS, PageId, pages } from '../../../../constants/pages.js';
import { useTimekeepingContext } from '../../../../hooks/useTimekeepingContext.js';
import { useGetEventQuery } from '../../../../services/deepRacer/eventsApi.js';
import { useGetLeaderboardQuery } from '../../../../services/deepRacer/leaderboardsApi.js';
import { useGetModelQuery } from '../../../../services/deepRacer/modelsApi.js';
import { getPageDetailsByPathname, getPath } from '../../../../utils/pageUtils.js';

export const useBreadcrumbs = (currentPageDetails: ReturnType<typeof getPageDetailsByPathname>) => {
  const { t } = useTranslation('breadcrumbs');
  const { selectedEventId, selectedLeaderboardId } = useTimekeepingContext();
  const isTimekeepingPage = currentPageDetails?.pageId === PageId.TIMEKEEPING;

  const modelId = currentPageDetails?.params?.modelId ?? '';
  const leaderboardId =
    currentPageDetails?.params?.leaderboardId ?? (isTimekeepingPage ? (selectedLeaderboardId ?? '') : '');
  const eventId = currentPageDetails?.params?.eventId ?? (isTimekeepingPage ? (selectedEventId ?? '') : '');
  const instanceId = currentPageDetails?.params?.instanceId ?? '';

  const { currentData: model } = useGetModelQuery(modelId ? { modelId } : skipToken);
  const { currentData: leaderboard } = useGetLeaderboardQuery(leaderboardId ? { leaderboardId } : skipToken);
  const { currentData: event } = useGetEventQuery(eventId ? { eventId } : skipToken);

  if (
    !currentPageDetails ||
    AUTH_PAGE_IDS.includes(currentPageDetails.pageId) ||
    currentPageDetails.pageId === PageId.HOME
  ) {
    return [];
  }

  const { pageId: currentPageId } = currentPageDetails;

  if (isTimekeepingPage) {
    const timekeepingBreadcrumbs: BreadcrumbGroupProps.Item[] = [
      { text: t('home'), href: getPath(PageId.HOME) },
      { text: t(PageId.TIMEKEEPING), href: getPath(PageId.TIMEKEEPING) },
    ];

    if (event) {
      timekeepingBreadcrumbs.push({
        text: event.name,
        href: getPath(PageId.EVENT_DETAIL, { eventId }),
      });
    }
    if (leaderboard) {
      timekeepingBreadcrumbs.push({
        text: leaderboard.name,
        href: getPath(PageId.RACE_DETAILS, { leaderboardId }),
      });
    }

    return timekeepingBreadcrumbs;
  }

  const currentPagePathNoLeadingSlash = pages[currentPageId].path.slice(1); // /models/:modelId -> models/:modelId
  const currentPagePathParts = currentPagePathNoLeadingSlash.split('/'); // models/:modelId -> ["models", ":modelId"]

  const breadcrumbs: BreadcrumbGroupProps['items'] = [
    { text: t('home'), href: getPath(PageId.HOME) },
    ...currentPagePathParts.map((part, index) => {
      if (part.startsWith(':')) {
        const param = part.slice(1);
        switch (param) {
          case 'modelId':
            if (!model) return null;
            return {
              text: model.name,
              href: getPath(PageId.MODEL_DETAILS, { modelId }),
            };
          case 'leaderboardId':
            if (!leaderboard) return null;
            return {
              text: leaderboard.name,
              href: getPath(PageId.RACE_DETAILS, { leaderboardId }),
            };
          case 'eventId':
            if (!event) return null;
            return {
              text: event.name,
              href: getPath(PageId.EVENT_DETAIL, { eventId }),
            };
          default:
            return null;
        }
      } else {
        const pathSoFar = currentPagePathParts
          .slice(0, currentPagePathNoLeadingSlash.indexOf(currentPagePathParts[index]) + 1)
          .join('/');

        const currentPartPageId = Object.entries(pages).find(([_, { path }]) => path.slice(1) === pathSoFar)?.[0] as
          PageId | undefined;

        if (!currentPartPageId) return null;

        return {
          text: t(currentPartPageId),
          href: getPath(currentPartPageId, { modelId, leaderboardId, eventId, instanceId }),
        };
      }
    }),
  ].filter((e) => e !== null);

  return breadcrumbs;
};
