$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/leaderboards/{leaderboardId}/submissions")
operation CreateSubmission {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier

        @required
        modelId: ResourceIdentifier
    }

    output := {
        @required
        submissionId: ResourceIdentifier
    }

    errors: [
        NotFoundError
    ]
}
