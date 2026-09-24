$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/events/{eventId}")
operation GetEvent {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier
    }

    output := {
        @required
        event: Event
    }

    errors: [
        NotFoundError
    ]
}
