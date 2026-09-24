$version: "2"

namespace com.aws.solutions.deepracer

/// Registers a walk-up racer: creates a Cognito user and assigns the racer
/// group. The group is fixed server-side and cannot be influenced by the
/// caller.
@http(method: "POST", uri: "/race-management/users", code: 201)
operation RegisterUser {
    input := {
        @required
        @length(min: 1, max: 254)
        emailAddress: SensitiveString

        /// Optional 2-letter country code (e.g. US, GB) shown on leaderboards.
        @length(min: 2, max: 2)
        @pattern("^[A-Za-z]{2}$")
        countryCode: String
    }

    output := {
        @required
        id: ResourceIdentifier
    }

    errors: [
        BadRequestError
        ConflictError
        InternalFailureError
    ]
}

@sensitive
string SensitiveString
