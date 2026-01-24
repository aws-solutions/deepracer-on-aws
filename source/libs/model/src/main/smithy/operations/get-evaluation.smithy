$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/models/{modelId}/evaluations/{evaluationId}")
operation GetEvaluation {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @required
        @httpLabel
        evaluationId: ResourceIdentifier
    }

    output := {
        @required
        evaluation: Evaluation
    }

    errors: [
        NotFoundError
    ]
}
