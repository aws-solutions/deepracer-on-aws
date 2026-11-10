$version: "2"

namespace com.aws.solutions.deepracer

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────
enum EventStatus {
    /// Event is being configured and is not yet visible to participants
    DRAFT

    /// Event is published and accepting registrations/submissions
    OPEN

    /// Racing is actively underway
    IN_PROGRESS

    /// All racing finished; results are final
    COMPLETED

    /// Event hidden from active views; retained for historical reporting
    ARCHIVED

    /// System-internal: event is being asynchronously deleted; invisible to all read APIs
    DELETING
}

enum EventType {
    PRIVATE_WORKSHOP
    OFFICIAL_WORKSHOP
    PRIVATE_TRACK_RACE
    OFFICIAL_TRACK_RACE
    AWS_SUMMIT
    TEST_EVENT
    OTHER
}

enum RaceFormat {
    BEST_LAP
    AVERAGE_LAPS
}

/// Strategy for combining scores across multiple tracks in a multi-track event
enum CombinedScoringStrategy {
    /// Take each racer's best single result from any track they raced on
    BEST_RESULT_PER_RACER

    /// Sum each racer's best time from every track they have raced (tracks may run
    /// concurrently as independent heats; a racer need not have raced every track)
    SUM_ACROSS_TRACKS

    /// Average each racer's best time from every track
    AVERAGE_ACROSS_TRACKS
}

/// Actions that trigger event state machine transitions
enum EventTransitionAction {
    /// DRAFT → OPEN: publish event
    OPEN

    /// OPEN → IN_PROGRESS: begin racing
    START

    /// IN_PROGRESS → COMPLETED: end racing, finalize results
    COMPLETE

    /// COMPLETED → ARCHIVED: hide from active views
    ARCHIVE
}

// ─────────────────────────────────────────────────────────────────────────────
// Structures — Event
// ─────────────────────────────────────────────────────────────────────────────
@mixin
structure BaseEvent {
    @required
    name: ResourceName

    @required
    eventType: EventType

    @required
    raceFormat: RaceFormat

    /// ISO 8601 date string (YYYY-MM-DD) of the event
    @required
    eventDate: String

    /// ISO 3166-1 alpha-2 country code (e.g. "GB", "US")
    @required
    @length(min: 2, max: 2)
    @pattern("^[A-Z]{2}$")
    countryCode: String

    /// Maximum laps per run before the run is auto-finished
    @required
    maxLaps: PositiveInteger

    /// Maximum run duration in minutes before the run is auto-finished
    @required
    maxTimeInMinutes: PositiveInteger

    /// Maximum runs a single racer may have across the event
    maxRunsPerRacer: PositiveInteger

    /// Maximum resets allowed per run
    @required
    maxResets: NonNegativeInteger

    /// Number of most-recent valid laps to average when raceFormat is AVERAGE_LAPS.
    /// Required when raceFormat is AVERAGE_LAPS; ignored otherwise.
    averageLapsWindow: PositiveInteger

    /// Strategy for combining scores across tracks in multi-track events.
    /// Required when the event has more than one track.
    combinedScoringStrategy: CombinedScoringStrategy

    /// Header text shown above the combined leaderboard in multi-track events.
    /// Absent for events without a combined leaderboard. Editable while DRAFT or OPEN.
    combinedLeaderBoardHeader: ResourceName

    /// Footer text shown beneath the combined leaderboard in multi-track events.
    /// Absent for events without a combined leaderboard. Editable while DRAFT or OPEN.
    combinedLeaderBoardFooter: Description

    @length(min: 1, max: 128)
    sponsor: String
}

structure EventDefinition with [BaseEvent] {}

structure Event with [BaseEvent] {
    @required
    eventId: ResourceIdentifier

    @required
    eventStatus: EventStatus

    /// Alias of the user who created this event (immutable, set at creation)
    @required
    createdBy: String

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @required
    @timestampFormat("date-time")
    updatedAt: Timestamp
}

list EventList {
    member: Event
}

// ─────────────────────────────────────────────────────────────────────────────
// Structures — Event statistics
// ─────────────────────────────────────────────────────────────────────────────
/// Aggregate metrics for all runs and laps recorded within an event.
structure EventStatistics {
    @required
    totalRuns: NonNegativeInteger

    @required
    completedRuns: NonNegativeInteger

    @required
    discardedRuns: NonNegativeInteger

    @required
    totalValidLaps: NonNegativeInteger

    @required
    averageLapsPerRun: NonNegativeDouble

    /// Fastest valid lap time across the event, in milliseconds. Absent if no valid laps exist.
    fastestLapMs: PositiveInteger

    /// Average valid lap time across the event, in milliseconds. Absent if no valid laps exist.
    averageLapTimeMs: NonNegativeDouble

    @required
    uniqueRacerCount: NonNegativeInteger

    /// Percentage (0-1) of runs that reached SUBMITTED status out of all non-discarded runs.
    @required
    completionRate: NormalizedValue
}

// ─────────────────────────────────────────────────────────────────────────────
// Enums — Run
// ─────────────────────────────────────────────────────────────────────────────
enum RunStatus {
    /// Run created; racer is at the start line
    READY

    /// Racer is actively racing (timer running)
    IN_PROGRESS

    /// Timer temporarily paused
    PAUSED

    /// Timer stopped; facilitator is reviewing laps
    FINISHED

    /// Laps finalized and posted to the leaderboard
    SUBMITTED

    /// Run voided; laps do not count toward rankings
    DISCARDED
}

/// How a lap's time was captured
enum LapTimingSource {
    /// Facilitator clicked Record lap
    MANUAL

    /// Hardware timer (RPi sensor) detected the crossing
    AUTO
}

/// Whether a lap's time needs a facilitator's review before it counts
enum LapReviewStatus {
    /// Lap time is trusted as recorded
    NOT_REQUIRED

    /// AUTO lap time is suspect (out of range or crossings were missed); saved invalid until reviewed
    PENDING_REVIEW

    /// Facilitator has set the validity of a lap that was pending review
    REVIEWED
}

/// Actions that trigger run state machine transitions
enum RunTransitionAction {
    /// READY → IN_PROGRESS: begin timing
    START

    /// IN_PROGRESS → PAUSED: pause timer
    PAUSE

    /// PAUSED → IN_PROGRESS: resume timer
    RESUME

    /// IN_PROGRESS | PAUSED → FINISHED: stop timer, enter review
    FINISH

    /// FINISHED → IN_PROGRESS: undo accidental end
    RESUME_FROM_FINISHED

    /// FINISHED → SUBMITTED: finalize laps, post to leaderboard
    SUBMIT

    /// READY | FINISHED → DISCARDED: void the run
    DISCARD
}

// ─────────────────────────────────────────────────────────────────────────────
// Structures — Run
// ─────────────────────────────────────────────────────────────────────────────
structure Run {
    @required
    runId: ResourceIdentifier

    @required
    leaderboardId: ResourceIdentifier

    @required
    eventId: ResourceIdentifier

    @required
    profileId: ResourceIdentifier

    @required
    runStatus: RunStatus

    /// True when a facilitator drives on behalf of a participant
    racedByProxy: Boolean

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @required
    @timestampFormat("date-time")
    updatedAt: Timestamp
}

list RunList {
    member: Run
}

// ─────────────────────────────────────────────────────────────────────────────
// Structures — Lap
// ─────────────────────────────────────────────────────────────────────────────
structure Lap {
    @required
    runId: ResourceIdentifier

    @required
    leaderboardId: ResourceIdentifier

    /// SSM managed instance ID of the car used for this lap
    deviceId: InstanceId

    @required
    lapNumber: PositiveInteger

    @required
    lapTimeMs: PositiveInteger

    @required
    isValid: Boolean

    resets: NonNegativeInteger

    /// How the lap time was captured. Absent on laps created before this field existed (MANUAL).
    timingSource: LapTimingSource

    /// Review state of the lap time. Absent on laps created before this field existed (NOT_REQUIRED).
    reviewStatus: LapReviewStatus

    /// Original time before manual edit (immutable after first edit)
    originalLapTimeMs: PositiveInteger

    /// Who edited this lap (profileId)
    editedBy: ResourceIdentifier

    /// When this lap was last edited
    @timestampFormat("date-time")
    editedAt: Timestamp

    /// Required reason for any manual edit
    @length(min: 1, max: 500)
    editReason: String

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    @required
    @timestampFormat("date-time")
    updatedAt: Timestamp
}

list LapList {
    member: Lap
}
