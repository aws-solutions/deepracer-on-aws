$version: "2"

namespace com.aws.solutions.deepracer

enum OptimizationStatus {
    IN_PROGRESS
    OPTIMIZED
    FAILED
}

enum DeploymentStatus {
    PENDING
    IN_PROGRESS
    COMPLETED
    FAILED
}

enum ModelSource {
    TRAINED
    IMPORTED_VIRTUAL
    IMPORTED_PHYSICAL
}

structure DeploymentSummary {
    @required
    deploymentId: ResourceIdentifier

    @required
    modelId: ResourceIdentifier

    modelName: ModelName

    @required
    carInstanceId: InstanceId

    carName: String

    batchId: ResourceIdentifier

    fleetId: ResourceIdentifier

    @required
    status: DeploymentStatus

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @timestampFormat("date-time")
    uploadStartedAt: Timestamp

    @timestampFormat("date-time")
    completedAt: Timestamp

    errorMessage: String
}

list DeploymentSummaryList {
    member: DeploymentSummary
}

structure DeploymentDetail {
    @required
    deploymentId: ResourceIdentifier

    @required
    modelId: ResourceIdentifier

    modelName: ModelName

    @required
    carInstanceId: InstanceId

    carName: String

    eventId: ResourceIdentifier

    fleetId: ResourceIdentifier

    @required
    profileId: ResourceIdentifier

    batchId: ResourceIdentifier

    @required
    status: DeploymentStatus

    errorMessage: String

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @timestampFormat("date-time")
    uploadStartedAt: Timestamp

    @timestampFormat("date-time")
    completedAt: Timestamp
}
