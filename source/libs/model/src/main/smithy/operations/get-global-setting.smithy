$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@http(method: "GET", uri: "/settings/{key}")
operation GetGlobalSetting {
    input := {
        @required
        @httpLabel
        key: String
    }

    output := {
        @required
        value: Document
    }

    errors: [
        NotFoundError
    ]
}
