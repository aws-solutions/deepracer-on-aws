$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "DELETE", uri: "/leaderboards/{leaderboardId}")
operation DeleteLeaderboard {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    errors: [
        NotFoundError
    ]
}
