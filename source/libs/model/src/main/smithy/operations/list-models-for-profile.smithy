$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/admin/profiles/{profileId}/models")
operation ListModelsForProfile {
    input := {
        @required
        @httpLabel
        profileId: ResourceIdentifier
    }

    output := {
        @required
        models: AdminModelList
    }

    errors: [
        NotAuthorizedError
        NotFoundError
        InternalFailureError
    ]
}

list AdminModelList {
    member: AdminModel
}

structure AdminModel {
    @required
    modelId: ResourceIdentifier

    @required
    name: ModelName

    @required
    status: ModelStatus

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp
}
