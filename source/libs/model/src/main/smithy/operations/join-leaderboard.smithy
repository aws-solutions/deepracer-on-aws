$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/leaderboards/{leaderboardId}")
operation JoinLeaderboard {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        inviteCode: String
    }

    errors: [
        NotFoundError
    ]
}
