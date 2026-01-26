$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "PATCH", uri: "/models/{modelId}")
operation StopModel {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier
    }

    errors: [
        NotFoundError
    ]
}
