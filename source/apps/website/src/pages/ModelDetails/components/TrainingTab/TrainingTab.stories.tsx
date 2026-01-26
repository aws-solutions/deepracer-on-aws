// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import TrainingTab from '#pages/ModelDetails/components/TrainingTab';

import * as TrainingDetailsStories from './TrainingDetails/TrainingDetails.stories';

const meta = {
  component: TrainingTab,
  title: 'pages/ModelDetails/TrainingTab',
  parameters: {
    msw: {
      handlers: {
        trainingMetrics: TrainingDetailsStories.default.parameters?.msw?.handlers?.trainingMetrics,
      },
    },
  },
} satisfies Meta<typeof TrainingTab>;

export default meta;

type Story = StoryObj<typeof TrainingTab>;

export const TrainingInitializing: Story = {
  args: {
    model: TrainingDetailsStories.TrainingInitializing.args?.model,
  },
};

export const TrainingInProgress: Story = {
  args: {
    model: TrainingDetailsStories.TrainingInProgress.args?.model,
  },
};

export const TrainingCompleted: Story = {
  args: {
    model: TrainingDetailsStories.TrainingCompleted.args?.model,
  },
};
