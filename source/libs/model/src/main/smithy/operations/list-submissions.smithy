$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "submissions")
@http(method: "GET", uri: "/leaderboards/{leaderboardId}/submissions")
operation ListSubmissions {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @httpQuery("token")
        token: String
    }

    output := {
        @required
        submissions: SubmissionList

        token: String
    }

    errors: [
        NotFoundError
    ]
}
