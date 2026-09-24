$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "DELETE", uri: "/events/{eventId}", code: 202)
operation DeleteEvent {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier
    }

    output := {
        @required
        eventId: ResourceIdentifier

        @required
        status: EventStatus

        @required
        message: String
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}
