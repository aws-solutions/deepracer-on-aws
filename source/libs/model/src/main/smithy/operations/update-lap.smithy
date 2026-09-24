$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "PUT", uri: "/events/{eventId}/tracks/{leaderboardId}/runs/{runId}/laps/{lapNumber}")
operation UpdateLap {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        @httpLabel
        runId: ResourceIdentifier

        @required
        @httpLabel
        lapNumber: PositiveInteger

        @required
        lapTimeMs: PositiveInteger

        @required
        @length(min: 1, max: 500)
        editReason: String
    }

    output := {
        @required
        lap: Lap

        /// The run's recalculated score, present only when the parent run has already
        /// been SUBMITTED and this edit triggered a score recalculation.
        rankingScore: NonNegativeDouble
    }

    errors: [
        NotFoundError
        ConflictError
        BadRequestError
    ]
}
