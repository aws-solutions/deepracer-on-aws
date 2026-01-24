$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/leaderboards")
operation CreateLeaderboard {
    input := {
        @required
        leaderboardDefinition: LeaderboardDefinition
    }

    output := {
        @required
        leaderboardId: ResourceIdentifier
    }
}
