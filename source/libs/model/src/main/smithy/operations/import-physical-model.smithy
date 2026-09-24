$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/importphysicalmodel")
operation ImportPhysicalModel {
    input := {
        @required
        s3Bucket: String

        @required
        s3Path: String

        @required
        modelName: ModelName
    }

    output := {
        @required
        modelId: ResourceIdentifier
    }

    errors: [
        BadRequestError
        NotAuthorizedError
    ]
}
