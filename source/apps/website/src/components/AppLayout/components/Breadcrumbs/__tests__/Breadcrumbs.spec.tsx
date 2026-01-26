// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { composeStories } from '@storybook/react';

import { mockLeaderboardTT, mockModel } from '../../../../../constants/testConstants.js';
import i18n from '../../../../../i18n/index.js';
import { screen } from '../../../../../utils/testUtils.js';
import * as stories from '../Breadcrumbs.stories';

const { ModelDetailsPage, ModelsPage, RaceDetailsPage } = composeStories(stories);

describe.skip('<Breadcrumbs />', () => {
  it('should display correct breadcrumbs for a page with static breadcrumb', async () => {
    await ModelsPage.run();

    const homeBreadcrumb = (await screen.findAllByText(i18n.t('breadcrumbs:home')))[0];
    const modelsBreadcrumb = (await screen.findAllByText(i18n.t('breadcrumbs:models')))[0];

    expect(homeBreadcrumb).toBeInTheDocument();
    expect(modelsBreadcrumb).toBeInTheDocument();
  });

  it('should display correct breadcrumbs for a page with dynamic model breadcrumb', async () => {
    await ModelDetailsPage.run();

    const homeBreadcrumb = (await screen.findAllByText(i18n.t('breadcrumbs:home')))[0];
    const modelsBreadcrumb = (await screen.findAllByText(i18n.t('breadcrumbs:models')))[0];
    const modelName = (await screen.findAllByText(mockModel.name))[0];

    expect(homeBreadcrumb).toBeInTheDocument();
    expect(modelsBreadcrumb).toBeInTheDocument();
    expect(modelName).toBeInTheDocument();
  });

  it('should display correct breadcrumbs for a page with dynamic race breadcrumb', async () => {
    await RaceDetailsPage.run();

    const homeBreadcrumb = (await screen.findAllByText(i18n.t('breadcrumbs:home')))[0];
    const racesBreadcrumb = (await screen.findAllByText(i18n.t('breadcrumbs:races')))[0];
    const raceName = (await screen.findAllByText(mockLeaderboardTT.name))[0];

    expect(homeBreadcrumb).toBeInTheDocument();
    expect(racesBreadcrumb).toBeInTheDocument();
    expect(raceName).toBeInTheDocument();
  });
});
