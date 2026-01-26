// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus, ModelStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import {
  mockEvaluationCompleted,
  mockEvaluationInitializing,
  mockEvaluationInProgress,
  mockModel,
} from '#constants/testConstants';
import EvaluationTab from '#pages/ModelDetails/components/EvaluationTab';

const meta = {
  component: EvaluationTab,
  title: 'pages/ModelDetails/EvaluationTab',
  args: {
    model: mockModel,
  },
} satisfies Meta<typeof EvaluationTab>;

export default meta;

type Story = StoryObj<typeof EvaluationTab>;

export const EvaluationInitializing: Story = {
  args: {
    evaluations: [mockEvaluationInitializing, mockEvaluationCompleted],
    isEvaluationsLoading: false,
  },
};

export const EvaluationInProgress: Story = {
  args: {
    evaluations: [mockEvaluationInProgress, mockEvaluationCompleted],
    isEvaluationsLoading: false,
  },
};

export const EvaluationCompleted: Story = {
  args: {
    evaluations: [mockEvaluationCompleted],
    isEvaluationsLoading: false,
  },
};

export const EvaluationCompletedNoLaps: Story = {
  args: {
    evaluations: [{ ...mockEvaluationCompleted, metrics: [], videoUrl: undefined }],
    isEvaluationsLoading: false,
  },
};

export const TrainingNotComplete: Story = {
  args: {
    model: { ...mockModel, trainingStatus: JobStatus.IN_PROGRESS, status: ModelStatus.TRAINING },
    evaluations: [],
    isEvaluationsLoading: false,
  },
};

export const NoEvaluations: Story = {
  args: {
    evaluations: [],
    isEvaluationsLoading: false,
  },
};

export const Loading: Story = {
  args: {
    evaluations: [],
    isEvaluationsLoading: true,
  },
};
