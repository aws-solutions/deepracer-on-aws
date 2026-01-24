// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import SideNavigation from './SideNavigation';

const meta = {
  component: SideNavigation,
  title: 'Components/AppLayout/SideNavigation',
} satisfies Meta<typeof SideNavigation>;

export default meta;

type Story = StoryObj<typeof SideNavigation>;

export const Default: Story = {
  args: {},
};
