$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/admin/models")
operation ListAdminModels {
    input := {
        @httpQuery("status")
        status: ModelStatus

        @httpQuery("optimizationStatus")
        optimizationStatus: OptimizationStatus
    }

    output := {
        @required
        models: AdminModelExtendedList
    }

    errors: [
        NotAuthorizedError
        InternalFailureError
    ]
}

list AdminModelExtendedList {
    member: AdminModelExtended
}

/// Extended admin model with denormalized username and full metadata for the operator Models page.
structure AdminModelExtended {
    @required
    modelId: ResourceIdentifier

    @required
    name: ModelName

    @required
    username: String

    @required
    profileId: ResourceIdentifier

    @required
    status: ModelStatus

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    modelSource: ModelSource

    optimizationStatus: OptimizationStatus

    importErrorMessage: String

    optimizationErrorMessage: String

    metadata: AdminModelMetadata
}

/// Subset of model metadata relevant to the operator view (no rewardFunction/hyperparameters).
structure AdminModelMetadata {
    agentAlgorithm: AgentAlgorithm
    sensors: Sensors
    actionSpace: ActionSpace
    modelMD5: String
    metadataMD5: String
}
