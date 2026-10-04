$version: "2"

namespace com.aws.solutions.deepracer

/// SHA-256 (hex) of the asset's S3 key; deterministic so re-processing is idempotent.
@pattern("^[a-f0-9]{64}$")
string CarLogAssetId

/// Racer name as used in car folder and bag names (alias characters only).
@pattern("^[A-Za-z0-9_-]{1,64}$")
string CarLogRacerName

enum CarLogAssetType {
    BAG_SQLITE
    BAG_MCAP
    VIDEO
}

enum CarLogFetchStatus {
    CREATED
    REQUESTED_UPLOAD
    WAITING_FOR_UPLOAD
    UPLOAD_FAILED
    UPLOADED
    ANALYZED
    QUEUED_FOR_PROCESSING
    PROCESSING
    DONE
    FAILED
}

structure CarLogModelRef {
    @required
    modelId: ResourceIdentifier

    modelName: ModelName
}

list CarLogModelRefList {
    member: CarLogModelRef
}

structure CarLogMediaMetadata {
    @range(min: 0)
    durationSeconds: Double

    codec: String

    @range(min: 0)
    fps: Double

    resolution: String
}

structure CarLogAsset {
    @required
    assetId: CarLogAssetId

    @required
    profileId: ResourceIdentifier

    racerName: String

    @required
    type: CarLogAssetType

    @required
    filename: String

    @required
    @timestampFormat("date-time")
    uploadedAt: Timestamp

    models: CarLogModelRefList

    eventId: ResourceIdentifier

    eventName: String

    fetchJobId: ResourceIdentifier

    carName: String

    mediaMetadata: CarLogMediaMetadata
}

list CarLogAssetList {
    member: CarLogAsset
}

structure CarLogFetchJob {
    @required
    jobId: ResourceIdentifier

    instanceId: InstanceId

    carName: String

    eventId: ResourceIdentifier

    eventName: String

    runId: ResourceIdentifier

    modelId: ResourceIdentifier

    racerName: String

    @timestampFormat("date-time")
    laterThan: Timestamp

    @required
    status: CarLogFetchStatus

    errorMessage: String

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @timestampFormat("date-time")
    endedAt: Timestamp
}

list CarLogFetchJobList {
    member: CarLogFetchJob
}

structure CarLogAssetReference {
    @required
    profileId: ResourceIdentifier

    @required
    assetId: CarLogAssetId
}

@length(min: 1, max: 25)
list CarLogAssetReferenceList {
    member: CarLogAssetReference
}

structure CarLogAssetUrl {
    @required
    assetId: CarLogAssetId

    @required
    url: Url

    @required
    filename: String
}

list CarLogAssetUrlList {
    member: CarLogAssetUrl
}

structure CarLogAssetUrlError {
    @required
    assetId: CarLogAssetId

    @required
    code: String

    @required
    message: String
}

list CarLogAssetUrlErrorList {
    member: CarLogAssetUrlError
}
