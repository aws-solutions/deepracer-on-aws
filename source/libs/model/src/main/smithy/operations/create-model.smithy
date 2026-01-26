$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/models")
operation CreateModel {
    input := {
        @required
        modelDefinition: ModelDefinition

        preTrainedModelId: ResourceIdentifier
    }

    output := {
        @required
        modelId: ResourceIdentifier
    }
}
