// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DeploymentStatus,
  DeploymentSummary,
  ListDeploymentsByEventCommand,
  ListEventsCommand,
} from '@deepracer-indy/typescript-client';
import type { Meta, StoryObj } from '@storybook/react';

import UploadStatus from '#pages/UploadStatus';

const now = new Date('2026-08-15T14:30:00Z');

const mockDeployments: DeploymentSummary[] = [
  {
    deploymentId: 'deploy-001',
    modelId: 'model-1',
    modelName: 'CenterlineTracker-v2',
    carInstanceId: 'i-abc001',
    carName: 'Car-Alpha',
    batchId: 'batch-001',
    status: DeploymentStatus.COMPLETED,
    createdAt: new Date('2026-08-15T10:00:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:00:05Z'),
    completedAt: new Date('2026-08-15T10:00:12Z'),
  },
  {
    deploymentId: 'deploy-002',
    modelId: 'model-2',
    modelName: 'SteeringPenalty-v1',
    carInstanceId: 'i-abc002',
    carName: 'Car-Beta',
    batchId: 'batch-001',
    status: DeploymentStatus.COMPLETED,
    createdAt: new Date('2026-08-15T10:00:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:00:04Z'),
    completedAt: new Date('2026-08-15T10:00:38Z'),
  },
  {
    deploymentId: 'deploy-003',
    modelId: 'model-3',
    modelName: 'ThrottlePenalty-v3',
    carInstanceId: 'i-abc003',
    carName: 'Car-Gamma',
    batchId: 'batch-001',
    status: DeploymentStatus.IN_PROGRESS,
    createdAt: new Date('2026-08-15T10:05:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:05:03Z'),
  },
  {
    deploymentId: 'deploy-004',
    modelId: 'model-1',
    modelName: 'CenterlineTracker-v2',
    carInstanceId: 'i-abc004',
    carName: 'Car-Delta',
    batchId: 'batch-002',
    status: DeploymentStatus.COMPLETED,
    createdAt: new Date('2026-08-15T10:10:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:10:02Z'),
    completedAt: new Date('2026-08-15T10:12:55Z'),
  },
  {
    deploymentId: 'deploy-005',
    modelId: 'model-4',
    modelName: 'SpeedDemon-PPO',
    carInstanceId: 'i-abc001',
    carName: 'Car-Alpha',
    batchId: 'batch-002',
    status: DeploymentStatus.COMPLETED,
    createdAt: new Date('2026-08-15T10:10:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:10:03Z'),
    completedAt: new Date('2026-08-15T10:10:08Z'),
  },
  {
    deploymentId: 'deploy-006',
    modelId: 'model-5',
    modelName: 'WideAngle-SAC',
    carInstanceId: 'i-abc002',
    carName: 'Car-Beta',
    batchId: 'batch-002',
    status: DeploymentStatus.PENDING,
    createdAt: new Date('2026-08-15T10:15:00Z'),
  },
  {
    deploymentId: 'deploy-007',
    modelId: 'model-6',
    modelName: 'SlowAndSteady',
    carInstanceId: 'i-abc005',
    carName: 'Car-Epsilon',
    status: DeploymentStatus.COMPLETED,
    createdAt: new Date('2026-08-15T10:20:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:20:02Z'),
    completedAt: new Date('2026-08-15T10:22:07Z'),
  },
  {
    deploymentId: 'deploy-008',
    modelId: 'model-2',
    modelName: 'SteeringPenalty-v1',
    carInstanceId: 'i-abc003',
    carName: 'Car-Gamma',
    batchId: 'batch-003',
    status: DeploymentStatus.FAILED,
    createdAt: new Date('2026-08-15T10:25:00Z'),
    uploadStartedAt: new Date('2026-08-15T10:25:04Z'),
    completedAt: new Date('2026-08-15T10:25:50Z'),
    errorMessage: 'tar (child): /tmp/test-model.tar.gz: Cannot open: No such file or directory',
  },
];

const meta: Meta<typeof UploadStatus> = {
  title: 'pages/UploadStatus',
  component: UploadStatus,
};

export default meta;
type Story = StoryObj<typeof UploadStatus>;

export const Default: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListEventsCommand).resolves({
        events: [
          { eventId: 'event-001', name: 'Morning Race', createdAt: new Date() } as any,
          { eventId: 'event-002', name: 'Afternoon Race', createdAt: new Date() } as any,
        ],
      });
      mockClient.on(ListDeploymentsByEventCommand).callsFake((input: { eventId: string }) => {
        if (input.eventId === 'event-002') {
          return {
            eventId: 'event-002',
            deployments: [
              {
                deploymentId: 'deploy-pm-001',
                modelId: 'model-10',
                modelName: 'AfternoonBlitz-PPO',
                carInstanceId: 'i-pm001',
                carName: 'Car-Zeta',
                batchId: 'batch-pm-001',
                status: DeploymentStatus.COMPLETED,
                createdAt: new Date('2026-08-15T15:00:00Z'),
                uploadStartedAt: new Date('2026-08-15T15:00:03Z'),
                completedAt: new Date('2026-08-15T15:00:15Z'),
              },
              {
                deploymentId: 'deploy-pm-002',
                modelId: 'model-11',
                modelName: 'NightOwl-SAC',
                carInstanceId: 'i-pm002',
                carName: 'Car-Eta',
                batchId: 'batch-pm-001',
                status: DeploymentStatus.COMPLETED,
                createdAt: new Date('2026-08-15T15:00:00Z'),
                uploadStartedAt: new Date('2026-08-15T15:00:04Z'),
                completedAt: new Date('2026-08-15T15:01:45Z'),
              },
              {
                deploymentId: 'deploy-pm-003',
                modelId: 'model-12',
                modelName: 'TurboCharge-v2',
                carInstanceId: 'i-pm003',
                carName: 'Car-Theta',
                batchId: 'batch-pm-002',
                status: DeploymentStatus.FAILED,
                createdAt: new Date('2026-08-15T15:10:00Z'),
                uploadStartedAt: new Date('2026-08-15T15:10:02Z'),
                completedAt: new Date('2026-08-15T15:10:30Z'),
                errorMessage: 'curl: (7) Failed to connect to host: Connection refused',
              },
              {
                deploymentId: 'deploy-pm-004',
                modelId: 'model-10',
                modelName: 'AfternoonBlitz-PPO',
                carInstanceId: 'i-pm003',
                carName: 'Car-Theta',
                batchId: 'batch-pm-002',
                status: DeploymentStatus.IN_PROGRESS,
                createdAt: new Date('2026-08-15T15:15:00Z'),
                uploadStartedAt: new Date('2026-08-15T15:15:05Z'),
              },
            ],
          };
        }
        return {
          eventId: 'event-001',
          deployments: mockDeployments,
        };
      });
    },
  },
};

export const Empty: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'event-001', name: 'Morning Race', createdAt: new Date() } as any],
      });
      mockClient.on(ListDeploymentsByEventCommand).resolves({
        eventId: 'event-001',
        deployments: [],
      });
    },
  },
};

export const AllCompleted: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'event-001', name: 'Morning Race', createdAt: new Date() } as any],
      });
      mockClient.on(ListDeploymentsByEventCommand).resolves({
        eventId: 'event-001',
        deployments: mockDeployments
          .filter((d) => d.status === DeploymentStatus.COMPLETED)
          .map((d, i) => ({
            ...d,
            deploymentId: `deploy-comp-${i}`,
          })),
      });
    },
  },
};

export const LargeDataset: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(ListEventsCommand).resolves({
        events: [{ eventId: 'event-001', name: 'Big Event (50 cars)', createdAt: new Date() } as any],
      });
      const largeMock: DeploymentSummary[] = Array.from({ length: 50 }, (_, i) => ({
        deploymentId: `deploy-large-${i}`,
        modelId: `model-${i % 10}`,
        modelName: `Model-${i % 10}-PPO`,
        carInstanceId: `i-car${String(i).padStart(3, '0')}`,
        carName: `Car-${i + 1}`,
        batchId: `batch-${Math.floor(i / 5)}`,
        status: i < 40 ? DeploymentStatus.COMPLETED : i < 45 ? DeploymentStatus.IN_PROGRESS : DeploymentStatus.PENDING,
        createdAt: new Date(now.getTime() - (50 - i) * 30_000),
        uploadStartedAt: i < 45 ? new Date(now.getTime() - (50 - i) * 30_000 + 2_000) : undefined,
        completedAt:
          i < 40 ? new Date(now.getTime() - (50 - i) * 30_000 + 2_000 + (4 + (i % 20) * 8.8) * 1000) : undefined,
      }));
      mockClient.on(ListDeploymentsByEventCommand).resolves({
        eventId: 'event-001',
        deployments: largeMock,
      });
    },
  },
};
