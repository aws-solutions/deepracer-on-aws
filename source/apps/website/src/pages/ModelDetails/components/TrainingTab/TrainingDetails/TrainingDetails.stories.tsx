// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { JobStatus, ModelStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';
import { http, HttpResponse } from 'msw';

import { mockModel } from '#constants/testConstants.js';
import TrainingDetails from '#pages/ModelDetails/components/TrainingTab/TrainingDetails';

import mockTrainingMetrics from './sample-training-metrics.json';

const meta = {
  component: TrainingDetails,
  title: 'pages/ModelDetails/TrainingTab/TrainingDetails',
  parameters: {
    msw: {
      handlers: {
        trainingMetrics: [
          http.get(mockModel.trainingMetricsUrl, () => HttpResponse.json({ metrics: mockTrainingMetrics })),
        ],
      },
    },
  },
} satisfies Meta<typeof TrainingDetails>;

export default meta;

type Story = StoryObj<typeof TrainingDetails>;

export const TrainingInitializing: Story = {
  args: {
    model: {
      ...mockModel,
      status: ModelStatus.TRAINING,
      trainingStatus: JobStatus.INITIALIZING,
      trainingVideoStreamUrl: undefined,
    },
  },
};

export const TrainingInProgress: Story = {
  args: {
    model: {
      ...mockModel,
      status: ModelStatus.TRAINING,
      trainingStatus: JobStatus.IN_PROGRESS,
    },
  },
};

export const TrainingCompleted: Story = {
  args: {
    model: {
      ...mockModel,
      status: ModelStatus.READY,
      trainingStatus: JobStatus.COMPLETED,
      trainingVideoStreamUrl: undefined,
    },
  },
};
