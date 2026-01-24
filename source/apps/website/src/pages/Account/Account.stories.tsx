// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import Account from '#pages/Account';

const meta = {
  component: Account,
  title: 'pages/Account',
} satisfies Meta<typeof Account>;

export default meta;

type Story = StoryObj<typeof Account>;

export const Default: Story = {
  args: {},
};
