# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""Turns the rosbags of a car log job into videos.

Runs as an AWS Batch job. It reads `job-configs/<jobId>.json` from the device logs bucket, analyses every bag
with its model, combines the results into videos and writes `results/<jobId>.json` for the workflow to register.
"""

import json
import logging
import os
import shutil
import subprocess
import sys
from pathlib import Path, PurePosixPath
from typing import Any

import boto3

from car_log_video_processor.job import (
    Bag,
    JobConfig,
    VideoGroup,
    build_manifest,
    group_bags,
    manifest_video,
    parse_config,
    race_data,
)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper(), format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("car_log_video_processor")

WORK_DIR = Path(os.getenv("WORK_DIR", "/tmp/car-logs"))  # noqa: S108
APP_DIR = Path(__file__).resolve().parent
RESOURCES_DIR = APP_DIR / "resources"
BACKGROUND_IMAGE = RESOURCES_DIR / next(p.name for p in RESOURCES_DIR.glob("AWS-Deepracer_Background*.jpg"))

s3 = boto3.client("s3")


def download_prefix(bucket: str, prefix: str, target: Path) -> None:
    """Downloads everything below `prefix` into `target`, refusing keys that would leave it."""
    target.mkdir(parents=True, exist_ok=True)
    for page in s3.get_paginator("list_objects_v2").paginate(Bucket=bucket, Prefix=prefix):
        for obj in page.get("Contents", []):
            relative = PurePosixPath(obj["Key"][len(prefix) :])
            if not relative.name or ".." in relative.parts or relative.is_absolute():
                continue
            destination = target / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            s3.download_file(bucket, obj["Key"], str(destination))


def download_model(config: JobConfig, bag: Bag, cache: dict[str, Path]) -> Path:
    key = bag.model_artifact_key
    if not key:
        raise FileNotFoundError("The model files are no longer available.")
    if key not in cache:
        path = WORK_DIR / "models" / f"{len(cache)}.tar.gz"
        path.parent.mkdir(parents=True, exist_ok=True)
        s3.download_file(config.model_bucket, key, str(path))
        cache[key] = path
    return cache[key]


def subprocess_env() -> dict[str, str]:
    """Environment for the analysis subprocess; keeps the ROS paths that entry.sh put in PYTHONPATH."""
    python_path = os.pathsep.join(p for p in (str(APP_DIR.parent), os.environ.get("PYTHONPATH")) if p)
    return {**os.environ, "PYTHONPATH": python_path}


def analyse_bag(config: JobConfig, bag: Bag, model_path: Path, settings: dict[str, Any]) -> Path | None:
    """Renders the analysis video of one bag in a subprocess, so a crash only fails that bag."""
    bag_path = WORK_DIR / "input" / bag.bag_dir
    video_path = WORK_DIR / "intermediate" / f"{bag.bag_dir}.mp4"
    video_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        download_prefix(config.bucket, bag.bag_prefix, bag_path)
        cmd = [
            sys.executable,
            str(APP_DIR / "bag_analysis.py"),
            "--bag_path",
            str(bag_path),
            "--model",
            str(model_path),
            "--codec",
            settings["codec"],
            "--update_frequency",
            "5",
            "--output_file",
            str(video_path),
            "--background",
        ]
        if settings["relative_labels"]:
            cmd.append("--relative_labels")
        if settings["frame_limit"]:
            cmd += ["--frame_limit", settings["frame_limit"]]
        if settings["describe"]:
            cmd.append("--describe")
        result = subprocess.run(cmd, check=False, env=subprocess_env())
    finally:
        shutil.rmtree(bag_path, ignore_errors=True)
    if result.returncode != 0 or not video_path.is_file():
        logger.error("Analysis of %s failed with code %s", bag.bag_dir, result.returncode)
        return None
    return video_path


def font_paths() -> dict[str, str]:
    """Font files keyed by the weights that combine_videos looks up."""
    return {
        "light": str(RESOURCES_DIR / "Amazon_Ember_Lt.ttf"),
        "regular": str(RESOURCES_DIR / "Amazon_Ember_Rg.ttf"),
        "bold": str(RESOURCES_DIR / "Amazon_Ember_Bd.ttf"),
        "heavy": str(RESOURCES_DIR / "Amazon_Ember_He.ttf"),
    }


def combine_group(config: JobConfig, group: VideoGroup, settings: dict[str, Any]) -> dict[str, Any] | None:
    from car_log_video_processor.combine_videos import combine_videos  # needs OpenCV, kept out of the unit tests

    output = WORK_DIR / "final" / f"{group.profile_id}-{PurePosixPath(group.video_key).name}"
    output.parent.mkdir(parents=True, exist_ok=True)
    info = combine_videos(
        group.videos,
        str(output),
        {"background": str(BACKGROUND_IMAGE), "logo": str(RESOURCES_DIR / "logo192.png")},
        font_paths(),
        codec=settings["codec"],
        skip_duration=settings["skip_duration"],
        update_frequency=1,
        metadata={
            "username": group.racer_name,
            "race_data": race_data(config, group),
            "car_name": config.car_name,
            "event_name": config.event_name,
            "models": group.models,
        },
    )
    if not info or not info.get("included_videos") or not output.is_file():
        return None
    s3.upload_file(str(output), config.bucket, group.video_key, ExtraArgs={"ContentType": "video/mp4"})
    output.unlink(missing_ok=True)
    return info


def run(job_id: str, bucket: str, config_key: str, result_key: str, settings: dict[str, Any]) -> None:
    config = parse_config(json.loads(s3.get_object(Bucket=bucket, Key=config_key)["Body"].read()))
    if config.job_id != job_id or config.bucket != bucket:
        raise ValueError("The job config does not belong to this job.")

    failures: list[dict[str, str]] = []
    analysed: list[tuple[Bag, Path]] = []
    models: dict[str, Path] = {}
    for bag in config.bags:
        try:
            model_path = download_model(config, bag, models)
            video = analyse_bag(config, bag, model_path, settings)
        except Exception:
            logger.exception("Could not process %s", bag.bag_dir)
            failures.append({"bagDir": bag.bag_dir, "reason": "The model or log could not be processed."})
            continue
        if video is None:
            failures.append({"bagDir": bag.bag_dir, "reason": "The log could not be analysed."})
        else:
            analysed.append((bag, video))

    videos_by_bag = {bag.bag_dir: path for bag, path in analysed}
    videos: list[dict[str, Any]] = []
    for group in group_bags(config, [bag for bag, _ in analysed]):
        group.videos = [str(videos_by_bag[bag_dir]) for bag_dir in group.bag_dirs]
        try:
            info = combine_group(config, group, settings)
        except Exception:
            logger.exception("Could not create the video of %s", group.video_key)
            info = None
        if info is None:
            failures += [{"bagDir": d, "reason": "No video could be created."} for d in group.bag_dirs]
        else:
            videos.append(manifest_video(group, info))

    manifest = build_manifest(job_id, videos, failures)
    s3.put_object(Bucket=bucket, Key=result_key, Body=json.dumps(manifest).encode(), ContentType="application/json")
    logger.info("Created %d video(s), %d bag(s) failed", len(videos), len(failures))


def main() -> None:
    job_id = os.environ["JOB_ID"]
    settings = {
        "codec": os.getenv("CODEC", "avc1"),
        "frame_limit": os.getenv("FRAME_LIMIT"),
        "describe": os.getenv("DESCRIBE", "false").lower() == "true",
        "relative_labels": os.getenv("RELATIVE_LABELS", "false").lower() == "true",
        "skip_duration": float(os.getenv("SKIP_DURATION", "20")),
    }
    run(
        job_id,
        os.environ["BUCKET"],
        os.getenv("CONFIG_KEY", f"job-configs/{job_id}.json"),
        os.getenv("RESULT_KEY", f"results/{job_id}.json"),
        settings,
    )


if __name__ == "__main__":
    main()
