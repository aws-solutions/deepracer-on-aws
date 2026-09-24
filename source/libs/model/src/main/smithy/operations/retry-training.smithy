$version: "2"

namespace com.aws.solutions.deepracer

@documentation(
    """
    Retries dispatching the training job for a model that is WAITING_FOR_CAPACITY. Both SageMaker
    training quotas are rechecked. When capacity is available the model and training job transition
    to QUEUED and exactly one workflow message is sent. When capacity is still unavailable, or cannot
    be verified, the records stay WAITING_FOR_CAPACITY and no message is sent."""
)
@idempotent
@http(method: "POST", uri: "/models/{modelId}/retry-training")
operation RetryTraining {
    input := {
        @required
        @httpLabel
        modelId: ResourceIdentifier
    }

    output := {
        @required
        modelId: ResourceIdentifier

        @required
        status: ModelStatus

        message: String
    }

    errors: [
        BadRequestError
        ConflictError
        NotFoundError
    ]
}
