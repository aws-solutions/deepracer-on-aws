$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/leaderboards/{leaderboardId}/ranking")
operation GetRanking {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        ranking: PersonalRanking
    }

    errors: [
        NotFoundError
    ]
}
