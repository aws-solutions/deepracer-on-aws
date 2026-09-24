$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "deployments", pageSize: "maxResults")
@http(method: "GET", uri: "/deployments")
operation ListDeploymentsByBatch {
    input := {
        @required
        @httpQuery("batchId")
        batchId: ResourceIdentifier

        @httpQuery("token")
        token: String

        @httpQuery("maxResults")
        @range(min: 1, max: 100)
        maxResults: Integer
    }

    output := {
        @required
        batchId: ResourceIdentifier

        @required
        deployments: DeploymentSummaryList

        token: String
    }
}
