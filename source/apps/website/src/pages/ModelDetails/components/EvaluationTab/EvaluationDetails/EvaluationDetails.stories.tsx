// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ModelStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import {
  mockEvaluationCompleted,
  mockEvaluationInitializing,
  mockEvaluationInProgress,
  mockModel,
} from '#constants/testConstants';
import EvaluationDetails from '#pages/ModelDetails/components/EvaluationTab/EvaluationDetails';

const meta = {
  component: EvaluationDetails,
  title: 'pages/ModelDetails/EvaluationTab/EvaluationDetails',
  args: {
    model: { ...mockModel, status: ModelStatus.EVALUATING },
  },
} satisfies Meta<typeof EvaluationDetails>;

export default meta;

type Story = StoryObj<typeof EvaluationDetails>;

export const EvaluationInitializing: Story = {
  args: {
    evaluation: mockEvaluationInitializing,
  },
};

export const EvaluationInProgress: Story = {
  args: {
    evaluation: mockEvaluationInProgress,
  },
};

export const EvaluationCompleted: Story = {
  args: {
    evaluation: mockEvaluationCompleted,
    model: { ...mockModel, status: ModelStatus.READY },
  },
};
