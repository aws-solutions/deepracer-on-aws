$version: "2"

namespace com.aws.solutions.deepracer

/// Lists devices, filterable by `deviceType`, `status`, and `fleetId`. The `status` filter
/// (and `deviceType` on the fleet path) is applied server-side per page, so a page may come
/// back with an empty `devices` list while `token` is still present. Callers MUST keep
/// paginating until `token` is absent — an empty page does not mean there are no more matches.
@readonly
@paginated(inputToken: "token", outputToken: "token", items: "devices")
@http(method: "GET", uri: "/devices")
operation ListDevices {
    input := {
        @httpQuery("deviceType")
        deviceType: DeviceType

        @httpQuery("status")
        status: DeviceStatus

        @httpQuery("fleetId")
        fleetId: ResourceIdentifier

        @httpQuery("token")
        token: String
    }

    output := {
        @required
        devices: DeviceList

        token: String
    }
}

@http(method: "POST", uri: "/devices/activate", code: 201)
operation ActivateDevice {
    input := {
        @required
        name: ResourceName

        @required
        deviceType: DeviceType

        fleetId: ResourceIdentifier
    }

    output := {
        @required
        activationId: String

        @required
        activationCode: ActivationCode

        @required
        region: String

        @required
        @timestampFormat("date-time")
        expiresAt: Timestamp
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}

@idempotent
@http(method: "DELETE", uri: "/devices/{instanceId}")
operation DeleteDevice {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}

@http(method: "POST", uri: "/devices/{instanceId}/restart", code: 202)
operation RestartDevice {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId
    }

    output := {
        @required
        commandId: String
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}

@http(method: "POST", uri: "/devices/{instanceId}/stop", code: 202)
operation StopDevice {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId
    }

    output := {
        @required
        commandId: String
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}

@idempotent
@http(method: "PATCH", uri: "/devices/{instanceId}/color")
operation ChangeDeviceColor {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId

        @required
        color: DeviceColor
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}

@http(method: "POST", uri: "/devices/{instanceId}/clear-models")
operation ClearDeviceModels {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId
    }

    output := {
        @required
        commandId: String
    }

    errors: [
        BadRequestError
        NotAuthorizedError
        NotFoundError
    ]
}

/// Update a device's mutable attributes (Administrators and race facilitators). PATCH
/// semantics: apply whichever of the optional fields is present, leaving the rest unchanged.
///
/// `fleetId` — reassign (or clear) the device's fleet. Provide it to move the device to that
/// fleet; omit it to unassign the device. The SSM managed-instance tag is the source of truth
/// for fleet membership, so the tag is written first and the DynamoDB row is updated to match.
///
/// `carType` — manually set the device's car type (CAR devices only). This is a **DynamoDB-only
/// fallback**: the device-management backend always prefers the `CarType` SSM tag the device
/// self-reports at activation, and only falls back to this stored value when that tag is absent.
/// Because the tag wins on the next status-poll reconciliation, setting `carType` on a device
/// that is actively reporting its own `CarType` tag will be overwritten by the reported value.
@idempotent
@http(method: "PATCH", uri: "/devices/{instanceId}")
operation UpdateDevice {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId

        fleetId: ResourceIdentifier

        /// Manual car-type override, persisted to DynamoDB as a fallback for when the device
        /// does not self-report a `CarType` SSM tag. Valid for CAR devices only.
        carType: CarType
    }

    output := {
        @required
        device: Device
    }

    errors: [
        BadRequestError
        InternalFailureError
        NotAuthorizedError
        NotFoundError
    ]
}

/// Batch analogue of UpdateDevice: move (or unassign) up to 100 devices' fleet in a single
/// call, matching DREM `carsUpdateFleet` (avoids per-device round trips). The target fleet is
/// validated once; each device is applied with continue-on-failure. `fleetId` present assigns
/// all devices to that fleet; omitted unassigns them. Per-item failures are returned in
/// `errors`, each traceable to its request instanceId.
@http(method: "POST", uri: "/devices/batch-update")
operation BatchUpdateDevice {
    input := {
        @required
        instanceIds: BatchUpdateDeviceInstanceIds

        fleetId: ResourceIdentifier
    }

    output := {
        @required
        assignedInstanceIds: InstanceIdList

        @required
        errors: BatchUpdateDeviceErrors
    }

    errors: [
        BadRequestError
        InternalFailureError
        NotAuthorizedError
    ]
}
