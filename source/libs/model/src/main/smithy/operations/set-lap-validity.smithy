$version: "2"

namespace com.aws.solutions.deepracer

/// Sets the validity flag on a lap. Idempotent — calling with the same
/// isValid value produces no state change.
@idempotent
@http(method: "PUT", uri: "/events/{eventId}/tracks/{leaderboardId}/runs/{runId}/laps/{lapNumber}/validity")
operation SetLapValidity {
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
        isValid: Boolean
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
    ]
}
