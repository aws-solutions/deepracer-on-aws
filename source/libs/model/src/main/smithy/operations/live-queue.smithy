$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/leaderboards/{leaderboardId}/liveQueue/reorder")
operation ReorderLiveQueue {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        submissionId: ResourceIdentifier

        /// null means move to front
        afterSubmissionId: ResourceIdentifier
    }

    output := {
        @required
        item: LiveQueueItem
    }

    errors: [
        NotFoundError
    ]
}

@idempotent
@http(method: "DELETE", uri: "/leaderboards/{leaderboardId}/liveQueue/{submissionId}")
operation RemoveLiveQueueItem {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        @httpLabel
        submissionId: ResourceIdentifier
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}

@http(method: "POST", uri: "/leaderboards/{leaderboardId}/liveQueue/{submissionId}/resetModel")
operation ResetLiveQueueModel {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        @httpLabel
        submissionId: ResourceIdentifier

        reason: String
    }

    output := {
        @required
        status: LiveQueueItemStatus

        @required
        resetCount: NonNegativeInteger

        @required
        queuePosition: String

        @required
        autoLaunchEnabled: Boolean
    }

    errors: [
        NotFoundError
    ]
}

@http(method: "POST", uri: "/leaderboards/{leaderboardId}/liveQueue/resetAll")
operation ClearLiveLeaderboard {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        @required
        itemsReset: NonNegativeInteger

        @required
        itemsFailed: NonNegativeInteger

        failedSubmissionIds: ResourceIdentifierList
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}

@http(method: "POST", uri: "/leaderboards/{leaderboardId}/liveQueue/launch")
operation LaunchLiveRace {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        @required
        executionArn: String

        @required
        liveEventStatus: LiveEventStatus
    }

    errors: [
        BadRequestError
        NotFoundError
        ConflictError
    ]
}

@http(method: "POST", uri: "/leaderboards/{leaderboardId}/declareWinner")
operation DeclareWinner {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        winnerId: ResourceIdentifier

        @timestampFormat("date-time")
        winnerDeclaredAt: Timestamp

        @required
        liveEventStatus: LiveEventStatus

        @required
        pendingCount: NonNegativeInteger

        @required
        failedCount: NonNegativeInteger
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}
