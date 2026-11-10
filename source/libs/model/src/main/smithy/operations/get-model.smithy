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

        @documentation(
            """
            The model's best and last training checkpoints, for choosing one to evaluate, race, or clone.
            Present only for a READY model that has checkpoints recorded."""
        )
        checkpoints: ModelCheckpoints
    }

    errors: [
        NotFoundError
    ]
}
