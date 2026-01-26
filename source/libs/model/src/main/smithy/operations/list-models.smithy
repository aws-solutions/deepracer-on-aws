$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "models")
@http(method: "GET", uri: "/models")
operation ListModels {
    input := {
        @httpQuery("token")
        token: String
    }

    output := {
        @required
        models: ModelList

        token: String
    }
}
