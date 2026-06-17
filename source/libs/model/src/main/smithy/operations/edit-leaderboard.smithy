$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "PATCH", uri: "/leaderboards/{leaderboardId}")
operation EditLeaderboard {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        leaderboardDefinition: LeaderboardDefinition

        /// Live race toggle fields (optional, only for live races)
        autoLaunchEnabled: Boolean

        submissionPeriodOpen: Boolean

        @timestampFormat("date-time")
        liveEventTime: Timestamp
    }

    output := {
        @required
        leaderboard: Leaderboard
    }

    errors: [
        NotFoundError
    ]
}
