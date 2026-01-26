// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import { mockEvaluationCompleted } from '#constants/testConstants';
import EvaluationConfiguration from '#pages/ModelDetails/components/EvaluationTab/EvaluationConfiguration';

const meta = {
  component: EvaluationConfiguration,
  title: 'pages/ModelDetails/EvaluationTab/EvaluationConfiguration',
} satisfies Meta<typeof EvaluationConfiguration>;

export default meta;

type Story = StoryObj<typeof EvaluationConfiguration>;

export const Default: Story = {
  args: {
    evaluation: mockEvaluationCompleted,
  },
};
