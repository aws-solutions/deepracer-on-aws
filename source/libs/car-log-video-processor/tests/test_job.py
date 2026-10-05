# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import pytest

from car_log_video_processor.job import (
    Bag,
    build_manifest,
    group_bags,
    manifest_video,
    parse_config,
    race_data,
)

MODEL_A = "AAAAAAAAAAAAAAA"
MODEL_B = "BBBBBBBBBBBBBBB"


def raw_bag(bag_dir, profile_id="p1", model_id=MODEL_A, racer="Racer1", model="modelA"):
    return {
        "bagDir": bag_dir,
        "bagPrefix": f"carlogs/{profile_id}/bags/{bag_dir}/",
        "profileId": profile_id,
        "racerName": racer,
        "modelId": model_id,
        "modelName": model,
        "assetType": "BAG_SQLITE",
        "modelArtifactKey": f"models/{model_id}/pb-only-model.tar.gz",
        "videoKey": f"carlogs/{profile_id}/videos/{bag_dir}.mp4",
    }


def raw_config(bags, **extra):
    return {"jobId": "job1", "bucket": "logs", "modelBucket": "models", "bags": bags, **extra}


def test_parse_config_reads_bags_and_context():
    config = parse_config(raw_config([raw_bag("a_b_AAAAAAAAAAAAAAA-20250101-101010")], carName="car", eventName="ev"))

    assert config.car_name == "car"
    assert config.event_name == "ev"
    assert config.bags[0].model_artifact_key == f"models/{MODEL_A}/pb-only-model.tar.gz"
    assert config.bags[0].timestamp == "20250101-101010"
    assert config.bags[0].date == "20250101"


@pytest.mark.parametrize(
    "raw",
    [
        None,
        {"jobId": "job1"},
        {"jobId": "job1", "bucket": "logs", "bags": []},
        raw_config([{"bagDir": "x"}]),
        raw_config(["nope"]),
    ],
)
def test_parse_config_rejects_malformed_config(raw):
    with pytest.raises(ValueError):
        parse_config(raw)


def test_bag_without_timestamp_has_empty_date():
    bag = Bag("weird", "p/", "p1", MODEL_A, "k")

    assert bag.timestamp == ""
    assert bag.date == ""


def test_groups_per_racer_model_and_day_without_race():
    config = parse_config(
        raw_config(
            [
                raw_bag(f"r_m_{MODEL_A}-20250101-120000"),
                raw_bag(f"r_m_{MODEL_A}-20250101-100000"),
                raw_bag(f"r_m_{MODEL_A}-20250102-100000"),
                raw_bag(f"r_n_{MODEL_B}-20250101-100000", model_id=MODEL_B),
                raw_bag(f"o_m_{MODEL_A}-20250101-100000", profile_id="p2", racer="Racer2"),
            ]
        )
    )

    groups = group_bags(config, config.bags)

    assert [g.bag_dirs for g in groups] == [
        [f"o_m_{MODEL_A}-20250101-100000"],
        [f"r_m_{MODEL_A}-20250101-100000", f"r_m_{MODEL_A}-20250101-120000"],
        [f"r_n_{MODEL_B}-20250101-100000"],
        [f"r_m_{MODEL_A}-20250102-100000"],
    ]
    assert groups[1].video_key == f"carlogs/p1/videos/r_m_{MODEL_A}-20250101-100000.mp4"
    assert all(not g.with_race for g in groups)
    assert all(len({b.profile_id for b in g.bags}) == 1 for g in groups)


def test_race_jobs_put_all_bags_of_the_racer_in_one_video():
    config = parse_config(
        raw_config(
            [
                raw_bag(f"r_m_{MODEL_A}-20250101-100000"),
                raw_bag(f"r_n_{MODEL_B}-20250102-100000", model_id=MODEL_B, model="modelB"),
                raw_bag(f"o_m_{MODEL_A}-20250101-100000", profile_id="p2", racer="Racer2"),
            ],
            race={"runId": "run1", "racerName": "Racer1", "laps": []},
        )
    )

    groups = group_bags(config, config.bags)

    race_group = next(g for g in groups if g.profile_id == "p1")
    assert race_group.with_race
    assert len(race_group.bags) == 2
    assert race_group.models == [
        {"modelId": MODEL_A, "modelName": "modelA"},
        {"modelId": MODEL_B, "modelName": "modelB"},
    ]
    other = next(g for g in groups if g.profile_id == "p2")
    assert not other.with_race


def test_race_without_racer_applies_to_everyone():
    config = parse_config(raw_config([raw_bag(f"r_m_{MODEL_A}-20250101-100000")], race={"runId": "run1", "laps": []}))

    assert group_bags(config, config.bags)[0].with_race


def test_race_data_converts_laps_for_the_renderer():
    config = parse_config(
        raw_config(
            [raw_bag(f"r_m_{MODEL_A}-20250101-100000")],
            race={
                "runId": "run1",
                "racerName": "Racer1",
                "trackName": "Track",
                "laps": [
                    {"lapNumber": 1, "lapTimeMs": 9000, "isValid": True, "resets": 2},
                    {"lapNumber": 2, "lapTimeMs": 8000, "isValid": False},
                ],
            },
        )
    )
    group = group_bags(config, config.bags)[0]

    assert race_data(config, group) == {
        "trackName": "Track",
        "username": "Racer1",
        "laps": [
            {"lapId": 0, "time": 9000, "isValid": True, "resets": 2},
            {"lapId": 1, "time": 8000, "isValid": False, "resets": 0},
        ],
    }


def test_race_data_is_absent_outside_races():
    config = parse_config(raw_config([raw_bag(f"r_m_{MODEL_A}-20250101-100000")]))

    assert race_data(config, group_bags(config, config.bags)[0]) is None


def test_manifest_matches_the_contract_of_the_lambda():
    config = parse_config(raw_config([raw_bag(f"r_m_{MODEL_A}-20250101-100000")]))
    group = group_bags(config, config.bags)[0]

    video = manifest_video(group, {"duration": 61.5, "fps": 15.0, "codec": "avc1", "resolution": "1280x720"})

    assert build_manifest("job1", [video], [{"bagDir": "x", "reason": "r"}]) == {
        "jobId": "job1",
        "videos": [
            {
                "bagDirs": [f"r_m_{MODEL_A}-20250101-100000"],
                "videoKey": f"carlogs/p1/videos/r_m_{MODEL_A}-20250101-100000.mp4",
                "durationSeconds": 61.5,
                "fps": 15.0,
                "codec": "avc1",
                "resolution": "1280x720",
            }
        ],
        "failures": [{"bagDir": "x", "reason": "r"}],
    }
