$version: "2"

namespace com.aws.solutions.deepracer

structure GlobalSettings {
    @required
    usageQuotas: UsageQuotas
}

structure GlobalUsageQuotas {
    // Maximum total compute minutes for the entire instance (null means unlimited)
    globalComputeMinutesLimit: Integer

    // Maximum model count for the entire instance (null means unlimited)
    globalModelCountLimit: Integer
}

structure NewUserUsageQuotas {
    // Default maximum compute minutes per user
    @required
    newUserComputeMinutesLimit: Integer

    // Default maximum model count per user
    @required
    newUserModelCountLimit: Integer
}

structure UsageQuotas {
    @required
    global: GlobalUsageQuotas

    @required
    newUser: NewUserUsageQuotas
}
