// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { UserRoles } from './userIdentity';
import { iotTopicPrefix } from '../../constants/iotTopics.js';

export interface UserRolePoliciesProps {
  /**
   * Api object
   */
  api: SpecRestApi;
  /**
   * User roles aggregate object
   */
  userRoles: UserRoles;
  /**
   * ARN of the S3 bucket for file uploads
   */
  uploadBucketArn: string;
  /**
   * Deployment namespace, used to scope IoT topic resources
   */
  namespace: string;
}

export class UserRolePolicies extends Construct {
  constructor(scope: Construct, id: string, props: UserRolePoliciesProps) {
    super(scope, id);

    const apiBaseArn = `arn:${Stack.of(this).partition}:execute-api:${Stack.of(this).region}:${Stack.of(this).account}:${props.api.restApiId}`;

    // Create S3 upload policy statement for all roles
    const s3UploadPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:PutObject',
        's3:PutObjectAcl',
        's3:ListMultipartUploadParts',
        's3:AbortMultipartUpload',
        's3:ListBucketMultipartUploads',
        's3:CreateMultipartUpload',
        's3:CompleteMultipartUpload',
      ],
      resources: [`${props.uploadBucketArn}/*`],
    });

    props.userRoles.adminRole.addToPolicy(s3UploadPolicy);
    props.userRoles.raceFacilitatorRole.addToPolicy(s3UploadPolicy);
    props.userRoles.racerRole.addToPolicy(s3UploadPolicy);

    // Admin API permissions
    props.userRoles.adminRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [`${apiBaseArn}/*/*/*`],
      }),
    );

    // Race facilitator API permissions; can perform mutating actions on leaderboards
    const raceFacApiAllowedResources = [
      // importmodel
      `${apiBaseArn}/*/OPTIONS/importmodel`, // CorsImportmodel
      `${apiBaseArn}/*/POST/importmodel`, // ImportModel
      // leaderboards
      `${apiBaseArn}/*/GET/leaderboards`, // ListLeaderboards
      `${apiBaseArn}/*/OPTIONS/leaderboards`, // CorsLeaderboards
      `${apiBaseArn}/*/POST/leaderboards`, // CreateLeaderboard
      // leaderboards/{leaderboardId}
      `${apiBaseArn}/*/DELETE/leaderboards/*`, // DeleteLeaderboard
      `${apiBaseArn}/*/GET/leaderboards/*`, // GetLeaderboard
      `${apiBaseArn}/*/OPTIONS/leaderboards/*`, // CorsLeaderboardsLeaderboardid
      `${apiBaseArn}/*/PATCH/leaderboards/*`, // EditLeaderboard
      `${apiBaseArn}/*/POST/leaderboards/*`, // JoinLeaderboard
      // leaderboards/{leaderboardId}/ranking
      `${apiBaseArn}/*/GET/leaderboards/*/ranking`, // GetRanking
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/ranking`, // CorsLeaderboardsLeaderboardidRanking
      // leaderboards/{leaderboardId}/rankings
      `${apiBaseArn}/*/GET/leaderboards/*/rankings`, // ListRankings
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/rankings`, // CorsLeaderboardsLeaderboardidRankings
      // leaderboards/{leaderboardId}/submissions
      `${apiBaseArn}/*/GET/leaderboards/*/submissions`, // ListSubmissions
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/submissions`, // CorsLeaderboardsLeaderboardidSubmissions
      `${apiBaseArn}/*/POST/leaderboards/*/submissions`, // CreateSubmission
      // leaderboards/{leaderboardId}/liveQueue
      `${apiBaseArn}/*/GET/leaderboards/*/liveQueue`, // ListLiveQueueItems
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue`, // CorsLeaderboardsLeaderboardidLivequeue
      `${apiBaseArn}/*/POST/leaderboards/*/liveQueue/reorder`, // ReorderLiveQueue
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue/reorder`, // CorsLiveQueueReorder
      `${apiBaseArn}/*/DELETE/leaderboards/*/liveQueue/*`, // RemoveLiveQueueItem
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue/*`, // CorsLiveQueueItem
      `${apiBaseArn}/*/POST/leaderboards/*/liveQueue/*/resetModel`, // ResetLiveQueueModel
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue/*/resetModel`, // CorsLiveQueueItemResetmodel
      `${apiBaseArn}/*/POST/leaderboards/*/liveQueue/resetAll`, // ClearLiveLeaderboard
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue/resetAll`, // CorsLiveQueueResetAll
      // leaderboards/{leaderboardId}/liveQueue/launch
      `${apiBaseArn}/*/POST/leaderboards/*/liveQueue/launch`, // LaunchLiveRace
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue/launch`, // CorsLeaderboardsLeaderboardidLivequeueLaunch
      // leaderboards/{leaderboardId}/declareWinner
      `${apiBaseArn}/*/POST/leaderboards/*/declareWinner`, // DeclareWinner
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/declareWinner`, // CorsDeclareWinner
      // leaderboards/{leaderboardId}/liveState
      `${apiBaseArn}/*/GET/leaderboards/*/liveState`, // GetLiveRaceState
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveState`, // CorsLiveState
      // models
      `${apiBaseArn}/*/GET/models`, // ListModels
      `${apiBaseArn}/*/OPTIONS/models`, // CorsModels
      `${apiBaseArn}/*/POST/models`, // CreateModel
      // models/{modelId}
      `${apiBaseArn}/*/DELETE/models/*`, // DeleteModel
      `${apiBaseArn}/*/GET/models/*`, // GetModel
      `${apiBaseArn}/*/OPTIONS/models/*`, // CorsModelsModelid
      `${apiBaseArn}/*/PATCH/models/*`, // StopModel
      // models/{modelId}/evaluation
      `${apiBaseArn}/*/OPTIONS/models/*/evaluation`, // CorsModelsModelidEvaluation
      `${apiBaseArn}/*/POST/models/*/evaluation`, // CreateEvaluation
      // models/{modelId}/evaluations
      `${apiBaseArn}/*/GET/models/*/evaluations`, // ListEvaluations
      `${apiBaseArn}/*/OPTIONS/models/*/evaluations`, // CorsModelsModelidEvaluations
      // models/{modelId}/evaluations/{evaluationId}
      `${apiBaseArn}/*/GET/models/*/evaluations/*`, // GetEvaluation
      `${apiBaseArn}/*/OPTIONS/models/*/evaluations/*`, // CorsModelsModelidEvaluationsEvaluationid
      // models/{modelId}/getasset
      `${apiBaseArn}/*/GET/models/*/getasset`, // GetAssetUrl
      `${apiBaseArn}/*/OPTIONS/models/*/getasset`, // CorsModelsModelidGetasset
      // admin/profiles
      `${apiBaseArn}/*/GET/admin/profiles`, // ListAdminProfiles
      `${apiBaseArn}/*/OPTIONS/admin/profiles`, // CorsAdminProfiles
      // admin/profiles/{profileId}/models
      `${apiBaseArn}/*/GET/admin/profiles/*/models`, // ListModelsForProfile
      `${apiBaseArn}/*/OPTIONS/admin/profiles/*/models`, // CorsAdminProfilesModels
      // admin/models/{modelId}/getasset
      `${apiBaseArn}/*/GET/admin/models/*/getasset`, // GetAdminAssetUrl
      `${apiBaseArn}/*/OPTIONS/admin/models/*/getasset`, // CorsAdminModelsGetasset
      // profile
      `${apiBaseArn}/*/GET/profile`, // GetProfile
      `${apiBaseArn}/*/OPTIONS/profile`, // CorsProfile
      `${apiBaseArn}/*/PATCH/profile`, // UpdateProfile
      `${apiBaseArn}/*/POST/profile`, // CreateProfile
      // rewardFunction
      `${apiBaseArn}/*/OPTIONS/rewardFunction`, // CorsRewardfunction
      `${apiBaseArn}/*/POST/rewardFunction`, // TestRewardFunction
      // settings/{key}
      `${apiBaseArn}/*/GET/settings/*`, // GetGlobalSetting
      `${apiBaseArn}/*/OPTIONS/settings/*`, // CorsSettingsKey
      // live-race/connect
      `${apiBaseArn}/*/POST/live-race/connect`, // AttachLiveRacePolicy
      `${apiBaseArn}/*/OPTIONS/live-race/connect`, // CorsLiveRaceConnect
    ];

    props.userRoles.raceFacilitatorRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: raceFacApiAllowedResources,
      }),
    );

    // Racer role permissions: can access standard API methods; cannot delete users or all models
    const racerApiAllowedResources = [
      // importmodel
      `${apiBaseArn}/*/OPTIONS/importmodel`, // CorsImportmodel
      `${apiBaseArn}/*/POST/importmodel`, // ImportModel
      // leaderboards
      `${apiBaseArn}/*/GET/leaderboards`, // ListLeaderboards
      `${apiBaseArn}/*/OPTIONS/leaderboards`, // CorsLeaderboards
      // leaderboards/{leaderboardId}
      `${apiBaseArn}/*/GET/leaderboards/*`, // GetLeaderboard
      `${apiBaseArn}/*/OPTIONS/leaderboards/*`, // CorsLeaderboardsLeaderboardid
      `${apiBaseArn}/*/POST/leaderboards/*`, // JoinLeaderboard
      // leaderboards/{leaderboardId}/ranking
      `${apiBaseArn}/*/GET/leaderboards/*/ranking`, // GetRanking
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/ranking`, // CorsLeaderboardsLeaderboardidRanking
      // leaderboards/{leaderboardId}/rankings
      `${apiBaseArn}/*/GET/leaderboards/*/rankings`, // ListRankings
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/rankings`, // CorsLeaderboardsLeaderboardidRankings
      // leaderboards/{leaderboardId}/submissions
      `${apiBaseArn}/*/GET/leaderboards/*/submissions`, // ListSubmissions
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/submissions`, // CorsLeaderboardsLeaderboardidSubmissions
      `${apiBaseArn}/*/POST/leaderboards/*/submissions`, // CreateSubmission
      // leaderboards/{leaderboardId}/liveQueue
      `${apiBaseArn}/*/GET/leaderboards/*/liveQueue`, // ListLiveQueueItems
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveQueue`, // CorsLeaderboardsLeaderboardidLivequeue
      // leaderboards/{leaderboardId}/liveState
      `${apiBaseArn}/*/GET/leaderboards/*/liveState`, // GetLiveRaceState
      `${apiBaseArn}/*/OPTIONS/leaderboards/*/liveState`, // CorsLiveState
      // models
      `${apiBaseArn}/*/GET/models`, // ListModels
      `${apiBaseArn}/*/OPTIONS/models`, // CorsModels
      `${apiBaseArn}/*/POST/models`, // CreateModel
      // models/{modelId}
      `${apiBaseArn}/*/DELETE/models/*`, // DeleteModel
      `${apiBaseArn}/*/GET/models/*`, // GetModel
      `${apiBaseArn}/*/OPTIONS/models/*`, // CorsModelsModelid
      `${apiBaseArn}/*/PATCH/models/*`, // StopModel
      // models/{modelId}/evaluation
      `${apiBaseArn}/*/OPTIONS/models/*/evaluation`, // CorsModelsModelidEvaluation
      `${apiBaseArn}/*/POST/models/*/evaluation`, // CreateEvaluation
      // models/{modelId}/evaluations
      `${apiBaseArn}/*/GET/models/*/evaluations`, // ListEvaluations
      `${apiBaseArn}/*/OPTIONS/models/*/evaluations`, // CorsModelsModelidEvaluations
      // models/{modelId}/evaluations/{evaluationId}
      `${apiBaseArn}/*/GET/models/*/evaluations/*`, // GetEvaluation
      `${apiBaseArn}/*/OPTIONS/models/*/evaluations/*`, // CorsModelsModelidEvaluationsEvaluationid
      // models/{modelId}/getasset
      `${apiBaseArn}/*/GET/models/*/getasset`, // GetAssetUrl
      `${apiBaseArn}/*/OPTIONS/models/*/getasset`, // CorsModelsModelidGetasset
      // profile
      `${apiBaseArn}/*/GET/profile`, // GetProfile
      `${apiBaseArn}/*/OPTIONS/profile`, // CorsProfile
      `${apiBaseArn}/*/PATCH/profile`, // UpdateProfile
      `${apiBaseArn}/*/POST/profile`, // CreateProfile
      // rewardFunction
      `${apiBaseArn}/*/OPTIONS/rewardFunction`, // CorsRewardfunction
      `${apiBaseArn}/*/POST/rewardFunction`, // TestRewardFunction
      // settings/{key}
      `${apiBaseArn}/*/GET/settings/*`, // GetGlobalSetting
      `${apiBaseArn}/*/OPTIONS/settings/*`, // CorsSettingsKey
      // live-race/connect
      `${apiBaseArn}/*/POST/live-race/connect`, // AttachLiveRacePolicy
      `${apiBaseArn}/*/OPTIONS/live-race/connect`, // CorsLiveRaceConnect
    ];

    props.userRoles.racerRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: racerApiAllowedResources,
      }),
    );

    // IoT Core permissions for live race spectating (MQTT over WSS)
    const { region, account, partition } = Stack.of(this);
    const topicPrefix = iotTopicPrefix(props.namespace);
    const iotConnectPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iot:Connect'],
      resources: [`arn:${partition}:iot:${region}:${account}:client/*`],
    });
    const iotSubscribeReceivePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iot:Subscribe', 'iot:Receive'],
      resources: [
        `arn:${partition}:iot:${region}:${account}:topicfilter/${topicPrefix}/*`,
        `arn:${partition}:iot:${region}:${account}:topic/${topicPrefix}/*`,
      ],
    });

    props.userRoles.adminRole.addToPolicy(iotConnectPolicy);
    props.userRoles.adminRole.addToPolicy(iotSubscribeReceivePolicy);
    props.userRoles.raceFacilitatorRole.addToPolicy(iotConnectPolicy);
    props.userRoles.raceFacilitatorRole.addToPolicy(iotSubscribeReceivePolicy);
    props.userRoles.racerRole.addToPolicy(iotConnectPolicy);
    props.userRoles.racerRole.addToPolicy(iotSubscribeReceivePolicy);
  }
}
