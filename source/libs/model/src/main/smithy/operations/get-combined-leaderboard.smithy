$version: "2"

namespace com.aws.solutions.deepracer

/// Returns the combined leaderboard for a multi-track event: one Ranking per racer,
/// aggregated across whichever of the event's tracks they've raced on so far, using the
/// event's configured combinedScoringStrategy. Available to any authenticated user.
@readonly
@paginated(inputToken: "token", outputToken: "token", pageSize: "maxResults", items: "rankings")
@http(method: "GET", uri: "/events/{eventId}/combined-leaderboard")
operation GetCombinedLeaderboard {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @httpQuery("token")
        token: String

        @httpQuery("maxResults")
        @range(min: 1, max: 100)
        maxResults: Integer
    }

    output := {
        @required
        combinedScoringStrategy: CombinedScoringStrategy

        @required
        rankings: RankingList

        token: String
    }

    errors: [
        NotFoundError
        BadRequestError
    ]
}
