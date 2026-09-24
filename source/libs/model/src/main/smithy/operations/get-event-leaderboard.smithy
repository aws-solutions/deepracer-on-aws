$version: "2"

namespace com.aws.solutions.deepracer

/// Returns the ranked leaderboard for a specific track within an event.
/// Returns up to 50 entries ordered by rank. Intended for commentator and
/// admin console hydration.
@http(method: "GET", uri: "/race-management/events/{eventId}/leaderboard")
@readonly
operation GetEventLeaderboard {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        @httpQuery("track")
        trackId: ResourceIdentifier
    }

    output := {
        @required
        rankings: EventLeaderboardRankingList
    }

    errors: [
        NotFoundError
        BadRequestError
        InternalFailureError
    ]
}

@length(min: 0, max: 50)
list EventLeaderboardRankingList {
    member: EventLeaderboardRanking
}

structure EventLeaderboardRanking {
    @required
    rank: PositiveInteger

    @required
    participantName: String

    @required
    bestLapTimeMilliseconds: NonNegativeInteger

    modelName: String
}
