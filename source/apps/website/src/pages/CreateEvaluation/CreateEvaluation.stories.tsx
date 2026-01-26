// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import CreateEvaluation from '#pages/CreateEvaluation';

const meta = {
  component: CreateEvaluation,
  title: 'pages/CreateEvaluation',
} satisfies Meta<typeof CreateEvaluation>;

export default meta;

type Story = StoryObj<typeof CreateEvaluation>;

export const Default: Story = {
  render: () => {
    return <CreateEvaluation />;
  },
};
