// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import RaceInfoPanel from './RaceInfoPanel';

const meta: Meta<typeof RaceInfoPanel> = {
  component: RaceInfoPanel,
  title: 'LiveRace/RaceInfoPanel',
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<typeof RaceInfoPanel>;

export const CountdownActive: Story = {
  args: {
    liveEventTime: new Date(Date.now() + 7200000).toISOString(),
  },
};
