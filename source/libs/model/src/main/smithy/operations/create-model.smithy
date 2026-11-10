$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/models")
operation CreateModel {
    input := {
        @required
        modelDefinition: ModelDefinition

        preTrainedModelId: ResourceIdentifier

        @documentation("The pre-trained model's checkpoint to start from. Only valid with preTrainedModelId. Defaults to BEST.")
        preTrainedCheckpoint: CheckpointSelection
    }

    output := {
        @required
        modelId: ResourceIdentifier
    }
}
