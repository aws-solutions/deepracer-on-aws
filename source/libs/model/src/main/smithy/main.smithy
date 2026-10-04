$version: "2"

namespace com.aws.solutions.deepracer

use aws.apigateway#integration
use aws.apigateway#requestValidator
use aws.auth#cognitoUserPools
use aws.protocols#restJson1
use smithy.framework#ValidationException

@cognitoUserPools(
    providerArns: ["<cognito-pool-placeholder>"]
)
@integration(type: "aws_proxy", httpMethod: "POST", uri: "")
@requestValidator("full")
@restJson1
@cors
service DeepRacerIndy {
    version: "1.0"
    operations: [
        ImportModel
        ImportPhysicalModel
        TestRewardFunction
        ListAdminProfiles
        ListAdminModels
        ListModelsForProfile
        GetAdminAssetUrl
        AttachLiveRacePolicy
        AssignEventFleets
        ListEventDevices
        ClearDeviceModels
        BatchUpdateDevice
        ListDeploymentsByBatch
        ListDeploymentsByEvent
        GetEventLeaderboard
        RegisterUser
        GetRaceStats
        BulkInviteUser
        GetBulkInviteUserJobStatus
        ListBulkInviteUserJobs
        ResendInvite
        StartCarLogFetch
        ListCarLogFetches
        GetCarLogFetch
        ListCarLogAssets
        GetCarLogAssetUrls
        DeleteCarLogAsset
        CreateCarLogUpload
    ]
    resources: [
        ModelResource
        LeaderboardResource
        ProfileResource
        GlobalSettingResource
        LiveQueueItemResource
        DeviceResource
        FleetResource
        EventResource
        RunResource
    ]
    errors: [
        BadRequestError
        NotAuthorizedError
        InternalFailureError
        ValidationException
    ]
}

resource ModelResource {
    identifiers: {
        modelId: ResourceIdentifier
    }
    create: CreateModel
    delete: DeleteModel
    list: ListModels
    read: GetModel
    operations: [
        GetAssetUrl
        StopModel
        PackageModel
        RetryTraining
    ]
    resources: [
        EvaluationResource
        DeploymentResource
    ]
}

resource DeploymentResource {
    identifiers: {
        modelId: ResourceIdentifier
        deploymentId: ResourceIdentifier
    }
    create: DeployModel
    list: ListDeployments
    read: GetDeployment
}

resource EvaluationResource {
    identifiers: {
        modelId: ResourceIdentifier
        evaluationId: ResourceIdentifier
    }
    create: CreateEvaluation
    list: ListEvaluations
    read: GetEvaluation
}

resource LeaderboardResource {
    identifiers: {
        leaderboardId: ResourceIdentifier
    }
    create: CreateLeaderboard
    delete: DeleteLeaderboard
    list: ListLeaderboards
    read: GetLeaderboard
    update: EditLeaderboard
    operations: [
        CreateSubmission
        GetRanking
        JoinLeaderboard
        ListRankings
        ListSubmissions
        GetLiveRaceState
        ReorderLiveQueue
        RemoveLiveQueueItem
        ResetLiveQueueModel
        ClearLiveLeaderboard
        LaunchLiveRace
        DeclareWinner
    ]
}

resource ProfileResource {
    read: GetProfile
    update: UpdateProfile
    delete: DeleteProfile
    operations: [
        ListProfiles
        CreateProfile
        UpdateGroupMembership
        DeleteProfileModels
    ]
}

resource GlobalSettingResource { read: GetGlobalSetting, update: UpdateGlobalSetting }

resource LiveQueueItemResource {
    identifiers: {
        leaderboardId: ResourceIdentifier
        submissionId: ResourceIdentifier
    }
    list: ListLiveQueueItems
}

resource DeviceResource {
    identifiers: {
        instanceId: InstanceId
    }
    list: ListDevices
    delete: DeleteDevice
    update: UpdateDevice
    collectionOperations: [
        ActivateDevice
    ]
    operations: [
        RestartDevice
        StopDevice
        ChangeDeviceColor
    ]
}

resource FleetResource {
    identifiers: {
        fleetId: ResourceIdentifier
    }
    create: CreateFleet
    list: ListFleets
    update: UpdateFleet
    delete: DeleteFleet
}

resource EventResource {
    identifiers: {
        eventId: ResourceIdentifier
    }
    create: CreateEvent
    delete: DeleteEvent
    list: ListEvents
    read: GetEvent
    update: EditEvent
    operations: [
        TransitionEventStatus
        AddTrackToEvent
        RemoveTrackFromEvent
        ListEventTracks
        GetCombinedLeaderboard
        CreateRun
        ListRuns
        GetEventStatistics
    ]
}

resource RunResource {
    identifiers: {
        runId: ResourceIdentifier
    }
    read: GetRun
    operations: [
        TransitionRunStatus
        CreateLap
        UpdateLap
        SetLapValidity
    ]
}
