$version: "2"

namespace com.aws.solutions.deepracer

@mixin
structure BaseProfile {
    @required
    alias: Alias

    @required
    avatar: AvatarConfig
}

structure Profile with [BaseProfile] {
    @required
    profileId: ResourceIdentifier

    emailAddress: String

    computeMinutesUsed: NonNegativeInteger

    computeMinutesQueued: NonNegativeInteger

    maxTotalComputeMinutes: Integer

    modelCount: NonNegativeInteger

    maxModelCount: Integer

    modelStorageUsage: NonNegativeInteger

    roleName: String

    createdAt: String
}

structure AvatarConfig {
    accessories: AvatarItem
    clothing: AvatarItem
    clothingColor: AvatarItem
    countryCode: AvatarItem
    eyes: AvatarItem
    eyebrows: AvatarItem
    facialHair: AvatarItem
    facialHairColor: AvatarItem
    hairColor: AvatarItem
    hatColor: AvatarItem
    mouth: AvatarItem
    skinColor: AvatarItem
    top: AvatarItem
    tshirtGraphic: AvatarItem
}

@length(min: 0, max: 40)
@pattern("^[a-zA-Z0-9\\-\\ ]*$")
string AvatarItem
