# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import tempfile
import unittest
from unittest.mock import MagicMock, patch

from model_optimizer import model_conversion


class TestDeriveInputTensorNames(unittest.TestCase):
    def test_ppo_camera(self):
        names = model_conversion.derive_input_tensor_names("PPO", {"camera": "FRONT_FACING_CAMERA"})
        self.assertEqual(names, ["main_level/agent/main/online/network_0/FRONT_FACING_CAMERA/FRONT_FACING_CAMERA"])

    def test_sac_camera(self):
        names = model_conversion.derive_input_tensor_names("SAC", {"camera": "FRONT_FACING_CAMERA"})
        self.assertEqual(names, ["main_level/agent/policy/online/network_0/FRONT_FACING_CAMERA/FRONT_FACING_CAMERA"])

    def test_camera_and_lidar(self):
        names = model_conversion.derive_input_tensor_names("PPO", {"camera": "STEREO_CAMERAS", "lidar": "SECTOR_LIDAR"})
        self.assertEqual(
            names,
            [
                "main_level/agent/main/online/network_0/STEREO_CAMERAS/STEREO_CAMERAS",
                "main_level/agent/main/online/network_0/SECTOR_LIDAR/SECTOR_LIDAR",
            ],
        )

    def test_observation_camera_maps_to_observation_segment(self):
        names = model_conversion.derive_input_tensor_names("PPO", {"camera": "OBSERVATION_CAMERA"})
        self.assertEqual(names, ["main_level/agent/main/online/network_0/observation/observation"])

    def test_raises_on_unrecognized_algorithm(self):
        with self.assertRaises(ValueError):
            model_conversion.derive_input_tensor_names("DQN", {"camera": "FRONT_FACING_CAMERA"})

    def test_raises_on_unrecognized_camera(self):
        with self.assertRaises(ValueError):
            model_conversion.derive_input_tensor_names("PPO", {"camera": "INFRARED_CAMERA"})

    def test_raises_when_no_sensors(self):
        with self.assertRaises(ValueError):
            model_conversion.derive_input_tensor_names("PPO", {})


class TestDeriveOutputTensorName(unittest.TestCase):
    def test_ppo(self):
        self.assertEqual(
            model_conversion.derive_output_tensor_name("PPO"),
            "main_level/agent/main/online/network_1/ppo_head_0/policy",
        )

    def test_sac(self):
        self.assertEqual(
            model_conversion.derive_output_tensor_name("SAC"),
            "main_level/agent/policy/online/network_0/sac_policy_head_0/policy",
        )

    def test_raises_on_unrecognized_algorithm(self):
        with self.assertRaises(ValueError):
            model_conversion.derive_output_tensor_name("DQN")


class TestConvertToOpenvinoIrErrorWrapping(unittest.TestCase):
    def test_unrecognized_algorithm_raises_conversion_error_not_value_error(self):
        # A bad agentAlgorithm makes derive_output_tensor_name raise ValueError.
        # It must surface as ConversionError so _convert_and_upload still attempts
        # the independent TFLite conversion instead of aborting both.
        with (
            patch.dict("sys.modules", {"openvino": MagicMock()}),
            tempfile.TemporaryDirectory() as tmp_dir,
            self.assertRaises(model_conversion.ConversionError),
        ):
            model_conversion.convert_to_openvino_ir("/nonexistent/model.pb", tmp_dir, "DQN")
