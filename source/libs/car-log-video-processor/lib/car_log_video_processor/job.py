# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

"""Job config, video grouping and result manifest of a car log job.

The config is written by the `jobProcessUpload` Lambda and the manifest is validated by the
`jobRegisterResults` Lambda (see `libs/lambda/src/car-logs/types.ts`). Nothing in here needs ROS or OpenCV.
"""

import re
from dataclasses import dataclass, field
from typing import Any

_BAG_TIMESTAMP = re.compile(r"-(\d{8})-(\d{6})$")


@dataclass(frozen=True)
class Bag:
    bag_dir: str
    bag_prefix: str
    profile_id: str
    model_id: str
    video_key: str
    racer_name: str | None = None
    model_name: str | None = None
    model_artifact_key: str | None = None

    @property
    def timestamp(self) -> str:
        """`YYYYMMDD-HHMMSS` of the recording, taken from the folder name."""
        match = _BAG_TIMESTAMP.search(self.bag_dir)
        return f"{match.group(1)}-{match.group(2)}" if match else ""

    @property
    def date(self) -> str:
        return self.timestamp[:8]


@dataclass(frozen=True)
class JobConfig:
    job_id: str
    bucket: str
    model_bucket: str
    bags: list[Bag]
    car_name: str | None = None
    event_name: str | None = None
    race: dict[str, Any] | None = None


@dataclass
class VideoGroup:
    """Bags of one racer that end up in the same video."""

    bags: list[Bag]
    with_race: bool = False
    videos: list[str] = field(default_factory=list)

    @property
    def profile_id(self) -> str:
        return self.bags[0].profile_id

    @property
    def racer_name(self) -> str:
        return self.bags[0].racer_name or "Unknown Racer"

    @property
    def bag_dirs(self) -> list[str]:
        return [bag.bag_dir for bag in self.bags]

    @property
    def video_key(self) -> str:
        return self.bags[0].video_key

    @property
    def models(self) -> list[dict[str, str | None]]:
        models: dict[str, dict[str, str | None]] = {}
        for bag in self.bags:
            models.setdefault(bag.model_id, {"modelId": bag.model_id, "modelName": bag.model_name})
        return list(models.values())


def parse_config(raw: Any) -> JobConfig:
    if not isinstance(raw, dict) or not isinstance(raw.get("bags"), list):
        raise ValueError("The job config is malformed.")
    bags = []
    for item in raw["bags"]:
        try:
            bags.append(
                Bag(
                    bag_dir=item["bagDir"],
                    bag_prefix=item["bagPrefix"],
                    profile_id=item["profileId"],
                    model_id=item["modelId"],
                    video_key=item["videoKey"],
                    racer_name=item.get("racerName"),
                    model_name=item.get("modelName"),
                    model_artifact_key=item.get("modelArtifactKey"),
                )
            )
        except (KeyError, TypeError) as error:
            raise ValueError("The job config contains a malformed bag.") from error
    try:
        return JobConfig(
            job_id=raw["jobId"],
            bucket=raw["bucket"],
            model_bucket=raw["modelBucket"],
            bags=bags,
            car_name=raw.get("carName"),
            event_name=raw.get("eventName"),
            race=raw.get("race"),
        )
    except KeyError as error:
        raise ValueError("The job config is malformed.") from error


def group_bags(config: JobConfig, bags: list[Bag]) -> list[VideoGroup]:
    """Groups bags into videos, one racer per video.

    Jobs of a race put all of the racer's bags in one video, together with the lap times. Other jobs make one
    video per racer, model and day.
    """
    race_racer = config.race.get("racerName") if config.race else None
    groups: dict[tuple[str, ...], VideoGroup] = {}
    for bag in sorted(bags, key=lambda b: (b.timestamp, b.bag_dir)):
        with_race = bool(config.race) and (race_racer is None or race_racer == bag.racer_name)
        key = (bag.profile_id, "race") if with_race else (bag.profile_id, bag.model_id, bag.date)
        group = groups.setdefault(key, VideoGroup(bags=[], with_race=with_race))
        group.bags.append(bag)
    return list(groups.values())


def race_data(config: JobConfig, group: VideoGroup) -> dict[str, Any] | None:
    """Lap data in the shape `combine_videos` renders, for groups that belong to the race."""
    if not config.race or not group.with_race:
        return None
    laps = [
        {
            "lapId": lap["lapNumber"] - 1,
            "time": lap["lapTimeMs"],
            "isValid": lap["isValid"],
            "resets": lap.get("resets", 0),
        }
        for lap in config.race.get("laps", [])
    ]
    return {"trackName": config.race.get("trackName") or "Unknown", "username": group.racer_name, "laps": laps}


def build_manifest(job_id: str, videos: list[dict[str, Any]], failures: list[dict[str, str]]) -> dict[str, Any]:
    return {"jobId": job_id, "videos": videos, "failures": failures}


def manifest_video(group: VideoGroup, info: dict[str, Any]) -> dict[str, Any]:
    return {
        "bagDirs": group.bag_dirs,
        "videoKey": group.video_key,
        "durationSeconds": info.get("duration"),
        "fps": info.get("fps"),
        "codec": info.get("codec"),
        "resolution": info.get("resolution"),
    }
