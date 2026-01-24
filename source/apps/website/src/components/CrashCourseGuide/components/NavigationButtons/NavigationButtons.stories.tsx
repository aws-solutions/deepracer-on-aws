// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import NavigationButtons from './NavigationButtons';

const meta = {
  component: NavigationButtons,
  title: 'crashCourseGuide/NavigationButtons',
} satisfies Meta<typeof NavigationButtons>;

export default meta;

type Story = StoryObj<typeof NavigationButtons>;

export const Default: Story = {
  args: {
    canNext: true,
    canPrev: true,
    onNext: () => {
      console.log('Next');
    },
    onPrev: () => {
      console.log('Prev');
    },
    currentStep: <div>Step</div>,
    subStepNumber: 1,
  },
};
