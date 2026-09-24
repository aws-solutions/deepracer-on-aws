$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/events/{eventId}/statistics")
operation GetEventStatistics {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier
    }

    output := {
        @required
        statistics: EventStatistics
    }

    errors: [
        NotFoundError
        NotAuthorizedError
        BadRequestError
    ]
}
