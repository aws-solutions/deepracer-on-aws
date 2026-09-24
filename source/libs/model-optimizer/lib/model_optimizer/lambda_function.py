# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

from typing import TYPE_CHECKING

from aws_lambda_powertools import Logger

if TYPE_CHECKING:
    from aws_lambda_powertools.utilities.typing import LambdaContext
else:
    LambdaContext = object

logger = Logger(service="model_optimizer", use_rfc3339=True)


@logger.inject_lambda_context
def lambda_handler(event: dict, context: LambdaContext) -> dict:
    """
    Entry point for the Model Optimizer Lambda.

    Invoked asynchronously (InvocationType: Event) by PackageModel for virtual
    models, or synchronously (InvocationType: RequestResponse) by
    importModelDispatcher for physical models.

    Expected event shape: {"modelId": str, "profileId": str}
    """
    from .optimizer import run_optimization

    model_id = event.get("modelId")
    profile_id = event.get("profileId")

    if not model_id or not profile_id:
        raise ValueError("Event must include both modelId and profileId")

    logger.info("Received optimization request", modelId=model_id, profileId=profile_id)

    return run_optimization(model_id, profile_id, request_id=context.aws_request_id, event=event)
