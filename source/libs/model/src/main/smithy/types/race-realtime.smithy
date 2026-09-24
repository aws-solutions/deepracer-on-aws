$version: "2"

namespace com.aws.solutions.deepracer

/// Race status state machine for the facilitator overlay run state.
enum RaceStatus {
    NO_RACER_SELECTED
    READY_TO_START
    RACE_IN_PROGRESS
    RACE_PAUSED
    RACE_FINISHED
    RACE_SUBMITTED
}

/// Payload for RUN_STARTED event — emitted when a Run transitions from READY to IN_PROGRESS.
structure RunStartedEvent {
    @required
    eventId: ResourceIdentifier

    @required
    trackId: ResourceIdentifier

    @required
    racerId: ResourceIdentifier

    @required
    @length(min: 1, max: 128)
    modelName: String

    @required
    @length(min: 1, max: 128)
    carName: String
}

/// Payload for RUN_FINISHED event — emitted when a Run transitions to SUBMITTED.
structure RunFinishedEvent {
    @required
    eventId: ResourceIdentifier

    @required
    trackId: ResourceIdentifier

    @required
    racerId: ResourceIdentifier

    @required
    laps: RunFinishedLapList

    @required
    bestLapTimeMilliseconds: NonNegativeInteger
}

@length(min: 0, max: 100)
list RunFinishedLapList {
    member: RaceFinishedLap
}

structure RaceFinishedLap {
    @required
    lapNumber: PositiveInteger

    @required
    lapTimeMilliseconds: NonNegativeInteger

    @required
    isValid: Boolean

    @required
    resets: NonNegativeInteger
}

/// Payload for LEADERBOARD_UPDATED event — emitted on Ranking INSERT/MODIFY (top-50 only).
structure LeaderboardUpdatedEvent {
    @required
    eventId: ResourceIdentifier

    @required
    trackId: ResourceIdentifier

    @required
    rankings: LeaderboardRankingList
}

@length(min: 0, max: 50)
list LeaderboardRankingList {
    member: LeaderboardRankingEntry
}

structure LeaderboardRankingEntry {
    @required
    rank: PositiveInteger

    @required
    @length(min: 1, max: 128)
    participantName: String

    @required
    bestLapTimeMilliseconds: NonNegativeInteger

    @length(min: 1, max: 128)
    modelName: String

    @length(min: 2, max: 2)
    @pattern("^[A-Z]{2}$")
    country: String
}

/// Payload for RACE_STATUS_CHANGED event — emitted on Event entity status change.
structure RaceStatusChangedEvent {
    @required
    eventId: ResourceIdentifier

    @required
    trackId: ResourceIdentifier

    @required
    status: EventStatus
}

/// Payload for LAP_CAPTURED event — emitted by facilitator UI on lap capture.
structure LapCapturedEvent {
    @required
    eventId: ResourceIdentifier

    @required
    trackId: ResourceIdentifier

    @required
    lapNumber: PositiveInteger

    @required
    lapTimeMilliseconds: NonNegativeInteger

    @required
    isValid: Boolean

    @required
    resets: NonNegativeInteger
}

/// Payload for OVERLAY_UPDATE event — emitted by facilitator UI (~2s tick).
structure OverlayUpdateEvent {
    @required
    eventId: ResourceIdentifier

    @required
    trackId: ResourceIdentifier

    @required
    @length(min: 1, max: 128)
    racerName: String

    @required
    laps: OverlayLapList

    @required
    timeLeftMilliseconds: NonNegativeInteger

    @required
    currentLapTimeMilliseconds: NonNegativeInteger

    @required
    raceStatus: RaceStatus
}

@length(min: 0, max: 100)
list OverlayLapList {
    member: OverlayLap
}

structure OverlayLap {
    @required
    lapNumber: PositiveInteger

    @required
    lapTimeMilliseconds: NonNegativeInteger

    @required
    isValid: Boolean
}
