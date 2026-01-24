$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/profile")
operation CreateProfile {
    input := {
        @required
        emailAddress: String
    }

    output := {
        @required
        message: String
    }
}
