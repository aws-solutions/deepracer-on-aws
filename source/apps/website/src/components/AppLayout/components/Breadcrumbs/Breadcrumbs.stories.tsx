// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetLeaderboardCommand, GetModelCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import Breadcrumbs from './Breadcrumbs';
import { PageId, pages } from '../../../../constants/pages.js';
import { mockLeaderboardTT, mockModel } from '../../../../constants/testConstants.js';
import { getPath } from '../../../../utils/pageUtils.js';

const meta = {
  component: Breadcrumbs,
  title: 'Components/AppLayout/Breadcrumbs',
} satisfies Meta<typeof Breadcrumbs>;

export default meta;

type Story = StoryObj<typeof Breadcrumbs>;

export const ModelsPage: Story = {
  parameters: {
    routing: {
      componentRoute: pages[PageId.MODELS].path,
    },
  },
};

export const ModelDetailsPage: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolvesOnce({ model: mockModel });
    },
    routing: {
      componentRoute: getPath(PageId.MODEL_DETAILS, { modelId: mockModel.modelId }),
    },
  },
};

export const RaceDetailsPage: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetLeaderboardCommand).resolvesOnce({ leaderboard: mockLeaderboardTT });
    },
    routing: {
      componentRoute: getPath(PageId.RACE_DETAILS, { leaderboardId: mockLeaderboardTT.leaderboardId }),
    },
  },
};
