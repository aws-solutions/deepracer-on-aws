$version: "2"

namespace com.aws.solutions.deepracer

/// Starts fetching rosbag logs from a car and turning them into videos. Admin/facilitator only.
/// When `runId` is given, the event, racer, model and start time are derived server-side from
/// the run (the model is not part of a run, so `modelId` or the racer name selects the bags).
@http(method: "POST", uri: "/car-logs/fetches", code: 202)
operation StartCarLogFetch {
    input := {
        @required
        instanceId: InstanceId

        runId: ResourceIdentifier

        /// Required together with `runId` (runs are keyed by leaderboard).
        leaderboardId: ResourceIdentifier

        /// Only fetch bags written by this model (matched on the model ID in the bag directory name).
        modelId: ResourceIdentifier

        /// Only fetch bags created after this time.
        @timestampFormat("date-time")
        laterThan: Timestamp

        /// Only used when `modelId` is not given.
        racerName: CarLogRacerName
    }

    output := {
        @required
        jobId: ResourceIdentifier
    }

    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
        ConflictError
    ]
}

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "jobs", pageSize: "maxResults")
@http(method: "GET", uri: "/car-logs/fetches")
operation ListCarLogFetches {
    input := {
        @httpQuery("eventId")
        eventId: ResourceIdentifier

        @httpQuery("token")
        token: String

        @httpQuery("maxResults")
        @range(min: 1, max: 100)
        maxResults: Integer
    }

    output := {
        @required
        jobs: CarLogFetchJobList

        token: String
    }

    errors: [
        NotAuthorizedError
    ]
}

@readonly
@http(method: "GET", uri: "/car-logs/fetches/{jobId}")
operation GetCarLogFetch {
    input := {
        @required
        @httpLabel
        jobId: ResourceIdentifier
    }

    output := {
        @required
        job: CarLogFetchJob
    }

    errors: [
        NotAuthorizedError
        NotFoundError
    ]
}

/// Lists car log assets (bags and videos). Racers only see their own; admins, facilitators
/// and commentators see everyone's and may filter by `profileId`.
@readonly
@paginated(inputToken: "token", outputToken: "token", items: "assets", pageSize: "maxResults")
@http(method: "GET", uri: "/car-logs/assets")
operation ListCarLogAssets {
    input := {
        @httpQuery("profileId")
        profileId: ResourceIdentifier

        @httpQuery("type")
        type: CarLogAssetType

        @httpQuery("token")
        token: String

        @httpQuery("maxResults")
        @range(min: 1, max: 100)
        maxResults: Integer
    }

    output := {
        @required
        assets: CarLogAssetList

        token: String
    }

    errors: [
        NotAuthorizedError
    ]
}

/// Returns short-lived download URLs. Racers may only download their own assets and
/// commentators may not download. Bags are packaged as a zip archive. Items that cannot be
/// served are reported in `errors` (partial success).
@http(method: "POST", uri: "/car-logs/assets/urls")
operation GetCarLogAssetUrls {
    input := {
        @required
        assets: CarLogAssetReferenceList
    }

    output := {
        @required
        urls: CarLogAssetUrlList

        @required
        errors: CarLogAssetUrlErrorList
    }

    errors: [
        NotAuthorizedError
    ]
}

@idempotent
@http(method: "DELETE", uri: "/car-logs/assets/{profileId}/{assetId}")
operation DeleteCarLogAsset {
    input := {
        @required
        @httpLabel
        profileId: ResourceIdentifier

        @required
        @httpLabel
        assetId: CarLogAssetId
    }

    errors: [
        NotAuthorizedError
        NotFoundError
    ]
}

/// Creates a processing job for a manually collected `.tar.gz` of car logs and returns a
/// short-lived presigned upload URL. Processing starts automatically once the upload completes.
/// Admin/facilitator only.
@http(method: "POST", uri: "/car-logs/uploads", code: 201)
operation CreateCarLogUpload {
    input := {}

    output := {
        @required
        jobId: ResourceIdentifier

        @required
        url: Url

        @required
        @timestampFormat("date-time")
        expiresAt: Timestamp
    }

    errors: [
        NotAuthorizedError
    ]
}
