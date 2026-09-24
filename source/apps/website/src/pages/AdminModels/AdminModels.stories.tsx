// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminModelExtended,
  ListAdminModelsCommand,
  ModelSource,
  ModelStatus,
  OptimizationStatus,
} from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import AdminModels from '#pages/AdminModels';

const mockAdminModel: AdminModelExtended = {
  modelId: 'model-abc123',
  name: 'CenterlineTracker-v2',
  username: 'jaime.muniz',
  profileId: 'profile-001',
  status: ModelStatus.READY,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  optimizationStatus: OptimizationStatus.OPTIMIZED,
  createdAt: new Date('2026-06-04T10:38:35Z'),
  metadata: {
    agentAlgorithm: 'PPO',
    sensors: { camera: 'FRONT_FACING_CAMERA' },
    actionSpace: {
      discrete: [
        { speed: 1.0, steeringAngle: 0 },
        { speed: 0.8, steeringAngle: -15 },
      ],
    },
  },
};

const mockAdminModel2: AdminModelExtended = {
  modelId: 'model-def456',
  name: 'SteeringPenalty-v1',
  username: 'smartin',
  profileId: 'profile-002',
  status: ModelStatus.READY,
  modelSource: ModelSource.TRAINED,
  optimizationStatus: OptimizationStatus.OPTIMIZED,
  createdAt: new Date('2026-06-03T08:44:34Z'),
  metadata: {
    agentAlgorithm: 'SAC',
    sensors: { camera: 'FRONT_FACING_CAMERA', lidar: 'LIDAR' },
    actionSpace: { continous: { lowSpeed: 0.5, highSpeed: 4.0, lowSteeringAngle: -30, highSteeringAngle: 30 } },
  },
};

const mockAdminModelImporting: AdminModelExtended = {
  modelId: 'model-ghi789',
  name: 'NewUpload-pending',
  username: 'MiguelEstatut',
  profileId: 'profile-003',
  status: ModelStatus.IMPORTING,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  createdAt: new Date('2026-06-04T12:00:00Z'),
};

const mockAdminModelFailed: AdminModelExtended = {
  modelId: 'model-jkl012',
  name: 'CorruptArchive',
  username: 'Piyot',
  profileId: 'profile-004',
  status: ModelStatus.ERROR,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  importErrorMessage:
    'Invalid physical model archive — missing required entries: model_metadata.json (checked root and agent/)',
  createdAt: new Date('2026-06-04T11:00:00Z'),
};

const mockAdminModelOptimizing: AdminModelExtended = {
  modelId: 'model-mno345',
  name: 'ThrottlePenalty-v3',
  username: 'jaime.muniz',
  profileId: 'profile-001',
  status: ModelStatus.READY,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  optimizationStatus: OptimizationStatus.IN_PROGRESS,
  createdAt: new Date('2026-06-04T09:00:00Z'),
  metadata: {
    agentAlgorithm: 'PPO',
    sensors: { camera: 'FRONT_FACING_CAMERA' },
    actionSpace: { discrete: [{ speed: 1.0, steeringAngle: 0 }] },
  },
};

const mockAdminModelOptimizationFailed: AdminModelExtended = {
  modelId: 'model-stu901',
  name: 'BadSensor-v1',
  username: 'Piyot',
  profileId: 'profile-004',
  status: ModelStatus.READY,
  modelSource: ModelSource.TRAINED,
  optimizationStatus: OptimizationStatus.FAILED,
  optimizationErrorMessage: 'Unrecognized sensor value in model_metadata.json: INVALID_SENSOR_XYZ',
  createdAt: new Date('2026-06-03T16:30:00Z'),
  metadata: {
    agentAlgorithm: 'PPO',
    sensors: { camera: 'FRONT_FACING_CAMERA' },
    actionSpace: { discrete: [{ speed: 1.0, steeringAngle: 0 }] },
  },
};

const mockAdminModelNotOptimized: AdminModelExtended = {
  modelId: 'model-pqr678',
  name: 'WideAngle-v1',
  username: 'smartin',
  profileId: 'profile-002',
  status: ModelStatus.READY,
  modelSource: ModelSource.TRAINED,
  optimizationStatus: undefined,
  createdAt: new Date('2026-06-02T14:20:00Z'),
  metadata: {
    agentAlgorithm: 'PPO',
    sensors: { camera: 'FRONT_FACING_CAMERA' },
    actionSpace: { discrete: [{ speed: 1.0, steeringAngle: 0 }] },
  },
};

const meta = {
  component: AdminModels,
  title: 'pages/AdminModels',
} satisfies Meta<typeof AdminModels>;

export default meta;

type Story = StoryObj<typeof AdminModels>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListAdminModelsCommand).resolves({
        models: [
          mockAdminModel,
          mockAdminModel2,
          mockAdminModelNotOptimized,
          mockAdminModelOptimizationFailed,
          mockAdminModelImporting,
          mockAdminModelFailed,
          mockAdminModelOptimizing,
        ],
      });
    },
  },
};

export const Loading: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListAdminModelsCommand).callsFake(
        () =>
          new Promise(() => {
            /* never resolves — loading state */
          }),
      );
    },
  },
};

export const Empty: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListAdminModelsCommand).resolves({ models: [] });
    },
  },
};

export const WithModels: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListAdminModelsCommand).resolves({
        models: [mockAdminModel, mockAdminModel2],
      });
    },
  },
};

export const WithPhysicalModels: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListAdminModelsCommand).resolves({
        models: [mockAdminModel, mockAdminModelImporting, mockAdminModelFailed, mockAdminModelOptimizing],
      });
    },
  },
};
