# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import datetime
import json
import os
import tarfile
from typing import List, Tuple

import cv2
import rosbag2_py
from deepracer_viz.model.metadata import ModelMetadata


def get_gradient_values(gradient_img, multiplier=1):
    """Given the image gradient returns gradient_alpha_rgb_mul and one_minus_gradient_alpha.
    These pre-calculated numbers are used to apply the gradient on the camera image

    Arguments:
        gradient_img (Image): Gradient image that has to applied on the camera image
        multiplier (float): This decides what percentage of gradient images alpha has to be applied.
                            This is useful in fading feature.

    Returns:
        (tuple): gradient_alpha_rgb_mul (Numpy.Array) gradient_img * gradient_alpha value
                 one_minus_gradient_alpha (Numpy.Array) (1 - gradient_alpha)
    """
    (height, width, _) = gradient_img.shape
    gradient_alpha = (gradient_img[:, :, 3] / 255.0 * multiplier).reshape(
        height, width, 1
    )

    gradient_alpha_rgb_mul = gradient_img * gradient_alpha
    one_minus_gradient_alpha = (1 - gradient_alpha).reshape(height, width)
    return gradient_alpha_rgb_mul, one_minus_gradient_alpha


def apply_gradient(main_image, gradient_alpha_rgb_mul, one_minus_gradient_alpha):
    """The gradient on the image is overlayed so that text looks visible and clear.
    This leaves a good effect on the image.
    The older code took 6.348s for 1000 runs

    Numpy broadcasting is slower than normal python
    major_cv_image_1[:, :, :4] = (gradient_alpha_rgb_mul + (major_cv_image_1 * one_minus_gradient_alpha))[:, :, :4]
    Timeit 1000 runs - 6.523s

    The current code takes - 5.131s for 1000 runs

    Args:
        main_image (Image): The main image where gradient has to be applied
        gradient_alpha_rgb_mul (Numpy.Array): gradient_img * gradient_alpha value
        one_minus_gradient_alpha (Numpy.Array): (1 - gradient_alpha)
    Returns:
        Image: Gradient applied image
    """
    for channel in range(0, 4):
        main_image[:, :, channel] = gradient_alpha_rgb_mul[:, :, channel] + (
            main_image[:, :, channel] * one_minus_gradient_alpha
        )
    return main_image


def load_background_image(file: str, WIDTH, HEIGHT):
    """
    Load and process a background image.
    This function performs the following steps:
    1. Loads the background image from the specified file path.
    2. Resizes the image to have the specified height (HEIGHT) while maintaining the aspect ratio.
    3. Crops the width of the resized image to fit within the specified width (WIDTH).
    4. Converts the image to RGBA format.
    Args:
        file (str): The file path to the background image.
        WIDTH (int): The desired width of the processed image.
        HEIGHT (int): The desired height of the processed image.
    Returns:
        numpy.ndarray: The processed background image in RGBA format.
    """

    # Load the background image
    background = cv2.imread(file)
    if background is None:
        raise FileNotFoundError(
            f"The file {file} does not exist or is not a valid image."
        )

    # Resize the background image to have 720 rows while maintaining the aspect ratio
    aspect_ratio = background.shape[1] / background.shape[0]
    new_width = int(HEIGHT * aspect_ratio)
    resized_background = cv2.resize(background, (new_width, HEIGHT))

    # Crop the width to fit within the desired WIDTH
    if new_width > WIDTH:
        resized_background = resized_background[:, :WIDTH]

    return cv2.cvtColor(resized_background, cv2.COLOR_BGR2RGBA)


def get_rosbag_options(
    path: str, serialization_format: str = "cdr"
) -> Tuple[rosbag2_py.StorageOptions, rosbag2_py.ConverterOptions]:
    """
    Get the ROS bag options for a given path and serialization format.

    Args:
        path (str): The path to the ROS bag file.
        serialization_format (str, optional): The serialization format to use. Defaults to 'cdr'.

    Returns:
        Tuple[rosbag2_py.StorageOptions, rosbag2_py.ConverterOptions]: A tuple containing the storage options and converter options.
    """

    storage_options = rosbag2_py.StorageOptions(uri=path)

    converter_options = rosbag2_py.ConverterOptions(
        input_serialization_format=serialization_format,
        output_serialization_format=serialization_format,
    )

    return storage_options, converter_options


def get_reader(bag_path: str, topics: List[str]) -> rosbag2_py.SequentialReader:
    """
    Returns a SequentialReader object for reading a ROS bag file.

    Parameters:
    - bag_path (str): The path to the ROS bag file.
    - topics (List[str]): A list of topics to read from the bag file.

    Returns:
    - reader (rosbag2_py.SequentialReader): The SequentialReader object for reading the bag file.
    """
    storage_options, converter_options = get_rosbag_options(bag_path)
    storage_filter = rosbag2_py.StorageFilter(topics=topics)

    reader = rosbag2_py.SequentialReader()
    reader.open(storage_options, converter_options)
    reader.set_filter(storage_filter)

    return reader


def print_baginfo(bag_info: dict):
    """
    Prints detailed information about a bag file.

    Args:
        bag_info (dict): A dictionary containing the following keys:
            - 'start_time' (float): The start time of the bag file in Unix timestamp.
            - 'step_actual' (int): The actual number of steps loaded.
            - 'step_diff' (int): The difference in steps.
            - 'elapsed_time' (float): The elapsed time in seconds.
            - 'fps' (float): The average frames per second.
            - 'action_space_size' (int): The size of the action space.
            - 'flip_x' (bool): Whether to flip the x-axis horizontally.
            - 'image_shape' (tuple): A tuple representing the shape of the input image (height, width, channels).
            - 'total_frames' (int): The total number of messages/frames.
    """

    print(
        "Start time: {}".format(datetime.datetime.fromtimestamp(bag_info["start_time"]))
    )
    print(
        "Loaded {} steps from {}.".format(
            bag_info["step_actual"], bag_info["step_diff"]
        )
    )
    print("Elapsed time: {:.2f} seconds".format(bag_info["elapsed_time"]))
    print("Average FPS: {:.1f}".format(bag_info["fps"]))
    if bag_info.get("action_space_size"):
        print(
            "Action Space: {} actions, first steering angle: {}, flip x-axis: {}".format(
                bag_info["action_space_size"],
                bag_info["action_space"][0]["steering_angle"],
                bag_info["flip_x"],
            )
        )
    print(
        "Input image: {}x{}, {} channels.".format(
            bag_info["image_shape"][1],
            bag_info["image_shape"][0],
            bag_info["image_shape"][2],
        )
    )
    print(
        "Total messages: {}, expected duration: {:.1f}".format(
            bag_info["total_frames"], bag_info["total_frames"] / bag_info["fps"]
        )
    )


def read_stream(data_queue, bag_path, topics, frame_limit):
    """
    Reads data from a bag file and puts it into a queue.

    Args:
        data_queue (queue.Queue): The queue to put the data into.
        bag_path (str): The path to the bag file.
        topics (list): The list of topics to read from the bag file.
        frame_limit (int): The maximum number of frames to read.

    Returns:
        None
    """
    s = 0
    reader = get_reader(bag_path, topics=topics)

    while reader.has_next() and s < frame_limit:
        (_, data, _) = reader.read_next()
        s += 1
        data_queue.put((s, data))


def load_model_from_dir(model_dir: str) -> Tuple[ModelMetadata, bytes]:
    """
    Load model metadata and model weights from a specified directory.

    Args:
        model_dir (str): The directory path where the model files are located.

    Returns:
        Tuple[deepracer_viz.ModelMetadata, bytes]: A tuple containing the model metadata and model weights.
    """

    model_metadata_path = os.path.join(model_dir, "model_metadata.json")
    model_weights_path = os.path.join(model_dir, "model.pb")
    if not os.path.exists(model_weights_path):
        model_weights_path = os.path.join(model_dir, "agent", "model.pb")

    if not os.path.exists(model_metadata_path):
        raise FileNotFoundError(
            f"Model metadata file not found at {model_metadata_path}"
        )
    if not os.path.exists(model_weights_path):
        raise FileNotFoundError(f"Model weights file not found at {model_weights_path}")

    model_metadata = ModelMetadata.from_file(model_metadata_path)

    with open(model_weights_path, "rb") as f:
        model_weights = f.read()

    return model_metadata, model_weights


def load_model_from_tar(tar_path: str) -> Tuple[ModelMetadata, bytes]:
    """
    Load model metadata and model weights from a tar.gz file.

    Args:
        tar_path (str): The file path to the tar.gz file containing the model files.

    Returns:
        Tuple[deepracer_viz.ModelMetadata, bytes]: A tuple containing the model metadata and model weights.
    """
    with tarfile.open(tar_path, "r:gz") as tar:
        model_metadata_file = None
        model_weights_file = None

        for member in tar.getmembers():
            if "model_metadata.json" in member.name:
                model_metadata_file = member
            elif "model.pb" in member.name:
                model_weights_file = member

        if model_metadata_file is None:
            raise FileNotFoundError(
                "Model metadata file not found in the tar.gz archive."
            )
        if model_weights_file is None:
            raise FileNotFoundError(
                "Model weights file not found in the tar.gz archive."
            )

        with tar.extractfile(model_metadata_file) as json_file:
            data = json.load(json_file)
            if "version" in data:
                simapp_version = data["version"]
            else:
                simapp_version = None

            if "sensor" in data:
                sensor = data["sensor"]
            else:
                sensor = ["observation"]
                simapp_version = "1.0"

            if "neural_network" in data:
                network = data["neural_network"]
            else:
                network = "DEEP_CONVOLUTIONAL_NETWORK_SHALLOW"

            if "action_space_type" in data:
                action_space_type = data["action_space_type"]
            else:
                action_space_type = "discrete"

            if "action_space" in data:
                action_space = data["action_space"]
            else:
                raise Exception("No action space in file")

            model_metadata = ModelMetadata(
                sensor, network, simapp_version, action_space_type, action_space
            )

        model_weights = tar.extractfile(model_weights_file).read()

    return model_metadata, model_weights
