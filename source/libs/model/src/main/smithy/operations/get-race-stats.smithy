$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/race-management/stats")
operation GetRaceStats {
    input := {}

    output := {
        @required
        totalEvents: NonNegativeInteger

        @required
        totalRacers: NonNegativeInteger

        @required
        totalRaces: NonNegativeInteger

        @required
        totalLaps: NonNegativeInteger

        @required
        totalValidLaps: NonNegativeInteger

        /// Derived: sumValidLapTimeMs / totalValidLaps. Zero when no valid laps.
        @required
        averageLapTimeMilliseconds: NonNegativeInteger

        @required
        fastestLapsEver: FastestLapList

        @required
        totalCountries: NonNegativeInteger

        @required
        eventsByCountry: EventsByCountryList

        @required
        eventsByMonth: EventsByMonthList

        @required
        eventTypeBreakdown: EventTypeBreakdownList
    }

    errors: [
        BadRequestError
        InternalFailureError
    ]
}

@length(max: 10)
list FastestLapList {
    member: FastestLapEntry
}

structure FastestLapEntry {
    @required
    participantName: String

    @required
    lapTimeMilliseconds: NonNegativeInteger

    @required
    eventId: ResourceIdentifier

    /// Human-readable event name for display. May be absent for records computed before this field existed.
    eventName: String
}

@length(max: 249)
list EventsByCountryList {
    member: EventsByCountryEntry
}

structure EventsByCountryEntry {
    @required
    countryCode: String

    @required
    events: NonNegativeInteger

    @required
    races: NonNegativeInteger

    @required
    laps: NonNegativeInteger
}

@length(max: 120)
list EventsByMonthList {
    member: EventsByMonthEntry
}

structure EventsByMonthEntry {
    /// ISO month in YYYY-MM format
    @required
    month: String

    @required
    events: NonNegativeInteger

    @required
    races: NonNegativeInteger

    @required
    laps: NonNegativeInteger
}

@length(max: 20)
list EventTypeBreakdownList {
    member: EventTypeBreakdownEntry
}

structure EventTypeBreakdownEntry {
    @required
    typeOfEvent: String

    @required
    count: NonNegativeInteger
}
