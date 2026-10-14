# ROS 2 is needed to read the rosbags recorded by the car, so this image cannot use the Lambda Python base.
FROM public.ecr.aws/docker/library/ros:jazzy-ros-base

# The forks below are pinned to the commits the video processor was built and tested against.
ARG DEEPRACER_VIZ_REF=496523a738953842b50032723908056262a79847
ARG DEEPRACER_INTERFACES_REF=78873a03379be478159c7c9e8c644288979db881

RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    libboost-all-dev \
    ros-jazzy-image-transport \
    ros-jazzy-compressed-image-transport \
    ros-jazzy-cv-bridge \
    ros-jazzy-pybind11-vendor \
    ros-jazzy-test-msgs \
    ros-jazzy-rosbag2-storage-mcap \
    python3-pip \
    libjsoncpp-dev \
    v4l-utils \
    ffmpeg \
    libx264-dev && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/requirements.txt
RUN pip3 install -U --break-system-packages --ignore-installed --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

RUN mkdir -p /var/task/src /var/task/.tmp/matplotlib && \
    cd /var/task/src && \
    git clone https://github.com/larsll/deepracer-viz && git -C deepracer-viz checkout "${DEEPRACER_VIZ_REF}" && \
    git clone https://github.com/larsll/aws-deepracer-interfaces-pkg && \
    git -C aws-deepracer-interfaces-pkg checkout "${DEEPRACER_INTERFACES_REF}" && \
    bash -c 'cd /var/task && source /opt/ros/jazzy/setup.bash && colcon build --merge-install && rm -rf build log src'

ENV MPLCONFIGDIR=/var/task/.tmp/matplotlib
ENV PYTHONUNBUFFERED=1

COPY lib/ /var/task/app/
COPY entry.sh /entry.sh
RUN chmod +x /entry.sh

# The job runs unprivileged; /tmp is the scratch space for bags and videos.
RUN useradd --system --create-home --uid 1001 carlogs && chown -R carlogs /var/task/.tmp
USER carlogs

ENV PYTHONPATH=/var/task/app
ENTRYPOINT ["/entry.sh"]
CMD ["python3", "-m", "car_log_video_processor.main"]
