$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/models/{modelId}/deployments", code: 202)
operation DeployModel {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier

        @required
        @httpQuery("profileId")
        profileId: ResourceIdentifier

        @required
        carInstanceId: InstanceId

        @required
        eventId: ResourceIdentifier

        batchId: ResourceIdentifier
    }

    output := {
        @required
        deploymentId: ResourceIdentifier

        @required
        modelId: ResourceIdentifier

        @required
        carInstanceId: InstanceId

        @required
        status: DeploymentStatus
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}
