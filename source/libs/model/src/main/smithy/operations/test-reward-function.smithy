$version: "2"

namespace com.aws.solutions.deepracer

@idempotent
@http(method: "POST", uri: "/rewardFunction")
operation TestRewardFunction {
    input := {
        @required
        rewardFunction: RewardFunctionCode

        @required
        trackConfig: TrackConfig
    }

    output := {
        @required
        errors: RewardFunctionErrorList
    }
}
