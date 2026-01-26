// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import ModelStatusIndicator from '#pages/Models/components/ModelStatusIndicator';

const meta = {
  component: ModelStatusIndicator,
  title: 'ModelStatusIndicator',
} satisfies Meta<typeof ModelStatusIndicator>;

export default meta;

type Story = StoryObj<typeof ModelStatusIndicator>;

export const Default: Story = {
  args: {
    modelStatus: ModelStatus.READY,
  },
};
