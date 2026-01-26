$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/models/{modelId}/getasset")
operation GetAssetUrl {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @required
        @httpQuery("assetType")
        assetType: AssetType

        @httpQuery("evaluationId")
        evaluationId: ResourceIdentifier
    }

    output := {
        url: Url
        status: ModelStatus
    }

    errors: [
        NotFoundError
    ]
}
