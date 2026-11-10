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

/// A usage quota: -1 means unlimited, otherwise a non-negative limit.
@range(min: -1)
integer QuotaLimit

/// Bounded input list for BatchUpdateProfileQuotas. Duplicate IDs are rejected. The output list stays unbounded (it may be empty).
@length(min: 1, max: 200)
@uniqueItems
list BatchUpdateProfileQuotasProfileIds {
    member: ResourceIdentifier
}

list BatchUpdateProfileQuotasErrors {
    member: BatchUpdateProfileQuotasError
}

structure BatchUpdateProfileQuotasError {
    @required
    profileId: ResourceIdentifier

    @required
    code: String

    @required
    message: String
}
