// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  TEST_EVALUATION_ITEM,
  TEST_MODEL_ITEM,
  TEST_PROFILE_ITEM,
  TEST_SUBMISSION_ITEM,
  TEST_TRAINING_ITEM,
  TEST_TRAINING_ITEM_OA,
  TEST_EVALUATION_ITEM_OA,
} from '@deepracer-indy/database';
import { CarColor, CarShell, RaceType } from '@deepracer-indy/typescript-server-client';

import { trackHelper } from '../../../utils/TrackHelper.js';
import { simulationEnvironmentHelper } from '../SimulationEnvironmentHelper.js';
import { workflowHelper } from '../WorkflowHelper.js';

vi.mock('../WorkflowHelper.js', () => ({
  workflowHelper: {
    isEvaluation: vi.fn(),
    isSubmission: vi.fn(),
    isTraining: vi.fn(),
  },
}));

vi.mock('../../../utils/TrackHelper.js', () => ({
  trackHelper: {
    hasSingleEnabledDirection: vi.fn(),
  },
}));

const MOCK_ACCOUNT_ID = '123456789012';

describe('SimulationEnvironmentHelper', () => {
  beforeEach(() => {
    process.env.ACCOUNT_ID = MOCK_ACCOUNT_ID;
    vi.mocked(trackHelper.hasSingleEnabledDirection).mockReturnValue(false);
  });

  afterEach(() => {
    delete process.env.ACCOUNT_ID;
  });

  describe('getSimulationEnvironmentVariables() - training job', () => {
    beforeEach(() => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(false);
      vi.mocked(workflowHelper.isSubmission).mockReturnValue(false);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(true);
    });

    it('should return common env vars for a training job', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result).toMatchObject({
        AWS_REGION: 'us-east-1',
        ROBOMAKER_SIMULATION_JOB_ACCOUNT_ID: MOCK_ACCOUNT_ID,
        JOB_TYPE: 'TRAINING',
        KINESIS_VIDEO_STREAM_NAME: TEST_TRAINING_ITEM.name,
        MODEL_NAME: TEST_MODEL_ITEM.name,
        RACER_NAME: TEST_PROFILE_ITEM.alias,
        WORLD_NAME: TEST_TRAINING_ITEM.trackConfig.trackId,
        RACE_TYPE: RaceType.TIME_TRIAL,
      });
    });

    it('should include training-specific variables', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result).toMatchObject({
        ALTERNATE_DRIVING_DIRECTION: false,
        CHANGE_START_POSITION: true,
        METRIC_NAME: 'TrainingRewardScore',
        METRIC_NAMESPACE: 'DeepRacerIndy',
        REWARD_FILE_S3_KEY: expect.any(String),
        MODEL_METADATA_FILE_S3_KEY: expect.any(String),
        SAGEMAKER_SHARED_S3_BUCKET: expect.any(String),
        SAGEMAKER_SHARED_S3_PREFIX: expect.any(String),
      });
    });

    it('should set VIDEO_JOB_TYPE to TRAINING for training jobs', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.VIDEO_JOB_TYPE).toBe('TRAINING');
    });

    it('should set MIN_EVAL_TRIALS from the training job item', async () => {
      const trainingItemWithMinEvalTrials = { ...TEST_TRAINING_ITEM, minEvalTrials: 3 };

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        trainingItemWithMinEvalTrials,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.MIN_EVAL_TRIALS).toBe(3);
    });

    it('should not include MP4_S3_BUCKET or MP4_S3_OBJECT_PREFIX for training jobs', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.MP4_S3_BUCKET).toBeUndefined();
      expect(result.MP4_S3_OBJECT_PREFIX).toBeUndefined();
    });
  });

  describe('getSimulationEnvironmentVariables() - evaluation job', () => {
    beforeEach(() => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(true);
      vi.mocked(workflowHelper.isSubmission).mockReturnValue(false);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(false);
    });

    it('should include evaluation-specific variables', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_EVALUATION_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result).toMatchObject({
        MP4_S3_BUCKET: expect.any(String),
        MP4_S3_OBJECT_PREFIX: expect.any(String),
        MODEL_S3_BUCKET: expect.any(String),
        MODEL_S3_PREFIX: expect.any(String),
        NUMBER_OF_TRIALS: TEST_EVALUATION_ITEM.terminationConditions.maxLaps,
      });
    });

    it('should include resetting behavior config', async () => {
      const evalItem = {
        ...TEST_EVALUATION_ITEM,
        resettingBehaviorConfig: {
          continuousLap: true,
          offTrackPenaltySeconds: 2,
          collisionPenaltySeconds: 3,
        },
      };

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        evalItem,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result).toMatchObject({
        NUMBER_OF_RESETS: 10_000,
        OFF_TRACK_PENALTY: 2,
        COLLISION_PENALTY: 3,
        IS_CONTINUOUS: true,
      });
    });
  });

  describe('getSimulationEnvironmentVariables() - submission job', () => {
    beforeEach(() => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(false);
      vi.mocked(workflowHelper.isSubmission).mockReturnValue(true);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(false);
    });

    it('should set VIDEO_JOB_TYPE to RACING for submissions', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_SUBMISSION_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.VIDEO_JOB_TYPE).toBe('RACING');
    });

    it('should include MP4_S3_BUCKET and MP4_S3_OBJECT_PREFIX for submissions', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_SUBMISSION_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result).toMatchObject({
        MP4_S3_BUCKET: expect.any(String),
        MP4_S3_OBJECT_PREFIX: expect.any(String),
      });
    });
  });

  describe('car customization', () => {
    beforeEach(() => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(false);
      vi.mocked(workflowHelper.isSubmission).mockReturnValue(false);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(true);
    });

    it('should set BODY_SHELL_TYPE for non-deepracer shells', async () => {
      // TEST_MODEL_ITEM uses CarShell.MARS_ROVER + CarColor.WHITE = 'f1_mars_rover_with_wheel'
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.BODY_SHELL_TYPE).toBe('f1_mars_rover_with_wheel');
      expect(result.CAR_COLOR).toBeUndefined();
    });

    it('should set CAR_COLOR in sentence case for deepracer shell with valid color', async () => {
      const modelItem = {
        ...TEST_MODEL_ITEM,
        carCustomization: { carShell: CarShell.DEEPRACER, carColor: CarColor.BLACK },
      };

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        modelItem,
        TEST_PROFILE_ITEM,
      );

      expect(result.BODY_SHELL_TYPE).toBe('deepracer');
      expect(result.CAR_COLOR).toBe('Black');
    });

    it('should default CAR_COLOR for deepracer shell with invalid color', async () => {
      const modelItem = {
        ...TEST_MODEL_ITEM,
        carCustomization: { carShell: CarShell.DEEPRACER, carColor: CarColor.GOLDEN },
      };

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        modelItem,
        TEST_PROFILE_ITEM,
      );

      expect(result.BODY_SHELL_TYPE).toBe('deepracer');
      expect(result.CAR_COLOR).toBe('Black');
    });
  });

  describe('track direction', () => {
    beforeEach(() => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(false);
      vi.mocked(workflowHelper.isSubmission).mockReturnValue(false);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(true);
    });

    it('should set TRACK_DIRECTION_CLOCKWISE for multi-direction tracks', async () => {
      vi.mocked(trackHelper.hasSingleEnabledDirection).mockReturnValue(false);

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.TRACK_DIRECTION_CLOCKWISE).toBeFalsy();
      // expect(result.TRACK_DIRECTION_CLOCKWISE).toEqual(
      //   TEST_TRAINING_ITEM.trackConfig.trackDirection === TrackDirection.CLOCKWISE,
      // );
    });

    it('should set TRACK_DIRECTION_CLOCKWISE to undefined for single-direction tracks', async () => {
      vi.mocked(trackHelper.hasSingleEnabledDirection).mockReturnValue(true);

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.TRACK_DIRECTION_CLOCKWISE).toBeUndefined();
    });
  });

  describe('object avoidance', () => {
    beforeEach(() => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(false);
      vi.mocked(workflowHelper.isSubmission).mockReturnValue(false);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(true);
    });

    it('should add object avoidance config for OA race type', async () => {
      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        TEST_TRAINING_ITEM_OA,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result).toMatchObject({
        OBSTACLE_TYPE: 'box_obstacle',
        IS_OBSTACLE_BOT_CAR: false,
        NUMBER_OF_OBSTACLES: 5,
        RANDOMIZE_OBSTACLE_LOCATIONS: true,
      });
    });

    it('should use defined obstacle positions when provided and count matches', async () => {
      vi.mocked(workflowHelper.isEvaluation).mockReturnValue(true);
      vi.mocked(workflowHelper.isTraining).mockReturnValue(false);

      const evalItem = {
        ...TEST_EVALUATION_ITEM_OA,
        objectAvoidanceConfig: {
          numberOfObjects: 2,
          objectPositions: [
            { laneNumber: -1, trackPercentage: 0.1 },
            { laneNumber: 1, trackPercentage: 0.5 },
          ],
        },
      };

      const result = await simulationEnvironmentHelper.getSimulationEnvironmentVariables(
        evalItem,
        TEST_MODEL_ITEM,
        TEST_PROFILE_ITEM,
      );

      expect(result.RANDOMIZE_OBSTACLE_LOCATIONS).toBe(false);
      expect(result.OBJECT_POSITIONS).toEqual(['0.1, -1', '0.5, 1']);
    });
  });
});
