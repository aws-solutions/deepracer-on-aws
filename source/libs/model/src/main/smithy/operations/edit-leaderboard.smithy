$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "PATCH", uri: "/leaderboards/{leaderboardId}")
operation EditLeaderboard {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        leaderboardDefinition: LeaderboardDefinition
    }

    output := {
        @required
        leaderboard: Leaderboard
    }

    errors: [
        NotFoundError
    ]
}
