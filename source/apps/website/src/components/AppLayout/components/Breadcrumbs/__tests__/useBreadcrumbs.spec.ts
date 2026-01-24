// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetLeaderboardCommand, GetModelCommand } from '@deepracer-indy/typescript-client';
import { mockClient } from 'aws-sdk-client-mock';

import { AUTH_PAGE_IDS, PageId, pages } from '../../../../../constants/pages.js';
import { mockLeaderboardTT, mockModel } from '../../../../../constants/testConstants.js';
import i18n from '../../../../../i18n/index.js';
import { deepRacerClient } from '../../../../../services/deepRacer/deepRacerClient.js';
import { getPageDetailsByPathname, getPath } from '../../../../../utils/pageUtils.js';
import { renderHook, waitFor } from '../../../../../utils/testUtils.js';
import { useBreadcrumbs } from '../useBreadcrumbs';

describe('useBreadcrumbs', () => {
  const mockDeepRacerClient = mockClient(deepRacerClient);

  beforeEach(() => {
    mockDeepRacerClient.reset();
  });

  it('should return correct breadcrumbs for a page with static breadcrumb', async () => {
    const accountPageDetails: ReturnType<typeof getPageDetailsByPathname> = {
      pageId: PageId.ACCOUNT,
      path: pages[PageId.ACCOUNT].path,
      params: { modelId: undefined, leaderboardId: undefined },
    };

    const { result } = renderHook(() => useBreadcrumbs(accountPageDetails));

    expect(result.current).toEqual([
      { href: getPath(PageId.HOME), text: i18n.t('breadcrumbs:home') },
      { href: getPath(PageId.ACCOUNT), text: i18n.t('breadcrumbs:account') },
    ]);
  });

  it('should return correct breadcrumbs for a page with dynamic model breadcrumb', async () => {
    const modelDetailsPageDetails: ReturnType<typeof getPageDetailsByPathname> = {
      pageId: PageId.MODEL_DETAILS,
      path: pages[PageId.MODEL_DETAILS].path,
      params: { modelId: mockModel.modelId, leaderboardId: undefined },
    };
    mockDeepRacerClient.on(GetModelCommand).resolvesOnce({ model: mockModel });

    const { result } = renderHook(() => useBreadcrumbs(modelDetailsPageDetails));

    await waitFor(() => {
      expect(result.current).toEqual([
        { href: getPath(PageId.HOME), text: i18n.t('breadcrumbs:home') },
        { href: getPath(PageId.MODELS), text: i18n.t('breadcrumbs:models') },
        { href: getPath(PageId.MODEL_DETAILS, { modelId: mockModel.modelId }), text: mockModel.name },
      ]);
    });
  });

  it('should return correct breadcrumbs for a page with dynamic race breadcrumb', async () => {
    const raceDetailsPageDetails: ReturnType<typeof getPageDetailsByPathname> = {
      pageId: PageId.RACE_DETAILS,
      path: pages[PageId.RACE_DETAILS].path,
      params: { modelId: undefined, leaderboardId: mockLeaderboardTT.leaderboardId },
    };
    mockDeepRacerClient.on(GetLeaderboardCommand).resolvesOnce({ leaderboard: mockLeaderboardTT });

    const { result } = renderHook(() => useBreadcrumbs(raceDetailsPageDetails));

    await waitFor(() => {
      expect(result.current).toEqual([
        { href: getPath(PageId.HOME), text: i18n.t('breadcrumbs:home') },
        { href: getPath(PageId.RACES), text: i18n.t('breadcrumbs:races') },
        {
          href: getPath(PageId.RACE_DETAILS, { leaderboardId: mockLeaderboardTT.leaderboardId }),
          text: mockLeaderboardTT.name,
        },
      ]);
    });
  });

  it('should return no breadcrumbs when missing page details', async () => {
    const { result } = renderHook(() => useBreadcrumbs(null));
    expect(result.current).toEqual([]);
  });

  it('should return no breadcrumbs for home page', async () => {
    const homePageDetails: ReturnType<typeof getPageDetailsByPathname> = {
      pageId: PageId.HOME,
      path: pages[PageId.HOME].path,
      params: { modelId: undefined, leaderboardId: undefined },
    };

    const { result } = renderHook(() => useBreadcrumbs(homePageDetails));

    expect(result.current).toEqual([]);
  });

  it.each(AUTH_PAGE_IDS)('should return no breadcrumbs for %s auth page', async (authPageId) => {
    const authPageDetails: ReturnType<typeof getPageDetailsByPathname> = {
      pageId: authPageId,
      path: pages[authPageId].path,
      params: { modelId: undefined, leaderboardId: undefined },
    };

    const { result } = renderHook(() => useBreadcrumbs(authPageDetails));

    expect(result.current).toEqual([]);
  });
});
