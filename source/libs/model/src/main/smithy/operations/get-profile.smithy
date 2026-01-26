$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/profile")
operation GetProfile {
    output := {
        @required
        profile: Profile
    }
}
