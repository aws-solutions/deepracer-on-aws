// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-explicit-any */
import { AvatarOptionType, DEFAULT_AVATAR } from '@deepracer-indy/config';
import { JobStatus, RaceType, TrackDirection, TrackId } from '@deepracer-indy/typescript-server-client';
import { CustomAttributeType, type Attribute, type Schema } from 'electrodb';

import type { ResourceId } from '../types/resource.js';
import { generateResourceId } from '../utils/resourceUtils.js';
import { s3PathHelper } from '../utils/S3PathHelper.js';

/**
 * Database item attributes.
 */
export enum DynamoDBItemAttribute {
  // Profile attributes
  ALIAS = 'alias',
  AVATAR = 'avatar',
  PROFILE_ID = 'profileId',
  EMAIL_ADDRESS = 'emailAddress',
  MAX_TOTAL_COMPUTE_MINUTES = 'maxTotalComputeMinutes',
  MODEL_COUNT = 'modelCount',
  MAX_MODEL_COUNT = 'maxModelCount',
  MODEL_STORAGE_USAGE = 'modelStorageUsage',
  ROLE_NAME = 'roleName',
  COMPUTE_MINUTES_USED = 'computeMinutesUsed',
  COMPUTE_MINUTES_QUEUED = 'computeMinutesQueued',

  // Common attributes
  PK = 'pk',
  SK = 'sk',
  GSI1_PK = 'gsi1pk',
  GSI1_SK = 'gsi1sk',
  VERSION = 'version',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  DESCRIPTION = 'description',
  NAME = 'name',
  STATUS = 'status',
  TRACK_ID = 'trackId',
  TRACK_DIRECTION = 'trackDirection',
  COLLISION_PENALTY_SECONDS = 'collisionPenaltySeconds',
  MAX_LAPS = 'maxLaps',
  MAX_TIME_IN_MINUTES = 'maxTimeInMinutes',
  NUMBER_OF_OBJECTS = 'numberOfObjects',
  OBJECT_AVOIDANCE_CONFIG = 'objectAvoidanceConfig',
  RESETTING_BEHAVIOR_CONFIG = 'resettingBehaviorConfig',
  RACE_TYPE = 'raceType',
  ASSET_S3_LOCATIONS = 'assetS3Locations',
  VIDEO_STREAM_URL = 'videoStreamUrl',

  // Workflow job shared attributes
  SAGEMAKER_JOB_ARN = 'sageMakerJobArn',
  TERMINATION_CONDITIONS = 'terminationConditions',
  TRACK_CONFIG = 'trackConfig',
  METRICS_S3_LOCATION = 'metricsS3Location',
  SIM_TRACE_S3_LOCATION = 'simTraceS3Location',
  SIMULATION_YAML_S3_LOCATION = 'simulationYamlS3Location',
  SIMULATION_HEARTBEAT_S3_LOCATION = 'simulationHeartbeatS3Location',
  SIMULATION_LOGS_S3_LOCATION = 'simulationLogsS3Location',
  TRAINING_LOGS_S3_LOCATION = 'trainingLogsS3Location',
  LOGS_ARCHIVE_S3_LOCATION = 'logsArchiveS3Location',
  VIDEOS_S3_LOCATION = 'videosS3Location',
  PRIMARY_VIDEO_S3_LOCATION = 'primaryVideoS3Location',
  START_TIME = 'startTime',
  END_TIME = 'endTime',

  // Submission & Ranking shared attributes
  AVG_LAP_TIME = 'avgLapTime',
  AVG_RESETS = 'avgResets',
  BEST_LAP_TIME = 'bestLapTime',
  COLLISION_COUNT = 'collisionCount',
  COMPLETED_LAP_COUNT = 'completedLapCount',
  MODEL_NAME = 'modelName',
  OFF_TRACK_COUNT = 'offTrackCount',
  RESET_COUNT = 'resetCount',
  STATS = 'stats',
  TOTAL_LAP_TIME = 'totalLapTime',

  // Evaluation attributes
  COMPLETION_PERCENTAGE = 'completionPercentage',
  CRASH_COUNT = 'crashCount',
  ELAPSED_TIME_IN_MILLISECONDS = 'elapsedTimeInMilliseconds',
  EPISODE_STATUS = 'episodeStatus',
  EVALUATION_ID = 'evaluationId',
  EVALUATION_NAME = 'evaluationName',
  METRICS = 'metrics',
  TRIAL = 'trial',

  // Leaderboard attributes
  CLOSE_TIME = 'closeTime',
  CONTINUOUS_LAP = 'continuousLap',
  LANE_NUMBER = 'laneNumber',
  LEADERBOARD_ID = 'leaderboardId',
  MAX_SUBMISSIONS_PER_USER = 'maxSubmissionsPerUser',
  MINIMUM_LAPS = 'minimumLaps',
  OBJECT_POSITIONS = 'objectPositions',
  OFF_TRACK_PENALTY_SECONDS = 'offTrackPenaltySeconds',
  OPEN_TIME = 'openTime',
  PARTICIPANT_COUNT = 'participantCount',
  SUBMISSION_TERMINATION_CONDITIONS = 'submissionTerminationConditions',
  TIMING_METHOD = 'timingMethod',
  TOTAL_LAPS = 'totalLaps',
  TRACK_PERCENTAGE = 'trackPercentage',
  /** Set of profileIds that have submitted to this leaderboard */
  SUBMITTED_PROFILES = 'submittedProfiles',

  // Model attributes
  ACTION_SPACE = 'actionSpace',
  AGENT_ALGORITHM = 'agentAlgorithm',
  CAR_CUSTOMIZATION = 'carCustomization',
  CLONED_FROM_MODEL_ID = 'clonedFromModelId',
  FILE_SIZE_IN_BYTES = 'fileSizeInBytes',
  HYPERPARAMETERS = 'hyperparameters',
  METADATA = 'metadata',
  MODEL_ARTIFACT_S3_LOCATION = 'modelArtifactS3Location',
  VIRTUAL_MODEL_ARTIFACT_S3_LOCATION = 'virtualModelArtifactS3Location',
  MODEL_ID = 'modelId',
  MODEL_METADATA_S3_LOCATION = 'modelMetadataS3Location',
  MODEL_ROOT_S3_LOCATION = 'modelRootS3Location',
  REWARD_FUNCTION = 'rewardFunction',
  REWARD_FUNCTION_S3_LOCATION = 'rewardFunctionS3Location',
  SAGEMAKER_ARTIFACTS_S3_LOCATION = 'sageMakerArtifactsS3Location',
  SENSORS = 'sensors',
  PACKAGING_STATUS = 'packagingStatus',
  PACKAGING_ERROR_REQUEST_ID = 'packagingErrorRequestId',
  PACKAGED_AT = 'packagedAt',
  IMPORT_ERROR_MESSAGE = 'importErrorMessage',

  // Ranking attributes
  RANKING_SCORE = 'rankingScore',
  SUBMISSION_VIDEO_S3_LOCATION = 'submissionVideoS3Location',

  // Submission attributes
  SUBMISSION_ID = 'submissionId',
  SUBMISSION_NUMBER = 'submissionNumber',
  USER_PROFILE = 'userProfile',

  // Resource usage attributes
  ACCOUNT_RESOURCE_COMPUTE_MINUTES_USED = 'accountComputeMinutesUsed',
  ACCOUNT_RESOURCE_COMPUTE_MINUTES_QUEUED = 'accountComputeMinutesQueued',
  ACCOUNT_RESOURCE_USAGE_MONTH = 'month',
  ACCOUNT_RESOURCE_USAGE_YEAR = 'year',
}

/**
 * Attributes definitions below should use this instead of the raw
 * enum to allow intellisense on item types to work properly.
 * Unable to determine the cause but this works for now.
 */
const Attribute = DynamoDBItemAttribute;

export const METADATA_ATTRIBUTES = {
  [Attribute.CREATED_AT]: {
    type: 'string',
    default: () => new Date().toISOString(),
    readOnly: true,
    required: true,
  },
  [Attribute.UPDATED_AT]: {
    type: 'string',
    default: () => new Date().toISOString(),
    // Watch for changes to any attribute
    watch: '*',
    // Set current timestamp when updated
    set: () => new Date().toISOString(),
    readOnly: true,
    required: true,
  },
  [Attribute.VERSION]: {
    type: 'number',
    default: 1,
    hidden: true,
  },
} satisfies Schema<any, any, any>['attributes'];

export const AVATAR_ATTRIBUTE = {
  type: 'map',
  required: true,
  default: DEFAULT_AVATAR,
  properties: Object.values(AvatarOptionType).reduce(
    (acc, currentVal) => ({
      ...acc,
      [currentVal]: {
        type: 'string',
      },
    }),
    {} as {
      [Option in AvatarOptionType]: {
        type: 'string';
      };
    },
  ),
} satisfies Attribute;

export const OBJECT_AVOIDANCE_CONFIG_ATTRIBUTE = {
  type: 'map',
  properties: {
    [Attribute.NUMBER_OF_OBJECTS]: {
      type: 'number',
      required: true,
    },
    [Attribute.OBJECT_POSITIONS]: {
      type: 'list',
      items: {
        type: 'map',
        properties: {
          [Attribute.TRACK_PERCENTAGE]: {
            type: 'number',
            required: true,
          },
          [Attribute.LANE_NUMBER]: {
            type: 'number',
            required: true,
          },
        },
      },
    },
  },
} satisfies Attribute;

export const RESETTING_BEHAVIOR_CONFIG_ATTRIBUTE = {
  type: 'map',
  required: true,
  properties: {
    [Attribute.CONTINUOUS_LAP]: {
      type: 'boolean',
      required: true,
    },
    [Attribute.COLLISION_PENALTY_SECONDS]: {
      type: 'number',
    },
    [Attribute.OFF_TRACK_PENALTY_SECONDS]: {
      type: 'number',
    },
  },
} satisfies Attribute;

export const getWorkflowJobAttributes = <
  IsTraining extends boolean,
  IsEvaluationOrSubmission extends IsTraining extends true ? false : true,
>(
  isTrainingJob: IsTraining,
) =>
  ({
    [Attribute.ASSET_S3_LOCATIONS]: {
      type: 'map',
      readOnly: true,
      required: true,
      default: {
        [Attribute.METRICS_S3_LOCATION]: '',
        [Attribute.SIM_TRACE_S3_LOCATION]: '',
        [Attribute.SIMULATION_HEARTBEAT_S3_LOCATION]: '',
        [Attribute.SIMULATION_YAML_S3_LOCATION]: '',
        [Attribute.VIDEOS_S3_LOCATION]: '',
        [Attribute.PRIMARY_VIDEO_S3_LOCATION]: '',
      },
      watch: [Attribute.NAME],
      set: (_, { modelId, profileId, name: jobName }) => ({
        [Attribute.METRICS_S3_LOCATION]: s3PathHelper.getMetricsS3Location(modelId, profileId, jobName),
        [Attribute.SIM_TRACE_S3_LOCATION]: s3PathHelper.getSimTraceS3Location(modelId, profileId, jobName),
        [Attribute.SIMULATION_HEARTBEAT_S3_LOCATION]: s3PathHelper.getSimulationHeartbeatS3Location(
          modelId,
          profileId,
          jobName,
        ),
        [Attribute.SIMULATION_YAML_S3_LOCATION]: s3PathHelper.getSimulationYamlS3Location(modelId, profileId),
        [Attribute.VIDEOS_S3_LOCATION]: s3PathHelper.getVideosS3Location(modelId, profileId, jobName),
        [Attribute.PRIMARY_VIDEO_S3_LOCATION]: s3PathHelper.getPrimaryVideoS3Location(modelId, profileId, jobName),
      }),
      properties: {
        [Attribute.METRICS_S3_LOCATION]: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        [Attribute.SIM_TRACE_S3_LOCATION]: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        [Attribute.SIMULATION_YAML_S3_LOCATION]: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        [Attribute.SIMULATION_HEARTBEAT_S3_LOCATION]: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        [Attribute.VIDEOS_S3_LOCATION]: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        [Attribute.PRIMARY_VIDEO_S3_LOCATION]: {
          type: 'string',
          required: true,
          readOnly: true,
        },
        [Attribute.SIMULATION_LOGS_S3_LOCATION]: {
          type: 'string',
        },
        [Attribute.TRAINING_LOGS_S3_LOCATION]: {
          type: 'string',
        },
        [Attribute.LOGS_ARCHIVE_S3_LOCATION]: {
          type: 'string',
        },
      },
    },
    [Attribute.MODEL_ID]: {
      type: CustomAttributeType<ResourceId>('string'),
      readOnly: true,
      required: true,
    },
    [Attribute.PROFILE_ID]: {
      type: CustomAttributeType<ResourceId>('string'),
      readOnly: true,
      required: true,
    },
    [Attribute.RACE_TYPE]: {
      type: Object.values(RaceType),
      readOnly: true,
      required: true,
    },
    [Attribute.START_TIME]: {
      type: 'string',
    },
    [Attribute.END_TIME]: {
      type: 'string',
    },
    [Attribute.SAGEMAKER_JOB_ARN]: {
      type: 'string',
    },
    [Attribute.STATUS]: {
      type: Object.values(JobStatus),
      required: true,
    },
    [Attribute.TERMINATION_CONDITIONS]: {
      type: 'map',
      required: true,
      properties: {
        [Attribute.MAX_TIME_IN_MINUTES]: {
          type: 'number',
          required: true,
          readOnly: true,
        },
        [Attribute.MAX_LAPS]: {
          type: 'number',
          required: !isTrainingJob as IsEvaluationOrSubmission,
          readOnly: true,
        },
      },
    },
    [Attribute.TRACK_CONFIG]: {
      type: 'map',
      required: true,
      properties: {
        [Attribute.TRACK_ID]: {
          type: Object.values(TrackId),
          readOnly: true,
          required: true,
        },
        [Attribute.TRACK_DIRECTION]: {
          type: Object.values(TrackDirection),
          readOnly: true,
          required: true,
        },
      },
    },
    [Attribute.OBJECT_AVOIDANCE_CONFIG]: OBJECT_AVOIDANCE_CONFIG_ATTRIBUTE,
    [Attribute.VIDEO_STREAM_URL]: {
      type: 'string',
    },
  }) satisfies Schema<any, any, any>['attributes'];

export const getSubmissionAndRankingSharedAttributes = <
  IsRanking extends boolean,
  IsSubmission extends IsRanking extends true ? false : true,
>(
  isRanking: IsRanking,
) =>
  ({
    [Attribute.STATS]: {
      type: 'map',
      required: isRanking as IsRanking,
      properties: {
        [Attribute.AVG_LAP_TIME]: {
          type: 'number',
          required: true,
        },
        [Attribute.AVG_RESETS]: {
          type: 'number',
          required: true,
        },
        [Attribute.BEST_LAP_TIME]: {
          type: 'number',
          required: true,
        },
        [Attribute.COLLISION_COUNT]: {
          type: 'number',
          required: true,
        },
        [Attribute.COMPLETED_LAP_COUNT]: {
          type: 'number',
          required: true,
        },
        [Attribute.OFF_TRACK_COUNT]: {
          type: 'number',
          required: true,
        },
        [Attribute.RESET_COUNT]: {
          type: 'number',
          required: true,
        },
        [Attribute.TOTAL_LAP_TIME]: {
          type: 'number',
          required: true,
        },
      },
    },
    [Attribute.SUBMISSION_NUMBER]: {
      type: 'number',
      required: true,
    },
    [Attribute.MODEL_NAME]: {
      type: 'string',
      required: true,
      readOnly: !isRanking as IsSubmission,
    },
    [Attribute.RANKING_SCORE]: {
      type: 'number',
      required: isRanking as IsRanking,
    },
    [Attribute.LEADERBOARD_ID]: {
      type: CustomAttributeType<ResourceId>('string'),
      readOnly: true,
      required: true,
    },
    [Attribute.SUBMISSION_ID]: {
      type: CustomAttributeType<ResourceId>('string'),
      default: () => generateResourceId(),
      readOnly: !isRanking as IsSubmission,
      required: true,
    },
  }) satisfies Schema<any, any, any>['attributes'];
