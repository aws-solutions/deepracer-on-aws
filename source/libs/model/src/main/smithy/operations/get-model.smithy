$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/models/{modelId}")
operation GetModel {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier
    }

    output := {
        @required
        model: Model
    }

    errors: [
        NotFoundError
    ]
}
