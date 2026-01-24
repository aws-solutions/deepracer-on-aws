$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/leaderboards/{leaderboardId}")
operation GetLeaderboard {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        @required
        leaderboard: Leaderboard
    }

    errors: [
        NotFoundError
    ]
}
