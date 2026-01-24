// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import TopNavigation from './TopNavigation';

const meta = {
  component: TopNavigation,
  title: 'Components/AppLayout/TopNavigation',
} satisfies Meta<typeof TopNavigation>;

export default meta;

type Story = StoryObj<typeof TopNavigation>;

export const Default: Story = {
  args: {},
};
