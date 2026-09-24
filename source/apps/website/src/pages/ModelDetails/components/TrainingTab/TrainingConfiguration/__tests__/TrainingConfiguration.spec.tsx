// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Model, ModelSource, ModelStatus } from '@deepracer-indy/typescript-client';
import { userEvent } from '@storybook/test';

import i18n from '#i18n';
import { render, screen } from '#utils/testUtils';

import TrainingConfiguration from '../TrainingConfiguration';

const baseModel = {
  modelId: 'test-model-id',
  name: 'TestModel',
  status: ModelStatus.READY,
  createdAt: new Date(),
  metadata: {
    agentAlgorithm: 'PPO',
    sensors: { camera: 'FRONT_FACING_CAMERA' },
    rewardFunction: 'def reward_function(params):\n    return 1.0',
    hyperparameters: {} as never,
    actionSpace: {
      continous: { lowSpeed: 0.5, highSpeed: 2.0, lowSteeringAngle: -30, highSteeringAngle: 30 },
    },
  },
  trainingConfig: {
    maxTimeInMinutes: 60,
    minEvalTrials: 5,
    raceType: 'TIME_TRIAL',
    trackConfig: { trackId: 'reInvent2019_wide', trackDirection: 'CLOCKWISE' },
  },
} as unknown as Model;

const physicalModel = {
  ...baseModel,
  modelSource: ModelSource.IMPORTED_PHYSICAL,
  metadata: {
    agentAlgorithm: 'SAC',
    sensors: { camera: 'FRONT_FACING_CAMERA' },
    rewardFunction: '',
    hyperparameters: {} as never,
    actionSpace: {
      continous: { lowSpeed: 1, highSpeed: 2, lowSteeringAngle: -10, highSteeringAngle: 10 },
    },
  },
  trainingConfig: {
    maxTimeInMinutes: 0,
    minEvalTrials: 5,
    raceType: 'TIME_TRIAL',
    trackConfig: { trackId: 'reInvent2019_wide', trackDirection: 'CLOCKWISE' },
  },
} as unknown as Model;

describe('TrainingConfiguration', () => {
  describe('Reward Function Modal', () => {
    it('should open reward function modal when button is clicked', async () => {
      render(<TrainingConfiguration model={baseModel} />);

      const showButton = screen.getByRole('button', {
        name: i18n.t('modelDetails:trainingConfiguration.showRewardFunctionButton'),
      });
      await userEvent.click(showButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('should close reward function modal on dismiss', async () => {
      render(<TrainingConfiguration model={baseModel} />);

      const showButton = screen.getByRole('button', {
        name: i18n.t('modelDetails:trainingConfiguration.showRewardFunctionButton'),
      });
      await userEvent.click(showButton);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();

      // Cloudscape Modal dismiss is the X button (empty text, not the "Show" button)
      const allButtons = screen.getAllByRole('button');
      const dismissBtn = allButtons.find((b) => b !== showButton && b.textContent === '');
      expect(dismissBtn).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await userEvent.click(dismissBtn!);

      // Cloudscape hides via CSS class rather than removing from DOM
      expect(dialog.className).toContain('hidden');
    });

    it('should not render reward function modal for physical models', () => {
      render(<TrainingConfiguration model={physicalModel} />);

      expect(
        screen.queryByRole('button', { name: i18n.t('modelDetails:trainingConfiguration.showRewardFunctionButton') }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('Physical model conditionals', () => {
    it('should not render first KVP section (race type, track, training time) for physical models', () => {
      render(<TrainingConfiguration model={physicalModel} />);

      expect(screen.queryByText(/time trial/i)).not.toBeInTheDocument();
    });

    it('should render agent algorithm for physical models with metadata', () => {
      render(<TrainingConfiguration model={physicalModel} />);

      expect(screen.getByText('SAC')).toBeInTheDocument();
    });

    it('should not render hyperparameters table for physical models', () => {
      const modelWithHyperparams: Model = {
        ...physicalModel,
        metadata: {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...physicalModel.metadata!,
          hyperparameters: { batchSize: 64, learningRate: 0.001 } as never,
        },
      };
      render(<TrainingConfiguration model={modelWithHyperparams} />);

      expect(screen.queryByText(/batch/i)).not.toBeInTheDocument();
    });
  });

  describe('Virtual model rendering', () => {
    it('should render race type, track, and training time for virtual models', () => {
      render(<TrainingConfiguration model={baseModel} />);

      expect(screen.getByText('PPO')).toBeInTheDocument();
    });

    it('should render show reward function button for virtual models', () => {
      render(<TrainingConfiguration model={baseModel} />);

      expect(
        screen.getByRole('button', { name: i18n.t('modelDetails:trainingConfiguration.showRewardFunctionButton') }),
      ).toBeInTheDocument();
    });
  });
});
