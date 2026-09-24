$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "deployments", pageSize: "maxResults")
@http(method: "GET", uri: "/models/{modelId}/deployments")
operation ListDeployments {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @httpQuery("token")
        token: String

        @httpQuery("maxResults")
        @range(min: 1, max: 100)
        maxResults: Integer
    }

    output := {
        @required
        deployments: DeploymentSummaryList

        token: String
    }

    errors: [
        NotFoundError
    ]
}
