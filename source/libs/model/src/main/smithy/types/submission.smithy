$version: "2"

namespace com.aws.solutions.deepracer

@mixin
structure BaseSubmission {
    @required
    @timestampFormat("date-time")
    submittedAt: Timestamp

    stats: SubmissionStats

    @required
    submissionNumber: PositiveInteger

    rankingScore: PositiveInteger

    @required
    videoUrl: Url
}

structure Submission with [BaseSubmission] {
    @required
    modelId: ResourceIdentifier

    @required
    modelName: ResourceName

    @required
    status: JobStatus
}

@mixin
structure BaseRanking with [BaseSubmission] {
    @required
    rank: PositiveInteger

    @required
    rankingScore: PositiveInteger

    @required
    stats: SubmissionStats
}

structure PersonalRanking with [BaseRanking] {
    @required
    modelId: ResourceIdentifier

    @required
    modelName: ResourceName
}

structure Ranking with [BaseRanking] {
    @required
    userProfile: UserRankingProfile
}

list RankingList {
    member: Ranking
}

list SubmissionList {
    member: Submission
}

structure SubmissionStats {
    @required
    avgLapTime: PositiveInteger

    @required
    avgResets: NonNegativeDouble

    @required
    bestLapTime: PositiveInteger

    @required
    collisionCount: NonNegativeInteger

    @required
    completedLapCount: NonNegativeInteger

    @required
    offTrackCount: NonNegativeInteger

    @required
    resetCount: NonNegativeInteger

    @required
    totalLapTime: PositiveInteger
}

structure UserRankingProfile with [BaseProfile] {}
