$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "events")
@http(method: "GET", uri: "/events")
operation ListEvents {
    input := {
        @httpQuery("token")
        token: String

        @httpQuery("status")
        status: EventStatus
    }

    output := {
        @required
        events: EventList

        token: String
    }
}
