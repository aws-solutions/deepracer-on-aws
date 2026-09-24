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

/// Reassign (or clear) a device's fleet. This op's only mutable field is `fleetId`:
/// provide it to move the device to that fleet; omit it to unassign the device.
@idempotent
@http(method: "PATCH", uri: "/devices/{instanceId}")
operation UpdateDevice {
    input := {
        @required
        @httpLabel
        instanceId: InstanceId

        fleetId: ResourceIdentifier
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
