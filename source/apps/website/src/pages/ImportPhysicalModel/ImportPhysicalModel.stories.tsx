// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { GetProfileCommand } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import ImportPhysicalModel from './ImportPhysicalModel';

const meta = {
  component: ImportPhysicalModel,
  title: 'pages/ImportPhysicalModel',
} satisfies Meta<typeof ImportPhysicalModel>;

export default meta;

type Story = StoryObj<typeof ImportPhysicalModel>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetProfileCommand).resolves({
        profile: { profileId: 'testprofile1234', alias: 'testuser', avatar: {} },
      });
    },
  },
};
