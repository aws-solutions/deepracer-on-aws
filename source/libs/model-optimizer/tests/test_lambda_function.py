# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import unittest
from unittest.mock import patch

from model_optimizer import lambda_function


class FakeContext:
    aws_request_id = "test-request-id"
    function_name = "test-model-optimizer"
    memory_limit_in_mb = 10240
    invoked_function_arn = "arn:aws:lambda:us-east-1:123456789012:function:test-model-optimizer"


class TestLambdaHandler(unittest.TestCase):
    def test_missing_model_id_raises(self):
        with self.assertRaises(ValueError):
            lambda_function.lambda_handler({"profileId": "p1"}, FakeContext())

    def test_missing_profile_id_raises(self):
        with self.assertRaises(ValueError):
            lambda_function.lambda_handler({"modelId": "m1"}, FakeContext())

    def test_missing_both_raises(self):
        with self.assertRaises(ValueError):
            lambda_function.lambda_handler({}, FakeContext())

    @patch("model_optimizer.optimizer.run_optimization")
    def test_valid_event_calls_run_optimization(self, mock_run_optimization):
        mock_run_optimization.return_value = {"modelId": "m1", "profileId": "p1"}
        event = {"modelId": "m1", "profileId": "p1"}

        result = lambda_function.lambda_handler(event, FakeContext())

        mock_run_optimization.assert_called_once_with("m1", "p1", request_id="test-request-id", event=event)
        self.assertEqual(result, {"modelId": "m1", "profileId": "p1"})


if __name__ == "__main__":
    unittest.main()
