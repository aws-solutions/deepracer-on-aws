$version: "2"

namespace com.aws.solutions.deepracer

/// Updates an existing event's configuration. Only provided fields are applied.
/// Matches the PATCH convention used by EditLeaderboard.
@http(method: "PATCH", uri: "/events/{eventId}")
operation EditEvent {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        eventDefinition: EventDefinition
    }

    output := {
        @required
        event: Event
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}
