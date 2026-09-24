$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/models/{modelId}/package", code: 202)
operation PackageModel {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @required
        @httpQuery("profileId")
        profileId: ResourceIdentifier
    }

    output := {
        @required
        modelId: ResourceIdentifier
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}
