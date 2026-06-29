$version: "2.0"

namespace com.aws.solutions.deepracer

structure LiveQueueItem {
    @required
    leaderboardId: ResourceIdentifier

    @required
    submissionId: ResourceIdentifier

    @required
    queuePosition: String

    @required
    profileId: ResourceIdentifier

    modelId: ResourceIdentifier

    @required
    modelName: ModelName

    @required
    participantName: Alias

    @required
    status: LiveQueueItemStatus

    @required
    resetCount: Integer

    @required
    @timestampFormat("date-time")
    submittedAt: Timestamp

    lastTriggeredAt: Long

    avatar: AvatarConfig
}

list LiveQueueItemList {
    member: LiveQueueItem
}

list ResourceIdentifierList {
    member: ResourceIdentifier
}
