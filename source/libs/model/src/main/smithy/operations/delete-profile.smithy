$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "DELETE", uri: "/profiles/{profileId}")
operation DeleteProfile {
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
