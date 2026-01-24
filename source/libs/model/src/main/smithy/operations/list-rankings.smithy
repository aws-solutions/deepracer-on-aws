$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "rankings")
@http(method: "GET", uri: "/leaderboards/{leaderboardId}/rankings")
operation ListRankings {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @httpQuery("token")
        token: String
    }

    output := {
        @required
        rankings: RankingList

        token: String
    }

    errors: [
        NotFoundError
    ]
}
