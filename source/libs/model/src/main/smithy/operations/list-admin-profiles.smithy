$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/admin/profiles")
operation ListAdminProfiles {
    input := {}

    output := {
        @required
        profiles: AdminProfileList
    }

    errors: [
        NotAuthorizedError
        InternalFailureError
    ]
}

list AdminProfileList {
    member: AdminProfile
}

structure AdminProfile {
    @required
    profileId: ResourceIdentifier

    @required
    alias: String

    emailAddress: String

    totalModelCount: NonNegativeInteger
}
