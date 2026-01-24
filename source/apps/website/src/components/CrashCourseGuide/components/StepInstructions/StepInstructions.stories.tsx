// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import StepInstructions from './StepInstructions';

const meta = {
  component: StepInstructions,
  title: 'crashCourseGuide/StepInstructions',
} satisfies Meta<typeof StepInstructions>;

export default meta;

type Story = StoryObj<typeof StepInstructions>;

export const Default: Story = {
  args: {
    title: 'Step 1',
    description: 'This is a step description',
  },
};
