$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/events")
operation CreateEvent {
    input := {
        @required
        eventDefinition: EventDefinition
    }

    output := {
        @required
        eventId: ResourceIdentifier
    }

    errors: [
        BadRequestError
    ]
}
