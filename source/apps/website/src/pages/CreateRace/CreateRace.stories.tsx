// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import CreateRace from './index.js';

const meta = {
  component: CreateRace,
  title: 'pages/CreateRace',
} satisfies Meta<typeof CreateRace>;

export default meta;

type Story = StoryObj<typeof CreateRace>;
export const Default: Story = {};
