$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/events/{eventId}/tracks/{leaderboardId}/runs", code: 201)
operation CreateRun {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        profileId: ResourceIdentifier

        racedByProxy: Boolean
    }

    output := {
        @required
        run: Run
    }

    errors: [
        NotFoundError
        ConflictError
        BadRequestError
    ]
}
