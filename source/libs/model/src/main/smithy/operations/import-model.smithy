$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/importmodel")
operation ImportModel {
    input := {
        @required
        s3Bucket: String

        @required
        s3Path: String

        @required
        modelName: ModelName

        modelDescription: ModelDescription
    }

    output := {
        @required
        modelId: ResourceIdentifier
    }
}
