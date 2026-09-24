$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/events/{eventId}/transition")
operation TransitionEventStatus {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        action: EventTransitionAction
    }

    output := {
        @required
        eventId: ResourceIdentifier

        @required
        status: EventStatus
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}
