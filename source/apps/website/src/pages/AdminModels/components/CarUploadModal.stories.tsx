// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  AdminModelExtended,
  DeploymentStatus,
  ListAdminModelsCommand,
  ListDeploymentsByBatchCommand,
  ListDevicesCommand,
  ListEventsCommand,
  ModelSource,
  ModelStatus,
  OptimizationStatus,
} from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import CarUploadModal from './CarUploadModal.js';

const mockModels: AdminModelExtended[] = [
  {
    modelId: 'model-abc123',
    name: 'CenterlineTracker-v2',
    username: 'jaime.muniz',
    profileId: 'profile-001',
    status: ModelStatus.READY,
    modelSource: ModelSource.IMPORTED_PHYSICAL,
    optimizationStatus: OptimizationStatus.OPTIMIZED,
    createdAt: new Date('2026-06-04T10:38:35Z'),
  },
  {
    modelId: 'model-def456',
    name: 'SteeringPenalty-v1',
    username: 'smartin',
    profileId: 'profile-002',
    status: ModelStatus.READY,
    modelSource: ModelSource.TRAINED,
    optimizationStatus: OptimizationStatus.OPTIMIZED,
    createdAt: new Date('2026-06-03T08:44:34Z'),
  },
];

const Wrapper = () => {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <CarUploadModal visible={visible} models={mockModels} onDismiss={() => setVisible(false)} />
      {!visible && <button onClick={() => setVisible(true)}>Reopen modal</button>}
    </>
  );
};

const meta = {
  component: Wrapper,
  title: 'pages/AdminModels/CarUploadModal',
} satisfies Meta<typeof Wrapper>;

export default meta;

type Story = StoryObj<typeof Wrapper>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({
        devices: [
          {
            instanceId: 'mi-0a1b2c3d4e5f67890',
            name: 'Car-London-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date('2026-05-01T10:00:00Z'),
            fleetId: 'FLEET00000000001',
          },
          {
            instanceId: 'mi-1b2c3d4e5f678901',
            name: 'Car-London-02',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date('2026-05-02T10:00:00Z'),
            fleetId: 'FLEET00000000001',
          },
          {
            instanceId: 'mi-2c3d4e5f67890123',
            name: 'Car-NYC-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date('2026-05-03T10:00:00Z'),
            fleetId: 'FLEET00000000002',
          },
        ],
      });
      mockClient.on(ListEventsCommand).resolves({
        events: [
          { eventId: 'EVT00000000001', name: 'London Summit 2026', createdAt: new Date() },
          { eventId: 'EVT00000000002', name: 'NYC Workshop July', createdAt: new Date() },
          { eventId: 'EVT00000000003', name: 'Seattle Demo Day', createdAt: new Date() },
        ] as never,
      });
      mockClient.on(ListAdminModelsCommand).resolves({ models: mockModels });
    },
  },
};

export const NoCarsOnline: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({ devices: [] });
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'EVT00000000001', name: 'London Summit 2026', createdAt: new Date() }] as never,
      });
    },
  },
};

export const NoEvents: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({
        devices: [
          {
            instanceId: 'mi-0a1b2c3d4e5f67890',
            name: 'Car-London-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date(),
          },
        ],
      });
      mockClient.on(ListEventsCommand).resolves({ events: [] });
    },
  },
};

export const Uploading: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({
        devices: [
          {
            instanceId: 'mi-0a1b2c3d4e5f67890',
            name: 'Car-London-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date(),
          },
        ],
      });
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'EVT00000000001', name: 'London Summit 2026', createdAt: new Date() }] as never,
      });
      // NOTE: reaching the progress view requires driving the modal through car
      // selection + confirm via a play function; this mock is in place for when
      // that interaction is added, but this story currently only exercises the
      // car-selection view (same as Default). See CarUploadModal.tsx `handleDeploy`.
      mockClient.on(ListDeploymentsByBatchCommand).resolves({
        deployments: [
          {
            deploymentId: 'deploy-001',
            modelId: 'model-abc123',
            modelName: 'CenterlineTracker-v2',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.IN_PROGRESS,
            createdAt: new Date(),
          },
          {
            deploymentId: 'deploy-002',
            modelId: 'model-def456',
            modelName: 'SteeringPenalty-v1',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.PENDING,
            createdAt: new Date(),
          },
        ],
      });
    },
  },
};

export const AllComplete: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({
        devices: [
          {
            instanceId: 'mi-0a1b2c3d4e5f67890',
            name: 'Car-London-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date(),
          },
        ],
      });
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'EVT00000000001', name: 'London Summit 2026', createdAt: new Date() }] as never,
      });
      // NOTE: see Uploading story above — reaching the progress view requires a
      // play function to drive car selection + confirm. Mock in place for that.
      mockClient.on(ListDeploymentsByBatchCommand).resolves({
        deployments: [
          {
            deploymentId: 'deploy-001',
            modelId: 'model-abc123',
            modelName: 'CenterlineTracker-v2',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.COMPLETED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
          },
          {
            deploymentId: 'deploy-002',
            modelId: 'model-def456',
            modelName: 'SteeringPenalty-v1',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.COMPLETED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
          },
        ],
      });
    },
  },
};

export const PartialFailure: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({
        devices: [
          {
            instanceId: 'mi-0a1b2c3d4e5f67890',
            name: 'Car-London-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date(),
          },
        ],
      });
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'EVT00000000001', name: 'London Summit 2026', createdAt: new Date() }] as never,
      });
      mockClient.on(ListDeploymentsByBatchCommand).resolves({
        deployments: [
          {
            deploymentId: 'deploy-001',
            modelId: 'model-abc123',
            modelName: 'CenterlineTracker-v2',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.COMPLETED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
          },
          {
            deploymentId: 'deploy-002',
            modelId: 'model-def456',
            modelName: 'test-model',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.FAILED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
            errorMessage: 'tar (child): /tmp/test-model.tar.gz: Cannot open: No such file or directory',
          },
          {
            deploymentId: 'deploy-003',
            modelId: 'model-ghi789',
            modelName: 'SpeedDemon-v3',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.COMPLETED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
          },
        ],
      });
    },
  },
};

export const AllFailed: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListDevicesCommand).resolves({
        devices: [
          {
            instanceId: 'mi-0a1b2c3d4e5f67890',
            name: 'Car-London-01',
            deviceType: 'CAR',
            status: 'ONLINE',
            activatedAt: new Date(),
          },
        ],
      });
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'EVT00000000001', name: 'London Summit 2026', createdAt: new Date() }] as never,
      });
      // NOTE: see Uploading story above — reaching the progress view requires a
      // play function to drive car selection + confirm. Mock in place for that.
      mockClient.on(ListDeploymentsByBatchCommand).resolves({
        deployments: [
          {
            deploymentId: 'deploy-001',
            modelId: 'model-abc123',
            modelName: 'CenterlineTracker-v2',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.FAILED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
          },
          {
            deploymentId: 'deploy-002',
            modelId: 'model-def456',
            modelName: 'SteeringPenalty-v1',
            carInstanceId: 'mi-0a1b2c3d4e5f67890',
            carName: 'Car-London-01',
            status: DeploymentStatus.FAILED,
            createdAt: new Date(),
            uploadStartedAt: new Date(),
            completedAt: new Date(),
          },
        ],
      });
    },
  },
};
