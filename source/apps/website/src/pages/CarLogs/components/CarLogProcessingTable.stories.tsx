// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogFetchStatus } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import CarLogProcessingTable from './CarLogProcessingTable';

const meta = {
  component: CarLogProcessingTable,
  title: 'CarLogs/CarLogProcessingTable',
} satisfies Meta<typeof CarLogProcessingTable>;

export default meta;

type Story = StoryObj<typeof CarLogProcessingTable>;

export const Default: Story = {
  args: {
    isFetching: false,
    isLoading: false,
    jobs: [
      {
        jobId: 'job-001',
        status: CarLogFetchStatus.PROCESSING,
        createdAt: new Date('2026-01-01T10:00:00Z'),
        endedAt: undefined,
        eventName: 'Qualifier',
        carName: 'Car Alpha',
      },
    ],
    onRefresh: () => undefined,
  },
};
