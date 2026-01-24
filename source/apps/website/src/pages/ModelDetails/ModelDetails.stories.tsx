// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  GetEvaluationCommand,
  GetModelCommand,
  ListEvaluationsCommand,
  GetAssetUrlCommand,
  NotFoundError,
  ModelStatus,
} from '@deepracer-indy/typescript-client';
import type { Meta, Parameters, StoryObj } from '@storybook/react';

import {
  mockEvaluationCompleted,
  mockEvaluationInitializing,
  mockEvaluationInProgress,
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
