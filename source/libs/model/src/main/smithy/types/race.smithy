$version: "2"

namespace com.aws.solutions.deepracer

structure ObjectAvoidanceConfig {
    @required
    numberOfObjects: NonNegativeInteger

    objectPositions: ObjectList
}

@length(min: 0)
list ObjectList {
    member: ObjectPosition
}

structure ObjectPosition {
    @required
    laneNumber: LaneNumber

    @required
    trackPercentage: NormalizedValue
}

@range(min: -1, max: 1)
integer LaneNumber

enum RaceType {
    TIME_TRIAL
    OBJECT_AVOIDANCE
}
