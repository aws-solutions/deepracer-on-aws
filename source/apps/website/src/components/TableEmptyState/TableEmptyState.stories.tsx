// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import TableEmptyState from './index.js';

const meta = {
  component: TableEmptyState,
  title: 'TableEmptyState',
} satisfies Meta<typeof TableEmptyState>;

export default meta;

type Story = StoryObj<typeof TableEmptyState>;

export const Default: Story = {
  args: {
    title: 'Empty table',
    subtitle: 'No contents',
  },
};
