// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import CreateModel from '#pages/CreateModel';

const meta = {
  component: CreateModel,
  title: 'pages/CreateModel',
} satisfies Meta<typeof CreateModel>;

export default meta;

type Story = StoryObj<typeof CreateModel>;

export const Default: Story = {};
