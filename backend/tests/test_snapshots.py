"""Unit tests for snapshots.py's platform-integration additions this session:
MinIO upload/object-key convention, bucket lifecycle policy, and local-disk
retention cleanup."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import numpy as np
from minio.commonconfig import ENABLED, Filter
from minio.lifecycleconfig import Expiration, LifecycleConfig, Rule

import snapshots


def test_minio_object_key_convention():
    when = datetime(2026, 1, 15, tzinfo=timezone.utc)
    assert snapshots.minio_object_key("evt-123", when) == "uc3/alerts/2026-01-15/evt-123.jpg"


def test_minio_object_key_defaults_to_today():
    key = snapshots.minio_object_key("evt-456")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    assert key == f"uc3/alerts/{today}/evt-456.jpg"


class _FakeMinioClient:
    def __init__(self, existing_lifecycle=None):
        self.put_calls: list[tuple] = []
        self.lifecycle_config: LifecycleConfig | None = existing_lifecycle

    def put_object(self, bucket, key, stream, length, content_type):
        self.put_calls.append((bucket, key, length, content_type))

    def get_bucket_lifecycle(self, bucket):
        if self.lifecycle_config is None:
            from minio.error import S3Error
            raise S3Error("NoSuchLifecycleConfiguration", "No lifecycle", "resource", "request_id", "host_id", None)
        return self.lifecycle_config

    def set_bucket_lifecycle(self, bucket, config):
        self.lifecycle_config = config


def test_apply_lifecycle_policy_preserves_other_rules():
    existing_rule = Rule(
        ENABLED,
        rule_filter=Filter(prefix="uc1/alerts/"),
        rule_id="uc1-retention",
        expiration=Expiration(days=30),
    )
    fake_client = _FakeMinioClient(existing_lifecycle=LifecycleConfig([existing_rule]))

    snapshots._apply_lifecycle_policy(fake_client)

    assert fake_client.lifecycle_config is not None
    rules = fake_client.lifecycle_config.rules
    assert len(rules) == 2
    rule_ids = [getattr(r, "rule_id", getattr(r, "id", None)) for r in rules]
    assert "uc1-retention" in rule_ids
    assert "uc3-snapshot-retention" in rule_ids

    uc3_rule = next(r for r in rules if getattr(r, "rule_id", getattr(r, "id", None)) == "uc3-snapshot-retention")
    rule_filter = getattr(uc3_rule, "rule_filter", getattr(uc3_rule, "element_filter", None))
    assert rule_filter.prefix == "uc3/alerts/"


def test_upload_to_minio_encodes_and_uploads(monkeypatch):
    fake_client = _FakeMinioClient()
    monkeypatch.setattr(snapshots, "_get_minio_client", lambda: fake_client)

    frame = (np.random.rand(16, 16, 3) * 255).astype(np.uint8)
    ok = snapshots.upload_to_minio(frame, "uc3/alerts/2026-01-01/evt-1.jpg")

    assert ok is True
    assert len(fake_client.put_calls) == 1
    bucket, key, length, content_type = fake_client.put_calls[0]
    assert key == "uc3/alerts/2026-01-01/evt-1.jpg"
    assert content_type == "image/jpeg"
    assert length > 0


def test_upload_to_minio_returns_false_on_client_error(monkeypatch):
    def _raise():
        raise RuntimeError("connection refused")

    monkeypatch.setattr(snapshots, "_get_minio_client", _raise)
    frame = (np.random.rand(8, 8, 3) * 255).astype(np.uint8)

    assert snapshots.upload_to_minio(frame, "some/key.jpg") is False


def test_delete_expired_local_snapshots_removes_only_old_dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(snapshots, "SNAPSHOT_DIR", tmp_path)

    old_day = (datetime.now(timezone.utc) - timedelta(days=200)).strftime("%Y-%m-%d")
    recent_day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for day in (old_day, recent_day):
        d = tmp_path / day
        d.mkdir()
        (d / "evt.jpg").write_bytes(b"fake-jpeg-bytes")

    removed = snapshots._delete_expired_local_snapshots(retention_days=90)

    assert removed == 1
    assert not (tmp_path / old_day).exists()
    assert (tmp_path / recent_day).exists()


def test_delete_expired_local_snapshots_ignores_non_date_entries(tmp_path, monkeypatch):
    monkeypatch.setattr(snapshots, "SNAPSHOT_DIR", tmp_path)
    (tmp_path / "not-a-date-dir").mkdir()
    (tmp_path / "somefile.txt").write_text("x")

    removed = snapshots._delete_expired_local_snapshots(retention_days=0)

    assert removed == 0
    assert (tmp_path / "not-a-date-dir").exists()


def test_delete_expired_local_snapshots_missing_dir_is_noop(tmp_path, monkeypatch):
    monkeypatch.setattr(snapshots, "SNAPSHOT_DIR", tmp_path / "does-not-exist")
    assert snapshots._delete_expired_local_snapshots(90) == 0
