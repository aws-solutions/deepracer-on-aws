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

        @documentation("The training checkpoint to race. Defaults to BEST.")
        checkpoint: CheckpointSelection
    }

    output := {
        @required
        submissionId: ResourceIdentifier
    }

    errors: [
        NotFoundError
    ]
}
