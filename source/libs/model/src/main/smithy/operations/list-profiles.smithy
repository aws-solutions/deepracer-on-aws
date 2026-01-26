$version: "2"

namespace com.aws.solutions.deepracer

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "profiles")
@http(method: "GET", uri: "/profiles")
operation ListProfiles {
    input := {
        @httpQuery("token")
        token: String
    }

    output := {
        @required
        profiles: ProfileList

        token: String
    }
}

list ProfileList {
    member: Profile
}
