$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/events/{eventId}/tracks")
operation AddTrackToEvent {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        trackType: TrackId

        @required
        leaderBoardTitle: ResourceName

        leaderBoardFooter: Description

        fleetId: ResourceIdentifier
    }

    output := {
        @required
        leaderboardId: ResourceIdentifier
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}
