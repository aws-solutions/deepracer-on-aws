$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "DELETE", uri: "/events/{eventId}/tracks/{leaderboardId}")
operation RemoveTrackFromEvent {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}
