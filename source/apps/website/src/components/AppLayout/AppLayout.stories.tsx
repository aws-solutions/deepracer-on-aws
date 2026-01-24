// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import AppLayout from './index.js';
import { PageId, pages } from '../../constants/pages.js';

const meta = {
  component: AppLayout,
  title: 'Components/AppLayout',
} satisfies Meta<typeof AppLayout>;

export default meta;

type Story = StoryObj<typeof AppLayout>;

export const Default: Story = {
  parameters: {
    routing: {
      componentRoute: pages[PageId.GET_STARTED].path,
    },
  },
};
