$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/models/{modelId}/deployments/{deploymentId}")
operation GetDeployment {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @required
        @httpLabel
        deploymentId: ResourceIdentifier
    }

    output := {
        @required
        deployment: DeploymentDetail
    }

    errors: [
        NotFoundError
    ]
}
