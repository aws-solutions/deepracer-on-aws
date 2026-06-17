// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Meta, StoryObj } from '@storybook/react';

import QueueManagementPanel, { QueueItem } from './QueueManagementPanel';

const meta: Meta<typeof QueueManagementPanel> = {
  component: QueueManagementPanel,
  title: 'LiveRace/QueueManagementPanel',
  parameters: {
    layout: 'padded',
  },
};
export default meta;

type Story = StoryObj<typeof QueueManagementPanel>;

const mockItems: QueueItem[] = [
  {
    submissionId: '1',
    participantName: 'Alice',
    modelName: 'SpeedDemon-v3',
    queuePosition: 'a0',
    status: 'COMPLETED',
    submittedAt: '2026-01-01T10:00:00Z',
  },
  {
    submissionId: '2',
    participantName: 'Bob',
    modelName: 'TurboRacer-v1',
    queuePosition: 'a1',
    status: 'IN_PROGRESS',
    submittedAt: '2026-01-01T10:01:00Z',
  },
  {
    submissionId: '3',
    participantName: 'Charlie',
    modelName: 'FastLane-v2',
    queuePosition: 'a2',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:02:00Z',
  },
  {
    submissionId: '4',
    participantName: 'Diana',
    modelName: 'RocketModel-v4',
    queuePosition: 'a3',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:03:00Z',
  },
  {
    submissionId: '5',
    participantName: 'Eve',
    modelName: 'LightningBot-v1',
    queuePosition: 'a4',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:04:00Z',
  },
  {
    submissionId: '6',
    participantName: 'Frank',
    modelName: 'NitroCharge-v2',
    queuePosition: 'a5',
    status: 'FAILED',
    submittedAt: '2026-01-01T10:05:00Z',
  },
  {
    submissionId: '7',
    participantName: 'Gabriella Hernandez-Rodriguez',
    modelName: 'SuperUltraMegaSpeedsterModel-v99-final-FINAL',
    queuePosition: 'a6',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:06:00Z',
  },
  {
    submissionId: '8',
    participantName: 'Hiro',
    modelName: 'ZenRacer-v3',
    queuePosition: 'a7',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:07:00Z',
  },
  {
    submissionId: '9',
    participantName: 'Isabella Johansson-Petersson',
    modelName: 'ThunderBolt-ReinforcementLearning-Optimized-v12',
    queuePosition: 'a8',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:08:00Z',
  },
  {
    submissionId: '10',
    participantName: 'Jake',
    modelName: 'QuickSilver-v1',
    queuePosition: 'a9',
    status: 'PENDING',
    submittedAt: '2026-01-01T10:09:00Z',
  },
];

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noopFn = () => {};

export const MixedStatuses: Story = {
  args: {
    items: mockItems,
    onReorder: noopFn,
    onRemove: noopFn,
    onReset: noopFn,
    isRaceCompleted: false,
  },
};

export const AllPending: Story = {
  args: {
    items: mockItems.map((item) => ({ ...item, status: 'PENDING' as const })),
    onReorder: noopFn,
    onRemove: noopFn,
    onReset: noopFn,
    isRaceCompleted: false,
  },
};

export const RaceCompleted: Story = {
  args: {
    items: mockItems.map((item) => ({ ...item, status: 'COMPLETED' as const })),
    onReorder: noopFn,
    onRemove: noopFn,
    onReset: noopFn,
    isRaceCompleted: true,
  },
};

export const EmptyQueue: Story = {
  args: {
    items: [],
    onReorder: noopFn,
    onRemove: noopFn,
    onReset: noopFn,
    isRaceCompleted: false,
  },
};
