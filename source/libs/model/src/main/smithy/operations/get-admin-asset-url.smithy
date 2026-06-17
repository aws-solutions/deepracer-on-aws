$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/admin/models/{modelId}/getasset")
operation GetAdminAssetUrl {
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
        url: Url

        @required
        filename: String
    }

    errors: [
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}
