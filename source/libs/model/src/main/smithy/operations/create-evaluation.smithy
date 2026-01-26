$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/models/{modelId}/evaluation")
operation CreateEvaluation {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @required
        evaluationConfig: EvaluationConfig
    }

    output := {
        @required
        evaluationId: ResourceIdentifier
    }

    errors: [
        NotFoundError
    ]
}
