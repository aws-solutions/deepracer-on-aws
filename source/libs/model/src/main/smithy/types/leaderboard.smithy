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
}

structure LeaderboardDefinition with [BaseLeaderboard] {}

structure Leaderboard with [BaseLeaderboard] {
    @required
    leaderboardId: ResourceIdentifier

    @required
    participantCount: NonNegativeInteger
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
