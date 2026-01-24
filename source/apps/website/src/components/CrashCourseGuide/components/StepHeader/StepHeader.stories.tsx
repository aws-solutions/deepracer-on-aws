// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import StepHeader from './StepHeader';

const meta = {
  component: StepHeader,
  title: 'crashCourseGuide/StepHeader',
} satisfies Meta<typeof StepHeader>;

export default meta;

type Story = StoryObj<typeof StepHeader>;

export const Default: Story = {
  args: {
    setIsVisible: () => null,
  },
};
