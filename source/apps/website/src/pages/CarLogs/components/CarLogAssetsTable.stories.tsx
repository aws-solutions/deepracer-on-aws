// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { CarLogAssetType } from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import CarLogAssetsTable from './CarLogAssetsTable';

const meta = {
  component: CarLogAssetsTable,
  title: 'CarLogs/CarLogAssetsTable',
} satisfies Meta<typeof CarLogAssetsTable>;

export default meta;

type Story = StoryObj<typeof CarLogAssetsTable>;

export const Manager: Story = {
  args: {
    access: 'manager',
    showUserColumn: true,
    assets: [
      {
        assetId: 'asset-001',
        profileId: 'profile-001',
        type: CarLogAssetType.VIDEO,
        filename: 'run-001.mp4',
        racerName: 'SpeedRacer42',
        eventName: 'Qualifier',
        carName: 'Car Alpha',
        models: [{ modelId: 'model-001', modelName: 'Fast model' }],
        uploadedAt: new Date('2026-01-01T10:00:00Z'),
        mediaMetadata: { durationSeconds: 92 },
      },
    ],
    isFetching: false,
    isLoading: false,
    onRefresh: () => undefined,
    onRequestDelete: () => undefined,
    onRequestDownload: () => undefined,
    onRequestUpload: () => undefined,
  },
};
