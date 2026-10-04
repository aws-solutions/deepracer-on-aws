# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: Apache-2.0

import json

import boto3
import pytest
from moto import mock_aws

from car_log_video_processor import main

JOB_ID = "abcdefghij12345"
MODEL_A = "AAAAAAAAAAAAAAA"
MODEL_B = "BBBBBBBBBBBBBBB"
BAG_A = f"r_m_{MODEL_A}-20250101-100000"
BAG_B = f"r_n_{MODEL_B}-20250101-110000"
SETTINGS = {"codec": "avc1", "frame_limit": None, "describe": False, "relative_labels": False, "skip_duration": 20.0}


def bag(bag_dir, model_id, artifact=True):
    return {
        "bagDir": bag_dir,
        "bagPrefix": f"carlogs/p1/bags/{bag_dir}/",
        "profileId": "p1",
        "racerName": "Racer1",
        "modelId": model_id,
        "modelName": "model",
        "assetType": "BAG_SQLITE",
        **({"modelArtifactKey": f"models/{model_id}.tar.gz"} if artifact else {}),
        "videoKey": f"carlogs/p1/videos/{bag_dir}.mp4",
    }


@pytest.fixture
def s3(tmp_path, monkeypatch):
    with mock_aws():
        client = boto3.client("s3")
        client.create_bucket(Bucket="car-logs")
        client.create_bucket(Bucket="car-models")
        monkeypatch.setattr(main, "s3", client)
        monkeypatch.setattr(main, "WORK_DIR", tmp_path)
        yield client


def put_config(s3, bags, **extra):
    config = {"jobId": JOB_ID, "bucket": "car-logs", "modelBucket": "car-models", "bags": bags, **extra}
    s3.put_object(Bucket="car-logs", Key=f"job-configs/{JOB_ID}.json", Body=json.dumps(config).encode())
    for model_id in (MODEL_A, MODEL_B):
        s3.put_object(Bucket="car-models", Key=f"models/{model_id}.tar.gz", Body=b"model")
    for item in bags:
        s3.put_object(Bucket="car-logs", Key=f"{item['bagPrefix']}metadata.yaml", Body=b"x")
        s3.put_object(Bucket="car-logs", Key=f"{item['bagPrefix']}../evil", Body=b"x")


def result(s3):
    return json.loads(s3.get_object(Bucket="car-logs", Key=f"results/{JOB_ID}.json")["Body"].read())


def test_run_creates_one_video_per_group_and_reports_failures(s3, monkeypatch, tmp_path):
    put_config(s3, [bag(BAG_A, MODEL_A), bag(BAG_B, MODEL_B, artifact=False)])
    analysed = []

    def fake_analyse(config, item, model_path, settings):
        analysed.append((item.bag_dir, model_path.read_bytes()))
        video = tmp_path / f"{item.bag_dir}.mp4"
        video.write_bytes(b"video")
        return video

    monkeypatch.setattr(main, "analyse_bag", fake_analyse)
    monkeypatch.setattr(
        main,
        "combine_group",
        lambda config, group, settings: {"duration": 30.0, "fps": 15.0, "codec": "avc1", "resolution": "1x1"},
    )

    main.run(JOB_ID, "car-logs", f"job-configs/{JOB_ID}.json", f"results/{JOB_ID}.json", SETTINGS)

    assert analysed == [(BAG_A, b"model")]
    assert result(s3) == {
        "jobId": JOB_ID,
        "videos": [
            {
                "bagDirs": [BAG_A],
                "videoKey": f"carlogs/p1/videos/{BAG_A}.mp4",
                "durationSeconds": 30.0,
                "fps": 15.0,
                "codec": "avc1",
                "resolution": "1x1",
            }
        ],
        "failures": [{"bagDir": BAG_B, "reason": "The model or log could not be processed."}],
    }


def test_run_reports_bags_whose_analysis_failed(s3, monkeypatch):
    put_config(s3, [bag(BAG_A, MODEL_A)])
    monkeypatch.setattr(main, "analyse_bag", lambda *args: None)

    main.run(JOB_ID, "car-logs", f"job-configs/{JOB_ID}.json", f"results/{JOB_ID}.json", SETTINGS)

    assert result(s3) == {
        "jobId": JOB_ID,
        "videos": [],
        "failures": [{"bagDir": BAG_A, "reason": "The log could not be analysed."}],
    }


def test_run_reports_groups_that_could_not_be_combined(s3, monkeypatch, tmp_path):
    put_config(s3, [bag(BAG_A, MODEL_A)])
    monkeypatch.setattr(main, "analyse_bag", lambda *args: tmp_path / "x.mp4")
    monkeypatch.setattr(main, "combine_group", lambda *args: None)

    main.run(JOB_ID, "car-logs", f"job-configs/{JOB_ID}.json", f"results/{JOB_ID}.json", SETTINGS)

    assert result(s3)["failures"] == [{"bagDir": BAG_A, "reason": "No video could be created."}]


def test_run_rejects_config_of_another_job(s3):
    put_config(s3, [bag(BAG_A, MODEL_A)])

    with pytest.raises(ValueError, match="does not belong"):
        main.run("otherjob1234567", "car-logs", f"job-configs/{JOB_ID}.json", "results/x.json", SETTINGS)


def test_download_prefix_skips_keys_leaving_the_target(s3, tmp_path):
    put_config(s3, [bag(BAG_A, MODEL_A)])
    target = tmp_path / "bag"

    main.download_prefix("car-logs", f"carlogs/p1/bags/{BAG_A}/", target)

    assert [p.name for p in target.rglob("*") if p.is_file()] == ["metadata.yaml"]
    assert not (tmp_path / "evil").exists()


def test_main_reads_settings_from_the_environment(monkeypatch):
    calls = []
    monkeypatch.setattr(main, "run", lambda *args: calls.append(args))
    monkeypatch.setenv("JOB_ID", JOB_ID)
    monkeypatch.setenv("BUCKET", "car-logs")
    monkeypatch.setenv("SKIP_DURATION", "5")
    monkeypatch.setenv("DESCRIBE", "true")

    main.main()

    job_id, bucket, config_key, result_key, settings = calls[0]
    assert (job_id, bucket) == (JOB_ID, "car-logs")
    assert config_key == f"job-configs/{JOB_ID}.json"
    assert result_key == f"results/{JOB_ID}.json"
    assert settings["skip_duration"] == 5.0
    assert settings["describe"] is True


def test_analyse_bag_runs_the_analysis_in_a_subprocess_and_cleans_up(s3, monkeypatch, tmp_path):
    put_config(s3, [bag(BAG_A, MODEL_A)])
    config = main.parse_config(
        json.loads(s3.get_object(Bucket="car-logs", Key=f"job-configs/{JOB_ID}.json")["Body"].read())
    )
    commands = []

    def fake_run(cmd, **kwargs):
        commands.append(cmd)
        assert (tmp_path / "input" / BAG_A / "metadata.yaml").is_file()
        (tmp_path / "intermediate" / f"{BAG_A}.mp4").write_bytes(b"video")
        return type("Result", (), {"returncode": 0})()

    monkeypatch.setattr(main.subprocess, "run", fake_run)

    video = main.analyse_bag(
        config, config.bags[0], tmp_path / "m.tar.gz", {**SETTINGS, "frame_limit": "100", "describe": True}
    )

    assert video == tmp_path / "intermediate" / f"{BAG_A}.mp4"
    assert "--frame_limit" in commands[0]
    assert "--describe" in commands[0]
    assert not (tmp_path / "input" / BAG_A).exists()


def test_analyse_bag_returns_nothing_when_the_analysis_fails(s3, monkeypatch, tmp_path):
    put_config(s3, [bag(BAG_A, MODEL_A)])
    config = main.parse_config(
        json.loads(s3.get_object(Bucket="car-logs", Key=f"job-configs/{JOB_ID}.json")["Body"].read())
    )
    monkeypatch.setattr(main.subprocess, "run", lambda cmd, **kwargs: type("Result", (), {"returncode": 1})())

    assert main.analyse_bag(config, config.bags[0], tmp_path / "m.tar.gz", SETTINGS) is None
