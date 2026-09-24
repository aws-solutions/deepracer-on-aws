$version: "2"

namespace com.aws.solutions.deepracer

/// A bulk-invite job identifier: a ULID (Crockford base32, 26 uppercase chars — excludes I, L, O,
/// U). The timestamp prefix makes it lexicographically sortable by creation time, so the DynamoDB
/// sort key orders jobs chronologically. Distinct from the app-wide Nano ID
/// `ResourceIdentifier`.
@pattern("^[0-9A-HJKMNP-TV-Z]{26}$")
string BulkInviteJobId

/// Lifecycle state of a bulk invite job.
enum BulkInviteJobStatus {
    PROCESSING

    COMPLETED

    FAILED

    /// Derived (and persisted) for a PROCESSING record older than the 30-minute staleness horizon:
    /// gives the frontend a terminal state that stops polling when neither the state machine's Catch
    /// block nor a cleanup write could update the record (aborted execution, failed cleanup write).
    EXPIRED
}

/// Outcome of processing a single entry within a bulk invite job.
enum BulkInviteEntryStatus {
    CREATED
    SKIPPED
    FAILED
}

/// A single row from the uploaded CSV: a required email address and an optional display name.
/// The email is sensitive PII, so it is not logged in plaintext.
structure BulkInviteEntry {
    @required
    @length(min: 1, max: 254)
    emailAddress: SensitiveString

    @length(max: 128)
    displayName: String
}

/// Up to 200 entries per request (CSV limit). Bounded per the
/// Unbounded/Batch Operations API standard.
@length(min: 1, max: 200)
list BulkInviteEntryList {
    member: BulkInviteEntry
}

/// Per-entry processing result, populated incrementally by the state machine as each Map
/// iteration completes.
structure BulkInviteResult {
    @required
    emailAddress: SensitiveString

    displayName: String

    @required
    status: BulkInviteEntryStatus

    /// Present for SKIPPED entries (reason) and FAILED entries (error detail).
    reason: String
}

/// Bounded by the batch cap: at most one result per submitted entry.
@length(max: 200)
list BulkInviteResultList {
    member: BulkInviteResult
}

/// Lightweight summary of a bulk invite job (excludes the per-entry `results` list). Returned by
/// ListBulkInviteUserJobs so the frontend can detect and resume an in-progress job.
structure BulkInviteJobSummary {
    @required
    jobId: ResourceIdentifier

    @required
    status: BulkInviteJobStatus

    @required
    totalEntries: NonNegativeInteger

    @required
    processedCount: NonNegativeInteger

    @required
    createdCount: NonNegativeInteger

    @required
    skippedCount: NonNegativeInteger

    @required
    failedCount: NonNegativeInteger

    /// ISO-8601 creation timestamp; the list is ordered most-recent-first by this value.
    @required
    createdAt: String
}

/// Bounded to a recent-history window — the frontend only needs the most recent job.
@length(max: 100)
list BulkInviteJobSummaryList {
    member: BulkInviteJobSummary
}
