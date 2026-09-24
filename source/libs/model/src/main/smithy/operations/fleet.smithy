$version: "2"

namespace com.aws.solutions.deepracer

@http(method: "POST", uri: "/fleets", code: 201)
operation CreateFleet {
    input := {
        @required
        fleetDefinition: FleetDefinition
    }

    output := {
        @required
        fleetId: ResourceIdentifier
    }
}

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "fleets")
@http(method: "GET", uri: "/fleets")
operation ListFleets {
    input := {
        @httpQuery("token")
        token: String
    }

    output := {
        @required
        fleets: FleetList

        token: String
    }
}

@idempotent
@http(method: "PATCH", uri: "/fleets/{fleetId}")
operation UpdateFleet {
    input := {
        @required
        @httpLabel
        fleetId: ResourceIdentifier

        name: ResourceName
    }

    output := {
        @required
        fleet: Fleet
    }

    errors: [
        NotFoundError
    ]
}

@idempotent
@http(method: "DELETE", uri: "/fleets/{fleetId}")
operation DeleteFleet {
    input := {
        @required
        @httpLabel
        fleetId: ResourceIdentifier
    }

    errors: [
        NotFoundError
        ConflictError
    ]
}

@http(method: "POST", uri: "/events/{eventId}/fleets")
operation AssignEventFleets {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @required
        fleetIds: ResourceIdentifierList
    }

    output := {
        @required
        assignedFleetIds: ResourceIdentifierList
    }

    errors: [
        BadRequestError
        NotFoundError
    ]
}

@readonly
@paginated(inputToken: "token", outputToken: "token", items: "devices")
@http(method: "GET", uri: "/events/{eventId}/devices")
operation ListEventDevices {
    input := {
        @required
        @httpLabel
        eventId: ResourceIdentifier

        @httpQuery("token")
        token: String
    }

    output := {
        @required
        devices: DeviceList

        token: String
    }

    errors: [
        NotFoundError
    ]
}
