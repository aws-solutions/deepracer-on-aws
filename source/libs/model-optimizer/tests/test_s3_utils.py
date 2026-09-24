# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import tarfile
import tempfile
import unittest
from unittest.mock import MagicMock, patch

import boto3
from botocore.exceptions import ClientError
from moto import mock_aws

from model_optimizer import s3_utils

TEST_ACCOUNT_ID = "123456789012"
TEST_REGION = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


class TestParseS3Uri(unittest.TestCase):
    def test_parses_valid_uri(self):
        bucket, key = s3_utils.parse_s3_uri("s3://my-bucket/some/key.json")
        self.assertEqual(bucket, "my-bucket")
        self.assertEqual(key, "some/key.json")

    def test_raises_on_invalid_uri(self):
        with self.assertRaises(ValueError):
            s3_utils.parse_s3_uri("not-an-s3-uri")


class TestPollGuardDutyScanStatus(unittest.TestCase):
    def setUp(self):
        s3_utils._s3_client = None

    @mock_aws
    def test_returns_normally_on_clean_scan(self):
        client = boto3.client("s3", region_name=TEST_REGION)
        client.create_bucket(Bucket="test-bucket")
        client.put_object(Bucket="test-bucket", Key="test-key", Body=b"data", ExpectedBucketOwner=TEST_ACCOUNT_ID)
        client.put_object_tagging(
            Bucket="test-bucket",
            Key="test-key",
            Tagging={"TagSet": [{"Key": "GuardDutyMalwareScanStatus", "Value": "NO_THREATS_FOUND"}]},
            ExpectedBucketOwner=TEST_ACCOUNT_ID,
        )

        s3_utils.poll_guardduty_scan_status("test-bucket", "test-key")

    def _assert_raises_for_status(self, status, expected_message_fragment):
        with patch.object(s3_utils, "_client") as mock_client_factory:
            mock_client = MagicMock()
            mock_client_factory.return_value = mock_client
            mock_client.get_object_tagging.return_value = {
                "TagSet": [{"Key": "GuardDutyMalwareScanStatus", "Value": status}]
            }

            with self.assertRaises(s3_utils.GuardDutyScanRejectedError) as context:
                s3_utils.poll_guardduty_scan_status("bucket", "key")

            self.assertIn(expected_message_fragment, str(context.exception))
            mock_client.get_object_tagging.assert_called_once()

    def test_raises_on_threats_found(self):
        self._assert_raises_for_status("THREATS_FOUND", "Malware detected")

    def test_raises_on_unsupported(self):
        self._assert_raises_for_status("UNSUPPORTED", "re-upload")

    def test_raises_on_access_denied(self):
        self._assert_raises_for_status("ACCESS_DENIED", "Scan service unavailable")

    def test_raises_on_failed(self):
        self._assert_raises_for_status("FAILED", "Scan service error")

    @patch("model_optimizer.s3_utils.time.sleep", return_value=None)
    def test_raises_timeout_after_max_polls(self, mock_sleep):
        with patch.object(s3_utils, "_client") as mock_client_factory:
            mock_client = MagicMock()
            mock_client_factory.return_value = mock_client
            mock_client.get_object_tagging.return_value = {"TagSet": []}

            with self.assertRaises(s3_utils.GuardDutyScanRejectedError) as context:
                s3_utils.poll_guardduty_scan_status("bucket", "key")

            self.assertIn("timed out", str(context.exception))
            self.assertEqual(mock_client.get_object_tagging.call_count, s3_utils.GUARDDUTY_SCAN_MAX_POLLS)
            self.assertEqual(mock_sleep.call_count, s3_utils.GUARDDUTY_SCAN_MAX_POLLS - 1)

    def test_raises_on_s3_client_error(self):
        with patch.object(s3_utils, "_client") as mock_client_factory:
            mock_client = MagicMock()
            mock_client_factory.return_value = mock_client
            mock_client.get_object_tagging.side_effect = ClientError(
                {"Error": {"Code": "NoSuchKey", "Message": "not found"}}, "GetObjectTagging"
            )

            with self.assertRaises(s3_utils.GuardDutyScanRejectedError) as context:
                s3_utils.poll_guardduty_scan_status("bucket", "key")

            self.assertIn("retry", str(context.exception))


class TestResolvePhysicalModelPb(unittest.TestCase):
    def test_raises_when_both_entries_missing(self):
        with tempfile.TemporaryDirectory() as tmp_dir, self.assertRaises(s3_utils.InvalidArchiveStructureError):
            s3_utils.resolve_physical_model_pb(tmp_dir)

    def test_raises_when_model_pb_missing(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            with open(os.path.join(tmp_dir, "model_metadata.json"), "w") as f:
                f.write("{}")
            with self.assertRaises(s3_utils.InvalidArchiveStructureError):
                s3_utils.resolve_physical_model_pb(tmp_dir)

    def test_succeeds_when_both_entries_present(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.makedirs(os.path.join(tmp_dir, "agent"))
            with open(os.path.join(tmp_dir, "model_metadata.json"), "w") as f:
                f.write("{}")
            with open(os.path.join(tmp_dir, "agent", "model.pb"), "wb") as f:
                f.write(b"data")

            model_pb_path, model_metadata_path = s3_utils.resolve_physical_model_pb(tmp_dir)

            self.assertTrue(os.path.isfile(model_pb_path))
            self.assertTrue(os.path.isfile(model_metadata_path))

    def test_succeeds_with_flat_layout_model_pb_at_root(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            with open(os.path.join(tmp_dir, "model_metadata.json"), "w") as f:
                f.write("{}")
            with open(os.path.join(tmp_dir, "model.pb"), "wb") as f:
                f.write(b"data")

            model_pb_path, model_metadata_path = s3_utils.resolve_physical_model_pb(tmp_dir)

            self.assertEqual(os.path.basename(model_pb_path), "model.pb")
            self.assertTrue(os.path.isfile(model_pb_path))
            self.assertTrue(os.path.isfile(model_metadata_path))

    def test_prefers_agent_subdir_over_root(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.makedirs(os.path.join(tmp_dir, "agent"))
            with open(os.path.join(tmp_dir, "model_metadata.json"), "w") as f:
                f.write("{}")
            # Both locations exist — should prefer agent/
            with open(os.path.join(tmp_dir, "model.pb"), "wb") as f:
                f.write(b"root")
            with open(os.path.join(tmp_dir, "agent", "model.pb"), "wb") as f:
                f.write(b"agent")

            model_pb_path, _ = s3_utils.resolve_physical_model_pb(tmp_dir)

            self.assertIn("agent", model_pb_path)

    def test_finds_metadata_in_agent_subdir(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            os.makedirs(os.path.join(tmp_dir, "agent"))
            with open(os.path.join(tmp_dir, "agent", "model_metadata.json"), "w") as f:
                f.write("{}")
            with open(os.path.join(tmp_dir, "agent", "model.pb"), "wb") as f:
                f.write(b"data")

            _, model_metadata_path = s3_utils.resolve_physical_model_pb(tmp_dir)

            self.assertIn("agent", model_metadata_path)
            self.assertTrue(os.path.isfile(model_metadata_path))


class TestExtractTarGz(unittest.TestCase):
    def test_extracts_archive_contents(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = os.path.join(tmp_dir, "source.txt")
            with open(source_path, "w") as f:
                f.write("hello")

            archive_path = os.path.join(tmp_dir, "archive.tar.gz")
            with tarfile.open(archive_path, "w:gz") as archive:
                archive.add(source_path, arcname="source.txt")

            dest_dir = os.path.join(tmp_dir, "extracted")
            s3_utils.extract_tar_gz(archive_path, dest_dir)

            with open(os.path.join(dest_dir, "source.txt")) as f:
                self.assertEqual(f.read(), "hello")

    def test_rejects_path_traversal_member(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = os.path.join(tmp_dir, "evil.txt")
            with open(source_path, "w") as f:
                f.write("payload")

            archive_path = os.path.join(tmp_dir, "archive.tar.gz")
            with tarfile.open(archive_path, "w:gz") as archive:
                archive.add(source_path, arcname="../../etc/evil.txt")

            dest_dir = os.path.join(tmp_dir, "extracted")
            with self.assertRaises(s3_utils.InvalidArchiveStructureError) as context:
                s3_utils.extract_tar_gz(archive_path, dest_dir)
            self.assertIn("Path traversal", str(context.exception))

    def test_rejects_symlink_member(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            archive_path = os.path.join(tmp_dir, "archive.tar.gz")
            with tarfile.open(archive_path, "w:gz") as archive:
                symlink_info = tarfile.TarInfo(name="agent/model.pb")
                symlink_info.type = tarfile.SYMTYPE
                symlink_info.linkname = "/etc/passwd"
                archive.addfile(symlink_info)

            dest_dir = os.path.join(tmp_dir, "extracted")
            with self.assertRaises(s3_utils.InvalidArchiveStructureError) as context:
                s3_utils.extract_tar_gz(archive_path, dest_dir)
            self.assertIn("Unsupported archive member type", str(context.exception))

    def test_rejects_hardlink_member(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            archive_path = os.path.join(tmp_dir, "archive.tar.gz")
            with tarfile.open(archive_path, "w:gz") as archive:
                hardlink_info = tarfile.TarInfo(name="agent/model.pb")
                hardlink_info.type = tarfile.LNKTYPE
                hardlink_info.linkname = "model_metadata.json"
                archive.addfile(hardlink_info)

            dest_dir = os.path.join(tmp_dir, "extracted")
            with self.assertRaises(s3_utils.InvalidArchiveStructureError) as context:
                s3_utils.extract_tar_gz(archive_path, dest_dir)
            self.assertIn("Unsupported archive member type", str(context.exception))

    def test_rejects_device_file_member(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            archive_path = os.path.join(tmp_dir, "archive.tar.gz")
            with tarfile.open(archive_path, "w:gz") as archive:
                device_info = tarfile.TarInfo(name="agent/fake_device")
                device_info.type = tarfile.CHRTYPE
                archive.addfile(device_info)

            dest_dir = os.path.join(tmp_dir, "extracted")
            with self.assertRaises(s3_utils.InvalidArchiveStructureError) as context:
                s3_utils.extract_tar_gz(archive_path, dest_dir)
            self.assertIn("Unsupported archive member type", str(context.exception))

    def test_allows_directory_members(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = os.path.join(tmp_dir, "model.pb")
            with open(source_path, "w") as f:
                f.write("data")

            archive_path = os.path.join(tmp_dir, "archive.tar.gz")
            with tarfile.open(archive_path, "w:gz") as archive:
                archive.add(source_path, arcname="agent/model.pb")

            dest_dir = os.path.join(tmp_dir, "extracted")
            s3_utils.extract_tar_gz(archive_path, dest_dir)

            with open(os.path.join(dest_dir, "agent", "model.pb")) as f:
                self.assertEqual(f.read(), "data")


class TestParseBestCheckpointNumber(unittest.TestCase):
    def test_parses_checkpoint_number(self):
        checkpoints_json = {"best_checkpoint": {"name": "4_Step-1752.ckpt"}}
        self.assertEqual(s3_utils.parse_best_checkpoint_number(checkpoints_json), 4)

    def test_raises_when_best_checkpoint_missing(self):
        with self.assertRaises(ValueError):
            s3_utils.parse_best_checkpoint_number({})

    def test_raises_when_name_unparsable(self):
        checkpoints_json = {"best_checkpoint": {"name": "not-a-checkpoint-name"}}
        with self.assertRaises(ValueError):
            s3_utils.parse_best_checkpoint_number(checkpoints_json)


class TestUploadFile(unittest.TestCase):
    @mock_aws
    def test_uploads_file_to_s3(self):
        s3_utils._s3_client = None
        s3 = boto3.client("s3", region_name=TEST_REGION)
        s3.create_bucket(Bucket="test-bucket")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            f.write("hello")
            local_path = f.name

        try:
            s3_utils.upload_file(local_path, "test-bucket", "output/file.txt")
            response = s3.get_object(Bucket="test-bucket", Key="output/file.txt", ExpectedBucketOwner=TEST_ACCOUNT_ID)
            self.assertEqual(response["Body"].read().decode(), "hello")
        finally:
            os.remove(local_path)


class TestReadJsonObject(unittest.TestCase):
    @mock_aws
    def test_reads_and_parses_json(self):
        s3_utils._s3_client = None
        s3 = boto3.client("s3", region_name=TEST_REGION)
        s3.create_bucket(Bucket="test-bucket")
        s3.put_object(
            Bucket="test-bucket",
            Key="data.json",
            Body='{"key": "value", "num": 42}',
            ExpectedBucketOwner=TEST_ACCOUNT_ID,
        )

        result = s3_utils.read_json_object("test-bucket", "data.json")
        self.assertEqual(result, {"key": "value", "num": 42})


@mock_aws
class TestCopyObject(unittest.TestCase):
    def test_copies_object_between_buckets(self):
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="source-bucket")
        s3.create_bucket(Bucket="dest-bucket")
        s3.put_object(Bucket="source-bucket", Key="models/archive.tar.gz", Body=b"archive content")

        s3_utils.copy_object("source-bucket", "models/archive.tar.gz", "dest-bucket", "preserved/original.tar.gz")

        response = s3.get_object(Bucket="dest-bucket", Key="preserved/original.tar.gz")
        self.assertEqual(response["Body"].read(), b"archive content")


if __name__ == "__main__":
    unittest.main()
