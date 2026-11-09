$version: "2"

namespace com.aws.solutions.deepracer

@pattern("^mi-[0-9a-f]{17}$")
string InstanceId

list InstanceIdList {
    member: InstanceId
}

/// Bounded input list for BatchUpdateDevice. Constrained per the Unbounded Operations /
/// Batch Operations API standards. The output list stays unbounded (it may be empty).
@length(min: 1, max: 100)
list BatchUpdateDeviceInstanceIds {
    member: InstanceId
}

/// Per-item failures for BatchUpdateDevice. Per the Batch Operations standard, each error
/// ties to its request item and carries a code and a descriptive message.
list BatchUpdateDeviceErrors {
    member: BatchUpdateDeviceError
}

structure BatchUpdateDeviceError {
    @required
    instanceId: InstanceId

    @required
    code: String

    @required
    message: String
}

@sensitive
string ActivationCode

enum DeviceType {
    CAR
    TIMER
}

enum CarType {
    DEEPRACER
    DEEPRACER_CUSTOM
    DEEPRACER_RPI
}

enum DeviceStatus {
    ONLINE
    OFFLINE
    PENDING
}

enum DeviceColor {
    RED
    GREEN
    BLUE
    YELLOW
    CYAN
    MAGENTA
    WHITE
}

@range(min: 0, max: 40)
integer GpioPin

list GpioPinList {
    member: GpioPin
}

structure DeviceMetadata {
    ssid: String
    gpioPins: GpioPinList
}

structure Device {
    @required
    instanceId: InstanceId

    @required
    name: ResourceName

    @required
    deviceType: DeviceType

    carType: CarType

    fleetId: ResourceIdentifier

    @required
    status: DeviceStatus

    @required
    @timestampFormat("date-time")
    activatedAt: Timestamp

    @timestampFormat("date-time")
    lastSeenAt: Timestamp

    /// Last-known private IPv4 address reported by the SSM agent (from
    /// DescribeInstanceInformation). Optional — absent until the device registers.
    ipAddress: String

    /// Whether the car runs a software version that can record rosbag logs (derived from the
    /// installed `aws-deepracer-core` version). Absent until the device has been synced.
    loggingCapable: Boolean

    metadata: DeviceMetadata
}

list DeviceList {
    member: Device
}
