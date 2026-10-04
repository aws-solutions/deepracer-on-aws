// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogFetchStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import CarLogStatusIndicator from './CarLogStatusIndicator';

const meta = {
  component: CarLogStatusIndicator,
  title: 'CarLogs/CarLogStatusIndicator',
} satisfies Meta<typeof CarLogStatusIndicator>;

export default meta;

type Story = StoryObj<typeof CarLogStatusIndicator>;

export const Processing: Story = {
  args: { status: CarLogFetchStatus.PROCESSING },
};

export const Done: Story = {
  args: { status: CarLogFetchStatus.DONE },
};
