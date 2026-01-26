$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "evaluations")
@http(method: "GET", uri: "/models/{modelId}/evaluations")
operation ListEvaluations {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @httpQuery("token")
        token: String
    }

    output := {
        @required
        evaluations: EvaluationList

        token: String
    }

    errors: [
        NotFoundError
    ]
}
