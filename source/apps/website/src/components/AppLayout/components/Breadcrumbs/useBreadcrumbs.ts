// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';

import { AUTH_PAGE_IDS, PageId, pages } from '../../../../constants/pages.js';
import { useGetLeaderboardQuery } from '../../../../services/deepRacer/leaderboardsApi.js';
import { useGetModelQuery } from '../../../../services/deepRacer/modelsApi.js';
import { getPageDetailsByPathname, getPath } from '../../../../utils/pageUtils.js';

export const useBreadcrumbs = (currentPageDetails: ReturnType<typeof getPageDetailsByPathname>) => {
  const { t } = useTranslation('breadcrumbs');

  const modelId = currentPageDetails?.params?.modelId ?? '';
  const leaderboardId = currentPageDetails?.params?.leaderboardId ?? '';

  const { currentData: model } = useGetModelQuery(modelId ? { modelId } : skipToken);
  const { currentData: leaderboard } = useGetLeaderboardQuery(leaderboardId ? { leaderboardId } : skipToken);

  if (
    !currentPageDetails ||
    AUTH_PAGE_IDS.includes(currentPageDetails.pageId) ||
    currentPageDetails.pageId === PageId.HOME
  ) {
    return [];
  }

  const { pageId: currentPageId } = currentPageDetails;

  const currentPagePathNoLeadingSlash = pages[currentPageId].path.slice(1); // /models/:modelId -> models/:modelId
  const currentPagePathParts = currentPagePathNoLeadingSlash.split('/'); // models/:modelId -> ["models", ":modelId"]

  const breadcrumbs: BreadcrumbGroupProps['items'] = [
    { text: t('home'), href: getPath(PageId.HOME) },
    ...currentPagePathParts.map((part, index) => {
      if (part.startsWith(':')) {
        const param = part.slice(1) as keyof typeof currentPageDetails.params;
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
          default:
            return null;
        }
      } else {
        const pathSoFar = currentPagePathParts
          .slice(0, currentPagePathNoLeadingSlash.indexOf(currentPagePathParts[index]) + 1)
          .join('/');

        const currentPartPageId = Object.entries(pages).find(
          ([_, { path }]) => path.slice(1) === pathSoFar,
        )?.[0] as PageId;

        return {
          text: t(currentPartPageId),
          href: getPath(currentPartPageId, { modelId, leaderboardId }),
        };
      }
    }),
  ].filter((e) => e !== null);

  return breadcrumbs;
};
