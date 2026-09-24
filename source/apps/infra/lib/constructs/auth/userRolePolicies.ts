// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Stack } from 'aws-cdk-lib';
import { SpecRestApi } from 'aws-cdk-lib/aws-apigateway';
import { Effect, PolicyStatement, Role } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

import { UserRoles } from './userIdentity';
import { EXECUTE_API_RESOURCES_PER_STATEMENT } from '../../constants/iam.js';
import { iotCountdownTopicFilter, iotRaceTopicPrefix, iotTopicRoot } from '../../constants/iotTopics.js';

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

/**
 * Grant `execute-api:Invoke` on `resources`, split across chunked PolicyStatements so no single
 * statement exceeds the 6144-byte managed-policy quota. See {@link EXECUTE_API_RESOURCES_PER_STATEMENT}.
 */
function grantInvokeChunked(role: Role, resources: string[]): void {
  for (let i = 0; i < resources.length; i += EXECUTE_API_RESOURCES_PER_STATEMENT) {
    role.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: resources.slice(i, i + EXECUTE_API_RESOURCES_PER_STATEMENT),
      }),
    );
  }
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
      // models/{modelId}/retry-training
      `${apiBaseArn}/*/POST/models/*/retry-training`, // RetryTraining
      `${apiBaseArn}/*/OPTIONS/models/*/retry-training`, // CorsModelsModelidRetryTraining
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
      // rewardFunction
      `${apiBaseArn}/*/OPTIONS/rewardFunction`, // CorsRewardfunction
      `${apiBaseArn}/*/POST/rewardFunction`, // TestRewardFunction
      // settings/{key}
      `${apiBaseArn}/*/GET/settings/*`, // GetGlobalSetting
      `${apiBaseArn}/*/OPTIONS/settings/*`, // CorsSettingsKey
      // live-race/connect
      `${apiBaseArn}/*/POST/live-race/connect`, // AttachLiveRacePolicy
      `${apiBaseArn}/*/OPTIONS/live-race/connect`, // CorsLiveRaceConnect
      // importphysicalmodel
      `${apiBaseArn}/*/POST/importphysicalmodel`, // ImportPhysicalModel
      `${apiBaseArn}/*/OPTIONS/importphysicalmodel`, // CorsImportphysicalmodel
      // models/{modelId}/package
      `${apiBaseArn}/*/POST/models/*/package`, // PackageModel
      `${apiBaseArn}/*/OPTIONS/models/*/package`, // CorsModelsModelidPackage
      // models/{modelId}/deployments
      `${apiBaseArn}/*/POST/models/*/deployments`, // DeployModel
      `${apiBaseArn}/*/GET/models/*/deployments`, // ListDeployments
      `${apiBaseArn}/*/OPTIONS/models/*/deployments`, // CorsModelsModelidDeployments
      // models/{modelId}/deployments/{deploymentId}
      `${apiBaseArn}/*/GET/models/*/deployments/*`, // GetDeployment
      `${apiBaseArn}/*/OPTIONS/models/*/deployments/*`, // CorsModelsModelidDeploymentsDeploymentid
      // deployments (list by batch)
      `${apiBaseArn}/*/GET/deployments`, // ListDeploymentsByBatch
      `${apiBaseArn}/*/OPTIONS/deployments`, // CorsDeployments
      // admin/models (ListAdminModels — operator models page with optimization status)
      `${apiBaseArn}/*/GET/admin/models`, // ListAdminModels
      `${apiBaseArn}/*/OPTIONS/admin/models`, // CorsAdminModels
      // events/{eventId}/deployments (ListDeploymentsByEvent — upload status page)
      `${apiBaseArn}/*/GET/events/*/deployments`, // ListDeploymentsByEvent
      `${apiBaseArn}/*/OPTIONS/events/*/deployments`, // CorsEventsEventidDeployments
      // devices — Race Facilitators have full Admin parity for device management
      `${apiBaseArn}/*/GET/devices`, // ListDevices
      `${apiBaseArn}/*/OPTIONS/devices`, // CorsDevices
      `${apiBaseArn}/*/POST/devices/activate`, // ActivateDevice
      `${apiBaseArn}/*/OPTIONS/devices/activate`, // CorsDevicesActivate
      `${apiBaseArn}/*/POST/devices/batch-update`, // BatchUpdateDevice
      `${apiBaseArn}/*/OPTIONS/devices/batch-update`, // CorsDevicesBatchUpdate
      `${apiBaseArn}/*/PATCH/devices/*`, // UpdateDevice
      `${apiBaseArn}/*/DELETE/devices/*`, // DeleteDevice
      `${apiBaseArn}/*/OPTIONS/devices/*`, // CorsDevicesInstanceid
      `${apiBaseArn}/*/POST/devices/*/restart`, // RestartDevice
      `${apiBaseArn}/*/OPTIONS/devices/*/restart`, // CorsDevicesRestart
      `${apiBaseArn}/*/POST/devices/*/stop`, // StopDevice
      `${apiBaseArn}/*/OPTIONS/devices/*/stop`, // CorsDevicesStop
      `${apiBaseArn}/*/PATCH/devices/*/color`, // ChangeDeviceColor
      `${apiBaseArn}/*/OPTIONS/devices/*/color`, // CorsDevicesColor
      `${apiBaseArn}/*/POST/devices/*/clear-models`, // ClearDeviceModels
      `${apiBaseArn}/*/OPTIONS/devices/*/clear-models`, // CorsDevicesClearModels
      // fleets — full Admin parity
      `${apiBaseArn}/*/POST/fleets`, // CreateFleet
      `${apiBaseArn}/*/GET/fleets`, // ListFleets
      `${apiBaseArn}/*/OPTIONS/fleets`, // CorsFleets
      `${apiBaseArn}/*/PATCH/fleets/*`, // UpdateFleet
      `${apiBaseArn}/*/DELETE/fleets/*`, // DeleteFleet
      `${apiBaseArn}/*/OPTIONS/fleets/*`, // CorsFleetsFleetid
      // events/{eventId}/fleets + devices
      `${apiBaseArn}/*/POST/events/*/fleets`, // AssignEventFleets
      `${apiBaseArn}/*/OPTIONS/events/*/fleets`, // CorsEventsFleets
      `${apiBaseArn}/*/GET/events/*/devices`, // ListEventDevices
      `${apiBaseArn}/*/OPTIONS/events/*/devices`, // CorsEventsDevices
      // events
      `${apiBaseArn}/*/GET/events`, // ListEvents
      `${apiBaseArn}/*/OPTIONS/events`, // CorsEvents
      // events/{eventId}
      `${apiBaseArn}/*/GET/events/*`, // GetEvent
      `${apiBaseArn}/*/OPTIONS/events/*`, // CorsEventsEventid
      // events/{eventId}/statistics
      `${apiBaseArn}/*/GET/events/*/statistics`, // GetEventStatistics
      `${apiBaseArn}/*/OPTIONS/events/*/statistics`, // CorsEventsEventidStatistics
      // events/{eventId}/combined-leaderboard
      `${apiBaseArn}/*/GET/events/*/combined-leaderboard`, // GetCombinedLeaderboard
      `${apiBaseArn}/*/OPTIONS/events/*/combined-leaderboard`, // CorsEventsEventidCombinedLeaderboard
      // race-management/events/{eventId}/leaderboard — CommentatorView's per-track leaderboard
      // hydration query. RequiresCommentator permits Race Facilitators on this route (see
      // COMMENTATOR_GROUPS), so this grant must match that UI access.
      `${apiBaseArn}/*/GET/race-management/events/*/leaderboard`, // GetEventLeaderboard
      `${apiBaseArn}/*/OPTIONS/race-management/events/*/leaderboard`, // CorsGetEventLeaderboard
      // events/{eventId}/tracks
      `${apiBaseArn}/*/GET/events/*/tracks`, // ListEventTracks
      `${apiBaseArn}/*/OPTIONS/events/*/tracks`, // CorsEventsEventidTracks
      // events/{eventId}/tracks/{leaderboardId}/runs
      `${apiBaseArn}/*/POST/events/*/tracks/*/runs`, // CreateRun
      `${apiBaseArn}/*/GET/events/*/tracks/*/runs`, // ListRuns
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs`, // CorsEventsEventidTracksLeaderboardidRuns
      // events/{eventId}/tracks/{leaderboardId}/runs/{runId}
      `${apiBaseArn}/*/GET/events/*/tracks/*/runs/*`, // GetRun
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs/*`, // CorsEventsEventidTracksLeaderboardidRunsRunid
      // events/{eventId}/tracks/{leaderboardId}/runs/{runId}/transition
      `${apiBaseArn}/*/POST/events/*/tracks/*/runs/*/transition`, // TransitionRunStatus
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs/*/transition`, // CorsEventsEventidTracksLeaderboardidRunsRunidTransition
      // events/{eventId}/tracks/{leaderboardId}/runs/{runId}/laps
      `${apiBaseArn}/*/POST/events/*/tracks/*/runs/*/laps`, // CreateLap
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs/*/laps`, // CorsEventsEventidTracksLeaderboardidRunsRunidLaps
      // events/{eventId}/tracks/{leaderboardId}/runs/{runId}/laps/{lapNumber}/validity
      `${apiBaseArn}/*/PUT/events/*/tracks/*/runs/*/laps/*/validity`, // SetLapValidity
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs/*/laps/*/validity`, // CorsEventsEventidTracksLeaderboardidRunsRunidLapsLapnumberValidity
      // Walk-up racer registration
      `${apiBaseArn}/*/POST/race-management/users`, // RegisterUser
      `${apiBaseArn}/*/OPTIONS/race-management/users`, // CorsRaceManagementUsers
    ];

    grantInvokeChunked(props.userRoles.raceFacilitatorRole, raceFacApiAllowedResources);

    // Racer role permissions: can access standard API methods; cannot delete users or all models
    const racerApiAllowedResources = [
      // importmodel
      `${apiBaseArn}/*/OPTIONS/importmodel`, // CorsImportmodel
      `${apiBaseArn}/*/POST/importmodel`, // ImportModel
      // importphysicalmodel
      `${apiBaseArn}/*/POST/importphysicalmodel`, // ImportPhysicalModel
      `${apiBaseArn}/*/OPTIONS/importphysicalmodel`, // CorsImportphysicalmodel
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
      // models/{modelId}/retry-training
      `${apiBaseArn}/*/POST/models/*/retry-training`, // RetryTraining
      `${apiBaseArn}/*/OPTIONS/models/*/retry-training`, // CorsModelsModelidRetryTraining
      // profile
      `${apiBaseArn}/*/GET/profile`, // GetProfile
      `${apiBaseArn}/*/OPTIONS/profile`, // CorsProfile
      `${apiBaseArn}/*/PATCH/profile`, // UpdateProfile
      // rewardFunction
      `${apiBaseArn}/*/OPTIONS/rewardFunction`, // CorsRewardfunction
      `${apiBaseArn}/*/POST/rewardFunction`, // TestRewardFunction
      // settings/{key}
      `${apiBaseArn}/*/GET/settings/*`, // GetGlobalSetting
      `${apiBaseArn}/*/OPTIONS/settings/*`, // CorsSettingsKey
      // live-race/connect
      `${apiBaseArn}/*/POST/live-race/connect`, // AttachLiveRacePolicy
      `${apiBaseArn}/*/OPTIONS/live-race/connect`, // CorsLiveRaceConnect
      // events
      `${apiBaseArn}/*/GET/events`, // ListEvents
      `${apiBaseArn}/*/OPTIONS/events`, // CorsEvents
      // events/{eventId}
      `${apiBaseArn}/*/GET/events/*`, // GetEvent
      `${apiBaseArn}/*/OPTIONS/events/*`, // CorsEventsEventid
      // events/{eventId}/combined-leaderboard
      `${apiBaseArn}/*/GET/events/*/combined-leaderboard`, // GetCombinedLeaderboard
      `${apiBaseArn}/*/OPTIONS/events/*/combined-leaderboard`, // CorsEventsEventidCombinedLeaderboard
      // events/{eventId}/tracks/{leaderboardId}/runs
      `${apiBaseArn}/*/GET/events/*/tracks/*/runs`, // ListRuns
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs`, // CorsEventsEventidTracksLeaderboardidRuns
      // events/{eventId}/tracks/{leaderboardId}/runs/{runId}
      `${apiBaseArn}/*/GET/events/*/tracks/*/runs/*`, // GetRun
      `${apiBaseArn}/*/OPTIONS/events/*/tracks/*/runs/*`, // CorsEventsEventidTracksLeaderboardidRunsRunid
    ];

    grantInvokeChunked(props.userRoles.racerRole, racerApiAllowedResources);

    // IoT Core permissions for live race spectating (MQTT over WSS)
    const { region, account, partition } = Stack.of(this);
    // Root scope so authenticated roles can subscribe to both the leaderboard and race trees.
    const topicRoot = iotTopicRoot(props.namespace);
    const iotConnectPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iot:Connect'],
      resources: [`arn:${partition}:iot:${region}:${account}:client/*`],
    });
    const iotSubscribeReceivePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iot:Subscribe', 'iot:Receive'],
      resources: [
        `arn:${partition}:iot:${region}:${account}:topicfilter/${topicRoot}/*`,
        `arn:${partition}:iot:${region}:${account}:topic/${topicRoot}/*`,
      ],
    });

    props.userRoles.adminRole.addToPolicy(iotConnectPolicy);
    props.userRoles.adminRole.addToPolicy(iotSubscribeReceivePolicy);
    props.userRoles.adminRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `${apiBaseArn}/*/GET/race-management/stats`, // GetRaceStats
          `${apiBaseArn}/*/OPTIONS/race-management/stats`, // CorsGetRaceStats
        ],
      }),
    );
    props.userRoles.raceFacilitatorRole.addToPolicy(iotConnectPolicy);
    props.userRoles.raceFacilitatorRole.addToPolicy(iotSubscribeReceivePolicy);
    props.userRoles.racerRole.addToPolicy(iotConnectPolicy);
    props.userRoles.racerRole.addToPolicy(iotSubscribeReceivePolicy);

    // Countdown topic publish: the Facilitator/Admin browser session
    // publishes countdown/pause/resume state directly to IoT Core, bypassing Lambda, for
    // sub-100ms jitter. Subscribe/receive for the countdown topic is already covered by the
    // root-scoped iotSubscribeReceivePolicy above for every role that holds it — this grant is
    // publish-only, and deliberately excludes Racer/Commentator/unauthenticated.
    const iotCountdownPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iot:Publish'],
      resources: [`arn:${partition}:iot:${region}:${account}:topic/${iotCountdownTopicFilter(props.namespace)}`],
    });
    props.userRoles.adminRole.addToPolicy(iotCountdownPublishPolicy);
    props.userRoles.raceFacilitatorRole.addToPolicy(iotCountdownPublishPolicy);

    // IoT Publish permission on the race topic tree for admin and facilitators.
    // AWS IoT requires both the named IoT policy (FacilitatorIoTPolicy, attached
    // by AttachLiveRacePolicy) AND the IAM role to allow iot:Publish. Without this
    // IAM grant the MQTT publish is rejected with PUBACK 135 (Not Authorized)
    // even when the named policy is attached.
    const raceTopicPrefix = iotRaceTopicPrefix(props.namespace);
    const iotPublishPolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['iot:Publish'],
      resources: [`arn:${partition}:iot:${region}:${account}:topic/${raceTopicPrefix}/*`],
    });
    props.userRoles.adminRole.addToPolicy(iotPublishPolicy);
    props.userRoles.raceFacilitatorRole.addToPolicy(iotPublishPolicy);

    // Commentator role (read-only): IoT subscribe/receive + connect endpoint access.
    // Race Management endpoint grants are added by follow-up CRs when the routes land, so each new
    // route goes through explicit "add route + update IAM" review rather than being pre-authorized
    // by a wildcard here.
    props.userRoles.commentatorRole.addToPolicy(iotConnectPolicy);
    props.userRoles.commentatorRole.addToPolicy(iotSubscribeReceivePolicy);
    props.userRoles.commentatorRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `${apiBaseArn}/*/GET/profile`, // GetProfile
          `${apiBaseArn}/*/OPTIONS/profile`, // CorsProfile
          `${apiBaseArn}/*/PATCH/profile`, // UpdateProfile
          `${apiBaseArn}/*/POST/live-race/connect`, // AttachLiveRacePolicy
          `${apiBaseArn}/*/OPTIONS/live-race/connect`, // CorsLiveRaceConnect
          `${apiBaseArn}/*/GET/race-management/events/*/leaderboard`, // GetEventLeaderboard
          `${apiBaseArn}/*/OPTIONS/race-management/events/*/leaderboard`, // CorsGetEventLeaderboard
          `${apiBaseArn}/*/GET/events`, // ListEvents
          `${apiBaseArn}/*/OPTIONS/events`, // CorsEvents
          `${apiBaseArn}/*/GET/events/*`, // GetEvent
          `${apiBaseArn}/*/OPTIONS/events/*`, // CorsEventsEventid
          `${apiBaseArn}/*/GET/events/*/tracks`, // ListEventTracks
          `${apiBaseArn}/*/OPTIONS/events/*/tracks`, // CorsEventsEventidTracks
          `${apiBaseArn}/*/GET/events/*/statistics`, // GetEventStatistics
          `${apiBaseArn}/*/OPTIONS/events/*/statistics`, // CorsEventsEventidStatistics
          `${apiBaseArn}/*/GET/events/*/combined-leaderboard`, // GetCombinedLeaderboard
          `${apiBaseArn}/*/OPTIONS/events/*/combined-leaderboard`, // CorsEventsEventidCombinedLeaderboard
        ],
      }),
    );

    // Registration manager role: create walk-up accounts only. No IoT, no leaderboard mutations.
    // The POST /race-management/users route is added by a follow-up CR.
    props.userRoles.registrationManagerRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['execute-api:Invoke'],
        resources: [
          `${apiBaseArn}/*/GET/profile`, // GetProfile
          `${apiBaseArn}/*/OPTIONS/profile`, // CorsProfile
          `${apiBaseArn}/*/PATCH/profile`, // UpdateProfile
          `${apiBaseArn}/*/POST/race-management/users`, // RegisterUser
          `${apiBaseArn}/*/OPTIONS/race-management/users`, // CorsRaceManagementUsers
        ],
      }),
    );
  }
}
