# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import unittest
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError
from moto import mock_aws

from model_optimizer import db

os.environ["DATABASE_NAME"] = "test-table"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
TEST_REGION = os.environ["AWS_DEFAULT_REGION"]

TEST_MODEL_ID = "m1"
TEST_PROFILE_ID = "p1"


def _create_table():
    db._dynamodb_resource = None
    client = boto3.client("dynamodb", region_name=TEST_REGION)
    client.create_table(
        TableName="test-table",
        KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
        AttributeDefinitions=[
            {"AttributeName": "pk", "AttributeType": "S"},
            {"AttributeName": "sk", "AttributeType": "S"},
        ],
        BillingMode="PAY_PER_REQUEST",
    )
    return client


def _put_model(client, **attributes):
    item = {"pk": {"S": f"profile_{TEST_PROFILE_ID}"}, "sk": {"S": f"model_{TEST_MODEL_ID}"}}
    for key, value in attributes.items():
        item[key] = {"S": value}
    client.put_item(TableName="test-table", Item=item)


class TestModelKey(unittest.TestCase):
    def test_key_uses_lowercase_prefixes(self):
        key = db._model_key(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(key, {"pk": "profile_p1", "sk": "model_m1"})


class TestGetModelItem(unittest.TestCase):
    @mock_aws
    def test_raises_when_model_not_found(self):
        _create_table()
        with self.assertRaises(ValueError):
            db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)

    @mock_aws
    def test_returns_item_when_found(self):
        client = _create_table()
        _put_model(client, optimizationStatus="OPTIMIZED")

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)

        self.assertEqual(item["optimizationStatus"], "OPTIMIZED")


class TestSetOptimizationInProgress(unittest.TestCase):
    @mock_aws
    def test_succeeds_when_status_absent(self):
        client = _create_table()
        _put_model(client)  # Item exists but has no optimizationStatus attribute
        db.set_optimization_in_progress(TEST_MODEL_ID, TEST_PROFILE_ID)
        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "IN_PROGRESS")

    @mock_aws
    def test_succeeds_when_status_is_failed(self):
        client = _create_table()
        _put_model(client, optimizationStatus="FAILED")
        db.set_optimization_in_progress(TEST_MODEL_ID, TEST_PROFILE_ID)
        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "IN_PROGRESS")

    @mock_aws
    def test_raises_when_status_is_optimized(self):
        client = _create_table()
        _put_model(client, optimizationStatus="OPTIMIZED")
        with self.assertRaises(ClientError):
            db.set_optimization_in_progress(TEST_MODEL_ID, TEST_PROFILE_ID)
        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "OPTIMIZED")


class TestSetOptimizationOptimized(unittest.TestCase):
    @mock_aws
    def test_transitions_from_in_progress(self):
        client = _create_table()
        _put_model(client, optimizationStatus="IN_PROGRESS")

        db.set_optimization_optimized(TEST_MODEL_ID, TEST_PROFILE_ID, "p1/models/m1/optimized/")

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "OPTIMIZED")
        self.assertEqual(item["optimizedArtifactsS3Prefix"], "p1/models/m1/optimized/")

    @mock_aws
    def test_skips_silently_when_not_in_progress(self):
        client = _create_table()
        _put_model(client, optimizationStatus="FAILED")

        db.set_optimization_optimized(TEST_MODEL_ID, TEST_PROFILE_ID, "p1/models/m1/optimized/")

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "FAILED")
        self.assertNotIn("optimizedArtifactsS3Prefix", item)


class TestSetOptimizationFailed(unittest.TestCase):
    @mock_aws
    def test_transitions_from_in_progress(self):
        client = _create_table()
        _put_model(client, optimizationStatus="IN_PROGRESS")

        db.set_optimization_failed(TEST_MODEL_ID, TEST_PROFILE_ID)

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "FAILED")

    @mock_aws
    def test_does_not_touch_status_field(self):
        client = _create_table()
        _put_model(client, optimizationStatus="IN_PROGRESS", status="READY")

        db.set_optimization_failed(TEST_MODEL_ID, TEST_PROFILE_ID)

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["status"], "READY")

    @mock_aws
    def test_skips_silently_when_already_optimized(self):
        client = _create_table()
        _put_model(client, optimizationStatus="OPTIMIZED")

        db.set_optimization_failed(TEST_MODEL_ID, TEST_PROFILE_ID)

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["optimizationStatus"], "OPTIMIZED")


class TestSetPhysicalImportReady(unittest.TestCase):
    @mock_aws
    def test_transitions_from_importing(self):
        client = _create_table()
        _put_model(client, status="IMPORTING")

        db.set_physical_import_ready(
            TEST_MODEL_ID,
            TEST_PROFILE_ID,
            "p1/models/m1/optimized/",
            "PPO",
            {"camera": "FRONT_FACING_CAMERA"},
            [{"speed": 0.5, "steering_angle": -30}],
        )

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["status"], "READY")
        self.assertEqual(item["optimizationStatus"], "OPTIMIZED")
        self.assertEqual(item["optimizedArtifactsS3Prefix"], "p1/models/m1/optimized/")
        self.assertEqual(item["metadata"]["agentAlgorithm"], "PPO")
        self.assertEqual(item["metadata"]["sensors"], {"camera": "FRONT_FACING_CAMERA"})
        self.assertEqual(
            item["metadata"]["actionSpace"]["discrete"], [{"speed": Decimal("0.5"), "steeringAngle": Decimal("-30")}]
        )

    @mock_aws
    def test_skips_silently_when_not_importing(self):
        client = _create_table()
        _put_model(client, status="ERROR")

        db.set_physical_import_ready(
            TEST_MODEL_ID,
            TEST_PROFILE_ID,
            "p1/models/m1/optimized/",
            "PPO",
            {"camera": "FRONT_FACING_CAMERA"},
            [{"speed": 0.5, "steering_angle": -30}],
        )

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["status"], "ERROR")
        self.assertNotIn("optimizationStatus", item)


class TestSetPhysicalImportError(unittest.TestCase):
    @mock_aws
    def test_transitions_from_importing(self):
        client = _create_table()
        _put_model(client, status="IMPORTING")

        db.set_physical_import_error(TEST_MODEL_ID, TEST_PROFILE_ID, "Malware detected in uploaded file")

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["status"], "ERROR")
        self.assertEqual(item["importErrorMessage"], "Malware detected in uploaded file")

    @mock_aws
    def test_skips_silently_when_already_ready(self):
        client = _create_table()
        _put_model(client, status="READY")

        db.set_physical_import_error(TEST_MODEL_ID, TEST_PROFILE_ID, "some late error")

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["status"], "READY")
        self.assertNotIn("importErrorMessage", item)


class TestTableEnvVar(unittest.TestCase):
    def test_raises_when_database_name_not_set(self):
        db._dynamodb_resource = None
        original = os.environ.pop("DATABASE_NAME", None)
        try:
            with self.assertRaises(RuntimeError):
                db._table()
        finally:
            if original:
                os.environ["DATABASE_NAME"] = original
            db._dynamodb_resource = None


class TestNonConditionalErrors(unittest.TestCase):
    @mock_aws
    def test_set_optimization_optimized_reraises_non_conditional_error(self):
        db._dynamodb_resource = None
        # Don't create the table — any DDB call will fail with ResourceNotFoundException
        with self.assertRaises(ClientError) as ctx:
            db.set_optimization_optimized("m1", "p1", "prefix/")
        self.assertNotEqual(ctx.exception.response["Error"]["Code"], "ConditionalCheckFailedException")

    @mock_aws
    def test_set_optimization_failed_reraises_non_conditional_error(self):
        db._dynamodb_resource = None
        with self.assertRaises(ClientError) as ctx:
            db.set_optimization_failed("m1", "p1")
        self.assertNotEqual(ctx.exception.response["Error"]["Code"], "ConditionalCheckFailedException")

    @mock_aws
    def test_set_physical_import_ready_reraises_non_conditional_error(self):
        db._dynamodb_resource = None
        with self.assertRaises(ClientError) as ctx:
            db.set_physical_import_ready("m1", "p1", "prefix/", "PPO", {}, [])
        self.assertNotEqual(ctx.exception.response["Error"]["Code"], "ConditionalCheckFailedException")

    @mock_aws
    def test_set_physical_import_error_reraises_non_conditional_error(self):
        db._dynamodb_resource = None
        with self.assertRaises(ClientError) as ctx:
            db.set_physical_import_error("m1", "p1", "something went wrong")
        self.assertNotEqual(ctx.exception.response["Error"]["Code"], "ConditionalCheckFailedException")

    @mock_aws
    def test_update_optimization_status_reraises_non_conditional_error(self):
        db._dynamodb_resource = None
        with self.assertRaises(ClientError) as ctx:
            db.set_optimization_in_progress("m1", "p1")
        self.assertNotEqual(ctx.exception.response["Error"]["Code"], "ConditionalCheckFailedException")

    @mock_aws
    def test_update_optimization_status_raises_on_empty_allowed_statuses(self):
        db._dynamodb_resource = None
        _create_table()
        with self.assertRaises(ValueError):
            db._update_optimization_status("m1", "p1", new_status="IN_PROGRESS", allowed_current_statuses=[])


class TestMd5Persistence(unittest.TestCase):
    @mock_aws
    def test_set_optimization_optimized_persists_md5_hashes(self):
        client = _create_table()
        _put_model(client, optimizationStatus="IN_PROGRESS")
        # Virtual models always have metadata from training; add it so nested path works
        client.update_item(
            TableName="test-table",
            Key={"pk": {"S": f"profile_{TEST_PROFILE_ID}"}, "sk": {"S": f"model_{TEST_MODEL_ID}"}},
            UpdateExpression="SET metadata = :m",
            ExpressionAttributeValues={":m": {"M": {"agentAlgorithm": {"S": "PPO"}}}},
        )

        db.set_optimization_optimized(
            TEST_MODEL_ID,
            TEST_PROFILE_ID,
            "p1/models/m1/optimized/",
            model_md5="abc123",
            metadata_md5="def456",
        )

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["metadata"]["modelMD5"], "abc123")
        self.assertEqual(item["metadata"]["metadataMD5"], "def456")

    @mock_aws
    def test_set_optimization_optimized_omits_md5_when_none(self):
        client = _create_table()
        _put_model(client, optimizationStatus="IN_PROGRESS")

        db.set_optimization_optimized(
            TEST_MODEL_ID,
            TEST_PROFILE_ID,
            "p1/models/m1/optimized/",
            model_md5=None,
            metadata_md5=None,
        )

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertNotIn("modelMD5", item.get("metadata", {}))
        self.assertNotIn("metadataMD5", item.get("metadata", {}))

    @mock_aws
    def test_set_physical_import_ready_persists_md5_hashes(self):
        client = _create_table()
        _put_model(client, status="IMPORTING")

        db.set_physical_import_ready(
            TEST_MODEL_ID,
            TEST_PROFILE_ID,
            "p1/models/m1/optimized/",
            "PPO",
            {"camera": "FRONT_FACING_CAMERA"},
            [],
            model_md5="aaa111",
            metadata_md5="bbb222",
        )

        item = db.get_model_item(TEST_MODEL_ID, TEST_PROFILE_ID)
        self.assertEqual(item["metadata"]["modelMD5"], "aaa111")
        self.assertEqual(item["metadata"]["metadataMD5"], "bbb222")


if __name__ == "__main__":
    unittest.main()
