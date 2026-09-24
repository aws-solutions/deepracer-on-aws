# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import os
import tarfile
import tempfile
import unittest

from model_optimizer.model_packaging import package_openvino_model, package_pb_only_model, package_rpi_model


class TestPackageOpenvinoModel(unittest.TestCase):
    def test_creates_tarball_with_correct_entries(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            # Create dummy files
            metadata = os.path.join(tmp_dir, "model_metadata.json")
            model_pb = os.path.join(tmp_dir, "model.pb")
            xml = os.path.join(tmp_dir, "model.xml")
            bin_file = os.path.join(tmp_dir, "model.bin")
            for f in [metadata, model_pb, xml, bin_file]:
                open(f, "w").close()

            output = os.path.join(tmp_dir, "output", "openvino-model.tar.gz")
            package_openvino_model(output, metadata, model_pb, xml, bin_file)

            self.assertTrue(os.path.isfile(output))
            with tarfile.open(output, "r:gz") as archive:
                names = sorted(archive.getnames())
            self.assertEqual(names, sorted(["model.bin", "model.pb", "model.xml", "model_metadata.json"]))


class TestPackageRpiModel(unittest.TestCase):
    def test_creates_tarball_with_correct_entries(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            metadata = os.path.join(tmp_dir, "model_metadata.json")
            model_pb = os.path.join(tmp_dir, "model.pb")
            tflite = os.path.join(tmp_dir, "model.tflite")
            for f in [metadata, model_pb, tflite]:
                open(f, "w").close()

            output = os.path.join(tmp_dir, "output", "rpi-model.tar.gz")
            package_rpi_model(output, metadata, model_pb, tflite)

            self.assertTrue(os.path.isfile(output))
            with tarfile.open(output, "r:gz") as archive:
                names = sorted(archive.getnames())
            self.assertEqual(names, sorted(["model.pb", "model.tflite", "model_metadata.json"]))


class TestPackagePbOnlyModel(unittest.TestCase):
    def test_creates_tarball_with_correct_entries(self):
        with tempfile.TemporaryDirectory() as tmp_dir:
            metadata = os.path.join(tmp_dir, "model_metadata.json")
            model_pb = os.path.join(tmp_dir, "model.pb")
            for f in [metadata, model_pb]:
                open(f, "w").close()

            output = os.path.join(tmp_dir, "output", "pb-only-model.tar.gz")
            package_pb_only_model(output, metadata, model_pb)

            self.assertTrue(os.path.isfile(output))
            with tarfile.open(output, "r:gz") as archive:
                names = sorted(archive.getnames())
            self.assertEqual(names, sorted(["model.pb", "model_metadata.json"]))
