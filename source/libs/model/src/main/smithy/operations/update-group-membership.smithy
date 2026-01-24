$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "PUT", uri: "/profile/role")
@idempotent
operation UpdateGroupMembership {
    input := {
        @required
        profileId: ResourceIdentifier

        @required
        targetUserPoolGroup: UserGroups
    }
}
