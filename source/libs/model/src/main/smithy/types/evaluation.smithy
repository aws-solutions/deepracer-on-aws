$version: "2"

namespace com.aws.solutions.deepracer

structure Evaluation {
    @required
    modelId: ResourceIdentifier

    @required
    evaluationId: ResourceIdentifier

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @required
    status: JobStatus

    @required
    config: EvaluationConfig

    @required
    metrics: EvaluationMetrics

    videoStreamUrl: Url

    videoUrl: Url
}

list EvaluationList {
    member: Evaluation
}

enum EpisodeStatus {
    CRASHED = "Crashed"
    IMMOBILIZED = "Immobilized"
    IN_PROGRESS = "In progress"
    LAP_COMPLETE = "Lap complete"
    OFF_TRACK = "Off track"
    PARK = "Park"
    PAUSE = "Pause"
    PREPARE = "Prepare"
    REVERSED = "Reversed"
    TIME_UP = "Time Up"
}

structure EvaluationMetric {
    @required
    completionPercentage: PositiveInteger

    @required
    crashCount: NonNegativeInteger

    @required
    elapsedTimeInMilliseconds: PositiveInteger

    @required
    episodeStatus: EpisodeStatus

    @required
    offTrackCount: NonNegativeInteger

    @required
    resetCount: NonNegativeInteger

    @required
    trial: PositiveInteger
}

list EvaluationMetrics {
    member: EvaluationMetric
}
