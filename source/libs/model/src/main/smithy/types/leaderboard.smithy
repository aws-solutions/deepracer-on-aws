$version: "2"

namespace com.aws.solutions.deepracer

@mixin
structure BaseLeaderboard {
    @required
    name: ResourceName

    description: Description

    @required
    @timestampFormat("date-time")
    openTime: Timestamp

    @required
    @timestampFormat("date-time")
    closeTime: Timestamp

    @required
    trackConfig: TrackConfig

    @required
    raceType: RaceType

    @required
    maxSubmissionsPerUser: NonNegativeInteger

    objectAvoidanceConfig: ObjectAvoidanceConfig

    @required
    resettingBehaviorConfig: ResettingBehaviorConfig

    @required
    submissionTerminationConditions: SubmissionTerminationConditions

    @required
    timingMethod: TimingMethod

    liveEventStatus: LiveEventStatus

    isLive: Boolean

    @timestampFormat("date-time")
    liveEventTime: Timestamp

    maxResets: NonNegativeInteger

    submissionPeriodOpen: Boolean

    // Physical Event Management (v1.3.0) — client-writable track fields shared by
    // LeaderboardDefinition and Leaderboard.
    fleetId: ResourceIdentifier

    // Physical Event Management (v1.3.0) — per-track leaderboard footer text, shown
    // beneath the track's leaderboard (mirrors DREM's leaderBoardFooter). Absent for
    // standalone virtual leaderboards (backward compatible).
    leaderBoardFooter: Description
}

structure LeaderboardDefinition with [BaseLeaderboard] {}

structure Leaderboard with [BaseLeaderboard] {
    @required
    leaderboardId: ResourceIdentifier

    @required
    participantCount: NonNegativeInteger

    // Physical Event Management (v1.3.0) — server-set read-only fields. On the
    // Leaderboard response shape only; not accepted as input via LeaderboardDefinition.
    // Absent/null for standalone virtual leaderboards (backward compatible).
    eventId: ResourceIdentifier

    trackType: TrackId
}

list LeaderboardList {
    member: Leaderboard
}

structure ResettingBehaviorConfig {
    @required
    continuousLap: Boolean

    collisionPenaltySeconds: NonNegativeDouble

    offTrackPenaltySeconds: NonNegativeDouble
}

structure SubmissionTerminationConditions {
    @required
    minimumLaps: NonNegativeInteger

    @required
    maximumLaps: NonNegativeInteger

    maxTimeInMinutes: NonNegativeInteger
}

enum TimingMethod {
    AVG_LAP_TIME
    BEST_LAP_TIME
    TOTAL_TIME
}
