$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/events/{eventId}/tracks/{leaderboardId}/runs/{runId}/laps", code: 201)
operation CreateLap {
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

        /// SSM managed instance ID of the car used for this lap
        deviceId: InstanceId

        @required
        lapTimeMs: PositiveInteger

        resets: NonNegativeInteger

        /// How the lap time was captured. Defaults to MANUAL. AUTO laps outside the plausible
        /// lap-time range, or with missed crossings, are saved invalid and PENDING_REVIEW.
        timingSource: LapTimingSource

        /// Number of timer crossings lost before this one (a gap in the timer's sequence numbers,
        /// a timer restart, or a crossing lap that couldn't be recorded), meaning the lap time may
        /// span more than one lap. Any lap with missed crossings is saved invalid and PENDING_REVIEW.
        missedCrossings: NonNegativeInteger

        /// Client-generated idempotency token. When supplied, the service detects replayed
        /// CreateLap requests (e.g. retries after a lost response) and avoids creating a
        /// duplicate lap. Per the idempotency standard this attribute MUST NOT be required.
        @idempotencyToken
        clientToken: String
    }

    output := {
        @required
        lap: Lap
    }

    errors: [
        NotFoundError
        ConflictError
        BadRequestError
    ]
}
