#!/bin/bash
# Source the ROS workspace built into the image, then run the given command.
source /opt/ros/jazzy/setup.bash
source /var/task/install/setup.bash
exec "$@"
