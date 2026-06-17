$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/leaderboards/{leaderboardId}/liveQueue")
operation ListLiveQueueItems {
    input := {
        @required
        @httpLabel
        leaderboardId: ResourceIdentifier
    }

    output := {
        @required
        items: LiveQueueItemList
    }

    errors: [
        NotFoundError
    ]
}
