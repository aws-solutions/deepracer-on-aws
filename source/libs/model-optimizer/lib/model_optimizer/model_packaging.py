# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""
Packaging of optimized artifacts into the three car-ready tar.gz archives.

NOTE: deliberately not named `packaging.py` — that name shadows the third-party
`packaging` PyPI library (used internally by TensorFlow, e.g.
`tensorflow.python.framework.meta_graph` does `from packaging import version`).
Since this file lives at /var/task, which is on sys.path in the Lambda runtime,
a module named `packaging.py` here would break TensorFlow's own imports.
Confirmed via a real ImportError while testing conversion.py end-to-end.
"""

import os
import tarfile

from .constants import (
    MODEL_BIN_FILENAME,
    MODEL_METADATA_FILENAME,
    MODEL_PB_FILENAME,
    MODEL_TFLITE_FILENAME,
    MODEL_XML_FILENAME,
)


def package_archive(output_path: str, files: dict) -> None:
    """
    Create a tar.gz at output_path containing each (arcname -> local_path) entry
    in `files`.
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with tarfile.open(output_path, "w:gz") as archive:
        for arcname, local_path in files.items():
            archive.add(local_path, arcname=arcname)


def package_openvino_model(
    output_path: str, model_metadata_path: str, model_pb_path: str, xml_path: str, bin_path: str
) -> None:
    """model_metadata.json + model.pb + model.xml + model.bin (IR v11, for DEEPRACER_CUSTOM cars)."""
    package_archive(
        output_path,
        {
            MODEL_METADATA_FILENAME: model_metadata_path,
            MODEL_PB_FILENAME: model_pb_path,
            MODEL_XML_FILENAME: xml_path,
            MODEL_BIN_FILENAME: bin_path,
        },
    )


def package_rpi_model(output_path: str, model_metadata_path: str, model_pb_path: str, tflite_path: str) -> None:
    """model_metadata.json + model.pb + model.tflite (for RPi cars)."""
    package_archive(
        output_path,
        {
            MODEL_METADATA_FILENAME: model_metadata_path,
            MODEL_PB_FILENAME: model_pb_path,
            MODEL_TFLITE_FILENAME: tflite_path,
        },
    )


def package_pb_only_model(output_path: str, model_metadata_path: str, model_pb_path: str) -> None:
    """model_metadata.json + model.pb only (for DEEPRACER stock cars, on-device conversion from model.pb)."""
    package_archive(
        output_path,
        {
            MODEL_METADATA_FILENAME: model_metadata_path,
            MODEL_PB_FILENAME: model_pb_path,
        },
    )
