$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "leaderboards")
@http(method: "GET", uri: "/leaderboards")
operation ListLeaderboards {
    input := {
        @httpQuery("token")
        token: String
    }

    output := {
        @required
        leaderboards: LeaderboardList

        token: String
    }
}
