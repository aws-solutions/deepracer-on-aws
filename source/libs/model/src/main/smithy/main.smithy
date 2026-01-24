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
        TestRewardFunction
    ]
    resources: [
        ModelResource
        LeaderboardResource
        ProfileResource
        GlobalSettingResource
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
    ]
    resources: [
        EvaluationResource
    ]
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
