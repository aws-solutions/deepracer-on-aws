// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetProfileCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import { mockProfile, mockProfileNoAvatar } from '#constants/testConstants';
import RacerProfile from '#pages/RacerProfile';

const meta = {
  component: RacerProfile,
  title: 'pages/RacerProfile',
} satisfies Meta<typeof RacerProfile>;

export default meta;

type Story = StoryObj<typeof RacerProfile>;

export const DefaultAvatar: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetProfileCommand).resolves({ profile: mockProfileNoAvatar });
    },
  },
};

export const SetAvatar: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetProfileCommand).resolves({ profile: mockProfile });
    },
  },
};

export const UnlimitedModels: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetProfileCommand).resolves({
        profile: { ...mockProfile, modelCount: 5, maxModelCount: -1 },
      });
    },
  },
};

export const LimitedModels: Story = {
  parameters: {
    deepRacerApiMocks: (client) => {
      client.on(GetProfileCommand).resolves({
        profile: { ...mockProfile, modelCount: 3, maxModelCount: 10 },
      });
    },
  },
};
