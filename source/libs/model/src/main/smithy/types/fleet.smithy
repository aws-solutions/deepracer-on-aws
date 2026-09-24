$version: "2"

namespace com.aws.solutions.deepracer

structure Fleet {
    @required
    fleetId: ResourceIdentifier

    @required
    name: ResourceName

    @required
    @timestampFormat("date-time")
    createdAt: Timestamp

    deviceCount: NonNegativeInteger
}

structure FleetDefinition {
    @required
    name: ResourceName
}

list FleetList {
    member: Fleet
}
