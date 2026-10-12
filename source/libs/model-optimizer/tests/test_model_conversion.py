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


class TestConvertToOpenvinoIrStaticInputShape(unittest.TestCase):
    """Verify that dynamic input dimensions are pinned to 1 (fixes #100)."""

    @patch("model_optimizer.model_conversion.derive_output_tensor_name", return_value="output/policy")
    def test_dynamic_batch_dimension_pinned_to_static(self, _mock_output):
        mock_ov = MagicMock()

        # Simulate a dynamic batch dimension: shape is (?, 120, 160, 1)
        mock_dim_dynamic = MagicMock()
        mock_dim_dynamic.is_static = False

        mock_dim_120 = MagicMock()
        mock_dim_120.is_static = True

        mock_dim_160 = MagicMock()
        mock_dim_160.is_static = True

        mock_dim_1 = MagicMock()
        mock_dim_1.is_static = True

        mock_input = MagicMock()
        mock_input.get_any_name.return_value = "input_tensor"
        mock_input.get_partial_shape.return_value = [mock_dim_dynamic, mock_dim_120, mock_dim_160, mock_dim_1]

        mock_output = MagicMock()
        mock_output.get_any_name.return_value = "output/policy:0"

        # First call (probe): returns model with dynamic input
        probe_model = MagicMock()
        probe_model.inputs = [mock_input]
        probe_model.outputs = [mock_output]

        # Second call (final): returns the static model
        final_model = MagicMock()

        mock_ov.convert_model.side_effect = [probe_model, final_model]
        mock_ov.PartialShape = lambda dims: dims
        mock_ov.Dimension = lambda val: val

        with (
            patch.dict("sys.modules", {"openvino": mock_ov}),
            tempfile.TemporaryDirectory() as tmp_dir,
        ):
            # Re-import to pick up the mocked openvino
            model_conversion.convert_to_openvino_ir("/fake/model.pb", tmp_dir, "PPO")

            # The second convert_model call should include input= with static shapes
            second_call = mock_ov.convert_model.call_args_list[1]
            self.assertIn("input", second_call.kwargs)
            input_specs = second_call.kwargs["input"]
            self.assertEqual(len(input_specs), 1)
            name, shape = input_specs[0]
            self.assertEqual(name, "input_tensor")
            # The dynamic dim should be replaced with Dimension(1) = 1, static dims kept
            self.assertEqual(shape[0], 1)  # was dynamic, now pinned to 1

    @patch("model_optimizer.model_conversion.derive_output_tensor_name", return_value="output/policy")
    def test_raises_on_dynamic_non_batch_dimension(self, _mock_output):
        mock_ov = MagicMock()

        # Simulate a dynamic non-batch dimension: shape is (1, ?, 160, 1)
        mock_dim_1 = MagicMock()
        mock_dim_1.is_static = True

        mock_dim_dynamic = MagicMock()
        mock_dim_dynamic.is_static = False

        mock_dim_160 = MagicMock()
        mock_dim_160.is_static = True

        mock_dim_ch = MagicMock()
        mock_dim_ch.is_static = True

        mock_input = MagicMock()
        mock_input.get_any_name.return_value = "input_tensor"
        mock_input.get_partial_shape.return_value = [mock_dim_1, mock_dim_dynamic, mock_dim_160, mock_dim_ch]

        mock_output = MagicMock()
        mock_output.get_any_name.return_value = "output/policy:0"

        probe_model = MagicMock()
        probe_model.inputs = [mock_input]
        probe_model.outputs = [mock_output]

        mock_ov.convert_model.side_effect = [probe_model]

        with (
            patch.dict("sys.modules", {"openvino": mock_ov}),
            tempfile.TemporaryDirectory() as tmp_dir,
            self.assertRaises(model_conversion.ConversionError) as ctx,
        ):
            model_conversion.convert_to_openvino_ir("/fake/model.pb", tmp_dir, "PPO")

        self.assertIn("axis 1", str(ctx.exception))
