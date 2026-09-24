$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/events/{eventId}/tracks/{leaderboardId}/runs/{runId}/transition")
operation TransitionRunStatus {
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
        action: RunTransitionAction
    }

    output := {
        @required
        run: Run

        /// Populated only when the run transitions into SUBMITTED status — the
        /// racer's score computed from valid laps per the event's raceFormat.
        rankingScore: PositiveInteger
    }

    errors: [
        NotFoundError
        ConflictError
        BadRequestError
    ]
}
