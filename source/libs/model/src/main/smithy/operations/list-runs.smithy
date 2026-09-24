$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "runs")
@http(method: "GET", uri: "/events/{eventId}/tracks/{leaderboardId}/runs")
operation ListRuns {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @httpQuery("status")
        status: RunStatus

        @httpQuery("token")
        token: String
    }

    output := {
        @required
        runs: RunList

        token: String
    }
}
