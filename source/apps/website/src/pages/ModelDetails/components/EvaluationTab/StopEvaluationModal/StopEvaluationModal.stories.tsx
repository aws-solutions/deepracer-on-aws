// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import StopEvaluationModal from '#pages/ModelDetails/components/EvaluationTab/StopEvaluationModal';

const meta = {
  component: StopEvaluationModal,
  title: 'pages/ModelDetails/EvaluationTab/StopEvaluationModal',
} satisfies Meta<typeof StopEvaluationModal>;

export default meta;

type Story = StoryObj<typeof StopEvaluationModal>;

export const Default: Story = {
  args: {
    isVisible: true,
    onConfirm: async () => console.log('onConfirm'),
    onDismiss: () => console.log('onDismiss'),
  },
};
