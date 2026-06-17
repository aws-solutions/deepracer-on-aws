$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/live-race/connect")
operation AttachLiveRacePolicy {
    input := {}
    output := {}
    errors: [
        BadRequestError
        InternalFailureError
    ]
}
