$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/leaderboards/{leaderboardId}/liveState")
operation GetLiveRaceState {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        @required
        race: LiveRaceInfo

        currentEvaluation: CurrentEvaluationInfo

        @required
        queue: LiveQueueSummary

        @required
        rankings: RankingSummaryList

        winner: WinnerInfo
    }

    errors: [
        NotFoundError
    ]
}

structure LiveRaceInfo {
    @required
    leaderboardId: ResourceIdentifier

    @required
    name: ResourceName

    @required
    liveEventStatus: LiveEventStatus

    @required
    isLive: Boolean

    @required
    autoLaunchEnabled: Boolean

    @required
    submissionPeriodOpen: Boolean
}

structure CurrentEvaluationInfo {
    @required
    submissionId: ResourceIdentifier

    @required
    participantName: Alias

    @required
    modelName: ModelName

    @required
    status: LiveQueueItemStatus

    streamUrl: String
}

structure LiveQueueSummary {
    @required
    totalModels: NonNegativeInteger

    @required
    completedModels: NonNegativeInteger

    @required
    pendingModels: NonNegativeInteger

    @required
    inProgressModels: NonNegativeInteger
}

structure RankingSummary {
    @required
    rank: PositiveInteger

    @required
    participantName: Alias

    @required
    modelName: ModelName

    bestLapTime: PositiveInteger

    avatar: AvatarConfig
}

list RankingSummaryList {
    member: RankingSummary
}

structure WinnerInfo {
    @required
    submissionId: ResourceIdentifier

    @required
    @timestampFormat("date-time")
    winnerDeclaredAt: Timestamp
}
