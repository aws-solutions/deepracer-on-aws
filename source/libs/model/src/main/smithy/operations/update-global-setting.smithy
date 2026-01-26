$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "PUT", uri: "/settings/{key}")
operation UpdateGlobalSetting {
    input := {
        @required
        @httpLabel
        key: String

        @required
        value: Document
    }

    errors: [
        NotFoundError
    ]
}
