// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DeleteModelCommand,
  GetEvaluationCommand,
  GetModelCommand,
  ListEvaluationsCommand,
  GetAssetUrlCommand,
  NotFoundError,
  ModelStatus,
  JobStatus,
  RetryTrainingCommand,
} from '@deepracer-indy/typescript-client';
import type { Meta, Parameters, StoryObj } from '@storybook/react';
import { screen, userEvent } from '@storybook/test';

import {
  mockEvaluationCompleted,
  mockEvaluationInitializing,
  mockEvaluationInProgress,
  mockModel,
  mockModel3,
} from '#constants/testConstants.js';
import ModelDetails from '#pages/ModelDetails';

import * as EvaluationTabStories from './components/EvaluationTab/EvaluationTab.stories';
import * as TrainingDetailsStories from './components/TrainingTab/TrainingDetails/TrainingDetails.stories';

const meta = {
  component: ModelDetails,
  title: 'pages/ModelDetails',
  parameters: {
    msw: {
      handlers: {
        trainingMetrics: TrainingDetailsStories.default.parameters?.msw?.handlers?.trainingMetrics,
      },
    },
  },
} satisfies Meta<typeof ModelDetails>;

export default meta;

type Story = StoryObj<typeof ModelDetails>;

export const TrainingInitializing: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: TrainingDetailsStories.TrainingInitializing.args?.model });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const TrainingInProgress: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: TrainingDetailsStories.TrainingInProgress.args?.model });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const TrainingCompleted: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: TrainingDetailsStories.TrainingCompleted.args?.model });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const TrainingCompletedWithMinEvalTrials: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({
        model: {
          ...mockModel,
          status: ModelStatus.READY,
          trainingStatus: JobStatus.COMPLETED,
          trainingVideoStreamUrl: undefined,
          trainingConfig: { ...mockModel.trainingConfig, minEvalTrials: 3 },
        },
      });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const TrainingCompletedAndReadyForDownload: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: TrainingDetailsStories.TrainingCompleted.args?.model });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
      mockClient.on(GetAssetUrlCommand).resolves({ url: 'https://example.com/model.zip' });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const TrainingCompletedAndModelQueued: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: TrainingDetailsStories.TrainingCompleted.args?.model });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
      mockClient.on(GetAssetUrlCommand).resolves({ status: ModelStatus.QUEUED });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const ModelNotFound: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).rejects(new NotFoundError({ message: 'Item not found', $metadata: {} }));
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const ModelWithImportError: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: mockModel3 });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

const commonEvaluationApiMocks: Parameters['deepRacerApiMocks'] = (mockClient) => {
  TrainingCompleted.parameters?.deepRacerApiMocks?.(mockClient);
  mockClient
    .on(GetEvaluationCommand, { evaluationId: mockEvaluationCompleted.evaluationId })
    .resolves({ evaluation: mockEvaluationCompleted });
  mockClient
    .on(GetEvaluationCommand, { evaluationId: mockEvaluationInProgress.evaluationId })
    .resolves({ evaluation: mockEvaluationInProgress });
  mockClient
    .on(GetEvaluationCommand, { evaluationId: mockEvaluationInitializing.evaluationId })
    .resolves({ evaluation: mockEvaluationInitializing });
};

export const EvaluationInitializing: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      commonEvaluationApiMocks(mockClient);
      mockClient
        .on(ListEvaluationsCommand)
        .resolves({ evaluations: EvaluationTabStories.EvaluationInitializing.args?.evaluations });
    },
  },
};

export const EvaluationInProgress: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      commonEvaluationApiMocks(mockClient);
      mockClient
        .on(ListEvaluationsCommand)
        .resolves({ evaluations: EvaluationTabStories.EvaluationInProgress.args?.evaluations });
    },
  },
};

export const EvaluationCompleted: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      commonEvaluationApiMocks(mockClient);
      mockClient
        .on(ListEvaluationsCommand)
        .resolves({ evaluations: EvaluationTabStories.EvaluationCompleted.args?.evaluations });
    },
  },
};

export const ModelQueued: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: { ...mockModel3, status: ModelStatus.QUEUED } });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const ModelImporting: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: { ...mockModel3, status: ModelStatus.IMPORTING } });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const WithSubmissionSuccess: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: TrainingDetailsStories.TrainingCompleted.args?.model });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
    routing: {
      componentRoute: '/models/:modelId',
      initialRouteEntries: [
        { pathname: '/models/test-model-id', state: { successMessage: 'Model submitted successfully!' } },
      ],
    },
  },
};

const deleteModalApiMocks: Parameters['deepRacerApiMocks'] = (mockClient) => {
  TrainingCompleted.parameters?.deepRacerApiMocks?.(mockClient);
  mockClient.on(DeleteModelCommand).resolves({});
};

const openDeleteModal = async () => {
  const actionsButton = await screen.findByText('Actions');
  await userEvent.click(actionsButton);
  const deleteOption = await screen.findByRole('menuitem', { name: 'Delete' });
  await userEvent.click(deleteOption);
};

export const DeleteModalOpens: Story = {
  parameters: { deepRacerApiMocks: deleteModalApiMocks },
  play: async () => {
    await openDeleteModal();
  },
};

export const DeleteModelFails: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      TrainingCompleted.parameters?.deepRacerApiMocks?.(mockClient);
      mockClient.on(DeleteModelCommand).rejects(new Error('Delete failed'));
    },
  },
  play: async () => {
    await openDeleteModal();
  },
};

export const PhysicalModelReady: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({
        model: {
          ...mockModel,
          name: 'my-physical-model',
          status: ModelStatus.READY,
          trainingStatus: JobStatus.COMPLETED,
          modelSource: 'IMPORTED_PHYSICAL',
          optimizationStatus: 'OPTIMIZED',
          metadata: {
            ...mockModel.metadata,
            agentAlgorithm: 'PPO',
            sensors: { camera: 'FRONT_FACING_CAMERA' },
            actionSpace: {
              discrete: [
                { speed: 0.5, steeringAngle: -30 },
                { speed: 1, steeringAngle: 0 },
              ],
            },
          },
        },
      });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const PhysicalModelImporting: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({
        model: {
          ...mockModel,
          name: 'importing-physical',
          status: ModelStatus.IMPORTING,
          trainingStatus: JobStatus.COMPLETED,
          modelSource: 'IMPORTED_PHYSICAL',
          metadata: {
            ...mockModel.metadata,
          },
        },
      });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

export const PhysicalModelError: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({
        model: {
          ...mockModel,
          name: 'failed-physical',
          status: ModelStatus.ERROR,
          trainingStatus: JobStatus.COMPLETED,
          modelSource: 'IMPORTED_PHYSICAL',
          importErrorMessage: 'Malware detected in uploaded file',
          metadata: {
            ...mockModel.metadata,
          },
        },
      });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

const waitingForCapacityModel = {
  ...mockModel3,
  status: ModelStatus.WAITING_FOR_CAPACITY,
  trainingStatus: JobStatus.WAITING_FOR_CAPACITY,
  statusMessage: 'Training capacity is not available. Please try again later.',
};

export const ModelWaitingForCapacity: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      mockClient.on(GetModelCommand).resolves({ model: waitingForCapacityModel });
      mockClient.on(ListEvaluationsCommand).resolves({ evaluations: [] });
    },
  },
};

const openRetryTrainingModal = async () => {
  // The header trigger button and the modal's confirm button share the same accessible name; the
  // modal is present-but-hidden in the DOM even before it's opened. The trigger renders first.
  const [retryButton] = await screen.findAllByRole('button', { name: 'Retry training' });
  await userEvent.click(retryButton);
};

export const RetryTrainingModalOpens: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      ModelWaitingForCapacity.parameters?.deepRacerApiMocks?.(mockClient);
    },
  },
  play: async () => {
    await openRetryTrainingModal();
  },
};

export const RetryTrainingSucceeds: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      ModelWaitingForCapacity.parameters?.deepRacerApiMocks?.(mockClient);
      mockClient.on(RetryTrainingCommand).resolves({
        modelId: waitingForCapacityModel.modelId,
        status: ModelStatus.QUEUED,
        message: 'Training job dispatched successfully.',
      });
    },
  },
  play: async () => {
    await openRetryTrainingModal();
  },
};

export const RetryTrainingStillWaiting: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      ModelWaitingForCapacity.parameters?.deepRacerApiMocks?.(mockClient);
      mockClient.on(RetryTrainingCommand).resolves({
        modelId: waitingForCapacityModel.modelId,
        status: ModelStatus.WAITING_FOR_CAPACITY,
        message: 'Training capacity is still not available.',
      });
    },
  },
  play: async () => {
    await openRetryTrainingModal();
  },
};

export const RetryTrainingFails: Story = {
  parameters: {
    deepRacerApiMocks: (mockClient) => {
      ModelWaitingForCapacity.parameters?.deepRacerApiMocks?.(mockClient);
      mockClient.on(RetryTrainingCommand).rejects(new Error('Retry failed'));
    },
  },
  play: async () => {
    await openRetryTrainingModal();
  },
};
