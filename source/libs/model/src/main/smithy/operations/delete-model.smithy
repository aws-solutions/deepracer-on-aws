$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "DELETE", uri: "/models/{modelId}")
operation DeleteModel {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier
    }

    errors: [
        NotFoundError
    ]
}
