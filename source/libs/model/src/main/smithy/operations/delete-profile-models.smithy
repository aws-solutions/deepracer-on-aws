$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "DELETE", uri: "/profiles/{profileId}/models")
operation DeleteProfileModels {
    input := {
        @required
        @httpLabel
        profileId: ResourceIdentifier
    }

    errors: [
        NotFoundError
        BadRequestError
    ]
}
