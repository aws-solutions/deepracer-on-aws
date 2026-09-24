$version: "2"

namespace com.aws.solutions.deepracer

/// Lists the tracks (Leaderboards) configured for an event, via the sparse byEventId GSI.
/// Used by the Event Detail "Tracks" tab to render the current track configuration.
@readonly
@paginated(inputToken: "nextToken", outputToken: "nextToken", pageSize: "maxResults", items: "tracks")
@http(method: "GET", uri: "/events/{eventId}/tracks")
operation ListEventTracks {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @httpQuery("nextToken")
        nextToken: String

        @httpQuery("maxResults")
        maxResults: Integer
    }

    output := {
        @required
        tracks: LeaderboardList

        nextToken: String
    }

    errors: [
        NotFoundError
    ]
}
