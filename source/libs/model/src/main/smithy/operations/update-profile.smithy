$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "PATCH", uri: "/profile")
operation UpdateProfile {
    input := {
        alias: Alias
        avatar: AvatarConfig
        computeMinutesUsed: NonNegativeInteger
        computeMinutesQueued: NonNegativeInteger
        maxTotalComputeMinutes: Integer
        maxModelCount: Integer
        profileId: ResourceIdentifier
    }

    output := {
        @required
        profile: Profile
    }
}
