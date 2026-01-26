$version: "2"

namespace com.aws.solutions.deepracer

/// An error message
string ErrorMessage

/// An internal failure at the fault of the server
@error("server")
@httpError(500)
structure InternalFailureError {
    /// Message with details about the error
    @required
    message: ErrorMessage
}

/// An error at the fault of the client sending invalid input
@error("client")
@httpError(400)
structure BadRequestError {
    /// Message with details about the error
    @required
    message: ErrorMessage
}

/// An error due to the client attempting to access a missing resource
@error("client")
@httpError(404)
structure NotFoundError {
    /// Message with details about the error
    @required
    message: ErrorMessage
}

/// An error due to the client not being authorized to access the resource
@error("client")
@httpError(403)
structure NotAuthorizedError {
    /// Message with details about the error
    @required
    message: ErrorMessage
}
