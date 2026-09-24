$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/events/{eventId}/tracks/{leaderboardId}/runs/{runId}")
operation GetRun {
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
    }

    output := {
        @required
        run: Run

        @required
        laps: LapList
    }

    errors: [
        NotFoundError
    ]
}
