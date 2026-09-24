# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import tempfile
import unittest
from unittest.mock import patch

os.environ["MODEL_DATA_BUCKET_NAME"] = "test-model-bucket"
os.environ["UPLOAD_BUCKET_NAME"] = "test-upload-bucket"

from model_optimizer import optimizer

WORK_DIR = os.path.join(tempfile.gettempdir(), "test-work")
MOCK_MODEL_PB = os.path.join(tempfile.gettempdir(), "model.pb")
MOCK_METADATA = os.path.join(tempfile.gettempdir(), "model_metadata.json")


class TestNormalizeDdbMetadata(unittest.TestCase):
    def test_normalizes_camel_case_shape(self):
        metadata = {"agentAlgorithm": "PPO", "sensors": {"camera": "FRONT_FACING_CAMERA"}}
        agent_algorithm, sensors = optimizer._normalize_ddb_metadata(metadata)
        self.assertEqual(agent_algorithm, "PPO")
        self.assertEqual(sensors, {"camera": "FRONT_FACING_CAMERA"})

    def test_defaults_sensors_to_empty_dict(self):
        _, sensors = optimizer._normalize_ddb_metadata({"agentAlgorithm": "SAC"})
        self.assertEqual(sensors, {})


class TestNormalizeOnDiskMetadata(unittest.TestCase):
    def test_normalizes_clipped_ppo_with_camera(self):
        metadata = {"training_algorithm": "clipped_ppo", "sensor": ["FRONT_FACING_CAMERA"]}
        agent_algorithm, sensors = optimizer._normalize_on_disk_metadata(metadata)
        self.assertEqual(agent_algorithm, "PPO")
        self.assertEqual(sensors, {"camera": "FRONT_FACING_CAMERA"})

    def test_normalizes_sac_with_camera_and_lidar(self):
        metadata = {"training_algorithm": "sac", "sensor": ["STEREO_CAMERAS", "SECTOR_LIDAR"]}
        agent_algorithm, sensors = optimizer._normalize_on_disk_metadata(metadata)
        self.assertEqual(agent_algorithm, "SAC")
        self.assertEqual(sensors, {"camera": "STEREO_CAMERAS", "lidar": "SECTOR_LIDAR"})

    def test_raises_on_unrecognized_training_algorithm(self):
        metadata = {"training_algorithm": "unknown_algo", "sensor": ["FRONT_FACING_CAMERA"]}
        with self.assertRaises(ValueError):
            optimizer._normalize_on_disk_metadata(metadata)

    def test_raises_on_unrecognized_sensor_value(self):
        metadata = {"training_algorithm": "clipped_ppo", "sensor": ["UNKNOWN_SENSOR"]}
        with self.assertRaises(ValueError):
            optimizer._normalize_on_disk_metadata(metadata)


class TestPhysicalUploadKey(unittest.TestCase):
    def test_parses_s3_location(self):
        key = optimizer._physical_upload_key({"s3Location": "s3://bucket/uploads/physical-models/p1/m1.tar.gz"})
        self.assertEqual(key, "uploads/physical-models/p1/m1.tar.gz")

    def test_raises_when_s3_location_missing(self):
        with self.assertRaises(RuntimeError):
            optimizer._physical_upload_key({})


class TestResolveVirtualModelPb(unittest.TestCase):
    def setUp(self):
        self.work_dir = WORK_DIR

    @patch("model_optimizer.optimizer.s3_utils")
    def test_path_1_trained_in_platform_model(self, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.side_effect = [
            ("model-bucket", "p1/models/m1/model_metadata.json"),
            ("model-bucket", "p1/models/m1/sagemaker-artifacts/model/output.tar.gz"),
        ]

        def fake_extract(archive_path, dest_dir):
            os.makedirs(os.path.join(dest_dir, "agent"), exist_ok=True)
            with open(os.path.join(dest_dir, "agent", "model.pb"), "wb") as f:
                f.write(b"data")

        mock_s3_utils.extract_tar_gz.side_effect = fake_extract

        model_item = {
            "assetS3Locations": {
                "modelMetadataS3Location": "s3://model-bucket/p1/models/m1/model_metadata.json",
                "modelArtifactS3Location": "s3://model-bucket/p1/models/m1/sagemaker-artifacts/model/output.tar.gz",
            }
        }

        model_pb_path, _ = optimizer._resolve_virtual_model_pb(model_item, self.work_dir)

        self.assertTrue(model_pb_path.endswith("agent/model.pb"))
        self.assertEqual(mock_s3_utils.download_file.call_count, 2)
        shutil_cleanup(self.work_dir)

    @patch("model_optimizer.optimizer.s3_utils")
    def test_path_1_raises_when_model_pb_missing_after_extraction(self, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.side_effect = [
            ("model-bucket", "p1/models/m1/model_metadata.json"),
            ("model-bucket", "p1/models/m1/sagemaker-artifacts/model/output.tar.gz"),
        ]
        mock_s3_utils.extract_tar_gz.side_effect = lambda archive_path, dest_dir: os.makedirs(dest_dir, exist_ok=True)

        model_item = {
            "assetS3Locations": {
                "modelMetadataS3Location": "s3://model-bucket/p1/models/m1/model_metadata.json",
                "modelArtifactS3Location": "s3://model-bucket/p1/models/m1/sagemaker-artifacts/model/output.tar.gz",
            }
        }

        with self.assertRaises(ValueError):
            optimizer._resolve_virtual_model_pb(model_item, self.work_dir)
        shutil_cleanup(self.work_dir)

    @patch("model_optimizer.optimizer.s3_utils")
    def test_path_2_imported_virtual_model(self, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.side_effect = [
            ("model-bucket", "p1/models/m1/model_metadata.json"),
            ("model-bucket", "p1/models/m1/sagemaker-artifacts/"),
        ]
        mock_s3_utils.read_json_object.return_value = {"best_checkpoint": {"name": "4_Step-1752.ckpt"}}
        mock_s3_utils.parse_best_checkpoint_number.return_value = 4

        model_item = {
            "assetS3Locations": {
                "modelMetadataS3Location": "s3://model-bucket/p1/models/m1/model_metadata.json",
                "sageMakerArtifactsS3Location": "s3://model-bucket/p1/models/m1/sagemaker-artifacts/",
            }
        }

        model_pb_path, _ = optimizer._resolve_virtual_model_pb(model_item, self.work_dir)

        mock_s3_utils.download_file.assert_any_call(
            "model-bucket", "p1/models/m1/sagemaker-artifacts/model/model_4.pb", model_pb_path
        )
        shutil_cleanup(self.work_dir)

    def test_raises_when_model_metadata_location_missing(self):
        with self.assertRaises(ValueError):
            optimizer._resolve_virtual_model_pb({"assetS3Locations": {}}, self.work_dir)

    @patch("model_optimizer.optimizer.s3_utils")
    def test_raises_when_sagemaker_artifacts_location_missing(self, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.return_value = ("model-bucket", "p1/models/m1/model_metadata.json")
        model_item = {
            "assetS3Locations": {"modelMetadataS3Location": "s3://model-bucket/p1/models/m1/model_metadata.json"}
        }
        with self.assertRaises(ValueError):
            optimizer._resolve_virtual_model_pb(model_item, self.work_dir)
        shutil_cleanup(self.work_dir)


class TestRunOptimization(unittest.TestCase):
    @patch("model_optimizer.optimizer.shutil.rmtree")
    @patch("model_optimizer.optimizer._run_virtual_optimization")
    @patch("model_optimizer.optimizer.db")
    def test_dispatches_to_virtual_path_when_not_physical(self, mock_db, mock_run_virtual, mock_rmtree):
        mock_db.get_model_item.return_value = {"modelSource": "TRAINED"}
        mock_run_virtual.return_value = {"optimizationStatus": "OPTIMIZED"}

        result = optimizer.run_optimization("m1", "p1", "req-1")

        mock_run_virtual.assert_called_once()
        self.assertEqual(result, {"optimizationStatus": "OPTIMIZED"})

    @patch("model_optimizer.optimizer.shutil.rmtree")
    @patch("model_optimizer.optimizer._run_physical_import")
    @patch("model_optimizer.optimizer.db")
    def test_dispatches_to_physical_path_when_imported_physical(self, mock_db, mock_run_physical, mock_rmtree):
        mock_db.get_model_item.return_value = {"modelSource": "IMPORTED_PHYSICAL"}
        mock_run_physical.return_value = {"status": "READY"}

        result = optimizer.run_optimization("m1", "p1", "req-1", event={"s3Location": "s3://b/k"})

        mock_run_physical.assert_called_once()
        self.assertEqual(result, {"status": "READY"})

    @patch("model_optimizer.optimizer.shutil.rmtree")
    @patch("model_optimizer.optimizer._run_virtual_optimization")
    @patch("model_optimizer.optimizer.db")
    def test_cleans_up_work_dir_even_on_exception(self, mock_db, mock_run_virtual, mock_rmtree):
        mock_db.get_model_item.side_effect = ValueError("model not found")

        with self.assertRaises(ValueError):
            optimizer.run_optimization("m1", "p1", "req-1")

        mock_rmtree.assert_called_once()


class TestRunVirtualOptimization(unittest.TestCase):
    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer._resolve_virtual_model_pb")
    @patch("model_optimizer.optimizer.db")
    def test_sets_optimized_on_success(self, mock_db, mock_resolve, mock_convert):
        mock_resolve.return_value = (MOCK_MODEL_PB, MOCK_METADATA)
        mock_convert.return_value = "p1/models/m1/optimized/"
        model_item = {"metadata": {"agentAlgorithm": "PPO", "sensors": {"camera": "FRONT_FACING_CAMERA"}}}

        result = optimizer._run_virtual_optimization("m1", "p1", model_item, WORK_DIR)

        mock_db.set_optimization_in_progress.assert_called_once_with("m1", "p1")
        mock_db.set_optimization_optimized.assert_called_once_with(
            "m1", "p1", "p1/models/m1/optimized/", model_md5=None, metadata_md5=None, has_metadata=True
        )
        mock_db.set_optimization_failed.assert_not_called()
        self.assertEqual(result["optimizationStatus"], "OPTIMIZED")

    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer._resolve_virtual_model_pb")
    @patch("model_optimizer.optimizer.db")
    def test_sets_failed_on_resolve_error_without_touching_status(self, mock_db, mock_resolve, mock_convert):
        mock_resolve.side_effect = ValueError("model.pb not found")
        model_item = {"metadata": {}}

        result = optimizer._run_virtual_optimization("m1", "p1", model_item, WORK_DIR)

        mock_db.set_optimization_in_progress.assert_called_once_with("m1", "p1")
        mock_db.set_optimization_failed.assert_called_once_with("m1", "p1", error_message="model.pb not found")
        mock_db.set_optimization_optimized.assert_not_called()
        self.assertEqual(result["optimizationStatus"], "FAILED")

    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer._resolve_virtual_model_pb")
    @patch("model_optimizer.optimizer.db")
    def test_sets_failed_on_conversion_error(self, mock_db, mock_resolve, mock_convert):
        mock_resolve.return_value = (MOCK_MODEL_PB, MOCK_METADATA)
        mock_convert.side_effect = optimizer.ConversionError("OpenVINO conversion failed")
        model_item = {"metadata": {}}

        result = optimizer._run_virtual_optimization("m1", "p1", model_item, WORK_DIR)

        mock_db.set_optimization_failed.assert_called_once_with("m1", "p1", error_message="OpenVINO conversion failed")
        self.assertEqual(result["optimizationStatus"], "FAILED")


class TestRunPhysicalImport(unittest.TestCase):
    def setUp(self):
        self.event = {"s3Location": "s3://upload-bucket/uploads/physical-models/p1/m1.tar.gz"}

    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    @patch("builtins.open")
    @patch("model_optimizer.optimizer.json.load")
    def test_sets_ready_on_success(self, mock_json_load, mock_open, mock_db, mock_s3_utils, mock_convert):
        mock_s3_utils.parse_s3_uri.return_value = ("upload-bucket", "uploads/physical-models/p1/m1.tar.gz")
        mock_s3_utils.resolve_physical_model_pb.return_value = (MOCK_MODEL_PB, MOCK_METADATA)
        mock_json_load.return_value = {
            "training_algorithm": "clipped_ppo",
            "sensor": ["FRONT_FACING_CAMERA"],
            "action_space": [{"speed": 0.5, "steering_angle": -30}],
        }
        mock_convert.return_value = "p1/models/m1/optimized/"

        result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_s3_utils.poll_guardduty_scan_status.assert_called_once()
        mock_db.set_physical_import_ready.assert_called_once_with(
            "m1",
            "p1",
            "p1/models/m1/optimized/",
            "PPO",
            {"camera": "FRONT_FACING_CAMERA"},
            [{"speed": 0.5, "steering_angle": -30}],
            model_md5=None,
            metadata_md5=None,
        )
        mock_db.set_physical_import_error.assert_not_called()
        # Verify original archive is preserved at the expected key
        mock_s3_utils.copy_object.assert_called_once()
        copy_args = mock_s3_utils.copy_object.call_args[0]
        self.assertEqual(copy_args[0], "test-upload-bucket")  # source bucket
        self.assertEqual(copy_args[2], "test-model-bucket")  # dest bucket
        self.assertEqual(copy_args[3], "p1/models/m1/optimized/original-model.tar.gz")  # dest key
        self.assertEqual(result["status"], "READY")

    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    @patch("builtins.open")
    @patch("model_optimizer.optimizer.json.load")
    def test_skips_guardduty_scan_when_disabled(self, mock_json_load, mock_open, mock_db, mock_s3_utils, mock_convert):
        mock_s3_utils.parse_s3_uri.return_value = ("upload-bucket", "uploads/physical-models/p1/m1.tar.gz")
        mock_s3_utils.resolve_physical_model_pb.return_value = (MOCK_MODEL_PB, MOCK_METADATA)
        mock_json_load.return_value = {
            "training_algorithm": "clipped_ppo",
            "sensor": ["FRONT_FACING_CAMERA"],
            "action_space": [{"speed": 0.5, "steering_angle": -30}],
        }
        mock_convert.return_value = "p1/models/m1/optimized/"

        with patch.dict(os.environ, {"ENABLE_GUARDDUTY_MALWARE_SCAN": "false"}):
            result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_s3_utils.poll_guardduty_scan_status.assert_not_called()
        mock_db.set_physical_import_ready.assert_called_once_with(
            "m1",
            "p1",
            "p1/models/m1/optimized/",
            "PPO",
            {"camera": "FRONT_FACING_CAMERA"},
            [{"speed": 0.5, "steering_angle": -30}],
            model_md5=None,
            metadata_md5=None,
        )
        self.assertEqual(result["status"], "READY")

    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    def test_sets_error_on_guardduty_rejection(self, mock_db, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.return_value = ("upload-bucket", "uploads/physical-models/p1/m1.tar.gz")
        mock_s3_utils.poll_guardduty_scan_status.side_effect = optimizer.GuardDutyScanRejectedError(
            "Malware detected in uploaded file"
        )

        result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_db.set_physical_import_error.assert_called_once_with("m1", "p1", "Malware detected in uploaded file")
        self.assertEqual(result["status"], "ERROR")

    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    def test_sets_error_on_invalid_archive_structure(self, mock_db, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.return_value = ("upload-bucket", "uploads/physical-models/p1/m1.tar.gz")
        mock_s3_utils.resolve_physical_model_pb.side_effect = optimizer.InvalidArchiveStructureError(
            "Invalid physical model archive — missing required entries: agent/model.pb"
        )

        result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_db.set_physical_import_error.assert_called_once()
        self.assertEqual(result["status"], "ERROR")

    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    def test_sets_generic_error_message_on_unexpected_exception(self, mock_db, mock_s3_utils):
        mock_s3_utils.parse_s3_uri.side_effect = RuntimeError("unexpected boto3 failure")

        result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_db.set_physical_import_error.assert_called_once_with(
            "m1",
            "p1",
            "Unexpected error occurred while processing the import. "
            "Please try again in few minutes or contact support if issue persists with Request ID: test-request-id",
        )
        self.assertEqual(result["status"], "ERROR")

    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    @patch("builtins.open")
    @patch("model_optimizer.optimizer.json.load")
    def test_sets_error_when_set_physical_import_ready_throws(
        self, mock_json_load, mock_open, mock_db, mock_s3_utils, mock_convert
    ):
        """If set_physical_import_ready raises (e.g. malformed action_space), model
        must reach ERROR, not stay IMPORTING."""
        mock_s3_utils.parse_s3_uri.return_value = ("upload-bucket", "uploads/physical-models/p1/m1.tar.gz")
        mock_s3_utils.resolve_physical_model_pb.return_value = (MOCK_MODEL_PB, MOCK_METADATA)
        mock_json_load.return_value = {
            "training_algorithm": "clipped_ppo",
            "sensor": ["FRONT_FACING_CAMERA"],
            "action_space": {"speed": None},
        }
        mock_convert.return_value = "p1/models/m1/optimized/"
        mock_db.set_physical_import_ready.side_effect = AttributeError("'NoneType' object has no attribute 'get'")

        result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_db.set_physical_import_error.assert_called_once()
        self.assertIn("Unexpected error", mock_db.set_physical_import_error.call_args[0][2])
        self.assertEqual(result["status"], "ERROR")

    @patch("model_optimizer.optimizer._convert_and_upload")
    @patch("model_optimizer.optimizer._normalize_on_disk_metadata")
    @patch("builtins.open")
    @patch("model_optimizer.optimizer.json.load")
    @patch("model_optimizer.optimizer.s3_utils")
    @patch("model_optimizer.optimizer.db")
    def test_sanitizes_conversion_error_message(
        self, mock_db, mock_s3_utils, mock_json_load, mock_open, mock_normalize, mock_convert
    ):
        mock_s3_utils.parse_s3_uri.return_value = ("upload-bucket", "uploads/physical-models/p1/m1.tar.gz")
        mock_s3_utils.resolve_physical_model_pb.return_value = (MOCK_MODEL_PB, MOCK_METADATA)
        mock_json_load.return_value = {"training_algorithm": "clipped_ppo", "sensor": ["FRONT_FACING_CAMERA"]}
        mock_normalize.return_value = ("PPO", {"camera": "FRONT_FACING_CAMERA"})
        mock_convert.side_effect = optimizer.ConversionError(
            "OpenVINO conversion failed: /var/task/model_optimizer/something internal; TFLite conversion failed: ..."
        )

        result = optimizer._run_physical_import("m1", "p1", self.event, WORK_DIR, "test-request-id")

        mock_db.set_physical_import_error.assert_called_once_with(
            "m1",
            "p1",
            "Model conversion failed — the uploaded model format may be incompatible. Request ID: test-request-id",
        )
        self.assertEqual(result["status"], "ERROR")


def shutil_cleanup(work_dir):
    import shutil

    shutil.rmtree(work_dir, ignore_errors=True)


class TestMd5File(unittest.TestCase):
    def test_returns_hex_digest_for_valid_file(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"test model content")
            f.flush()
            result = optimizer._md5_file(f.name)
        os.unlink(f.name)
        self.assertIsNotNone(result)
        self.assertEqual(len(result), 32)  # MD5 hex is always 32 chars

    def test_returns_none_for_nonexistent_file(self):
        result = optimizer._md5_file("/nonexistent/path/model.pb")
        self.assertIsNone(result)

    def test_returns_consistent_hash(self):
        with tempfile.NamedTemporaryFile(delete=False) as f:
            f.write(b"deterministic content")
            f.flush()
            hash1 = optimizer._md5_file(f.name)
            hash2 = optimizer._md5_file(f.name)
        os.unlink(f.name)
        self.assertEqual(hash1, hash2)


if __name__ == "__main__":
    unittest.main()
