// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockEvaluationCompleted, mockEvaluationInitializing } from '#constants/testConstants';
import EvaluationsTable from '#pages/ModelDetails/components/EvaluationTab/EvaluationsTable';

const meta = {
  component: EvaluationsTable,
  title: 'pages/ModelDetails/EvaluationTab/EvaluationsTable',
  args: {
    onLoadEvaluation: () => console.log('onLoadEvaluation'),
  },
} satisfies Meta<typeof EvaluationsTable>;

export default meta;

type Story = StoryObj<typeof EvaluationsTable>;

export const Default: Story = {
  args: {
    evaluations: [mockEvaluationInitializing, mockEvaluationCompleted],
    isEvaluationsLoading: false,
  },
};

export const Loading: Story = {
  args: {
    evaluations: [],
    isEvaluationsLoading: true,
  },
};

export const Empty: Story = {
  args: {
    evaluations: [],
    isEvaluationsLoading: false,
  },
};
