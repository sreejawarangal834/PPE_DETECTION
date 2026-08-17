"""UC3 zone-wise PPE compliance schema

New tables/enums for the compliance pipeline: zones, persons (+ Re-ID gallery),
detection sessions/track segments, compliance events, daily rollups, reports,
a person-merge audit log, and zone-scoping for users.

This version follows SCHEMA_DEEP_DIVE.md (a follow-up design review), which
supersedes IMPLEMENTATION_PLAN.md §4.2 on several points — noted inline:

- `zones` gets a real UUID PK + `slug` (human id, e.g. `z-assembly`), mirroring the
  `cameras.code` pattern from 0001, instead of using the human string as the PK directly.
  `cameras.zone_id` (added here, not in the original plan, which didn't specify how
  cameras link to zones at all — the platform's own `cameras` table has no such column) is a
  UUID FK to `zones.id` accordingly.
- `persons.source` gains a third value `legacy_import` for the JSON-history sentinel person
  (see `scripts/import_json_stores.py`), plus a `status` enum (active/inactive/merged),
  `centroid_embedding`/`embedding_count` for a fast identity-resolution fast-path, and
  `merged_into_id` for the merge workflow — all needed from day one because an empty Re-ID
  gallery guarantees over-counting of distinct people early on (§1.6/§1.7 of the deep-dive).
- `track_segments` uses `UNIQUE (session_id, loop_index, track_id)`, not
  `UNIQUE (session_id, track_id)` as the plan originally specified — `PPE_LOOP_VIDEO`
  defaults to true and looping resets ByteTrack's track-id numbering, so a bare
  `(session_id, track_id)` unique constraint throws on the second loop of any demo video.
- `users.zone_ids` (a plan-specified plain array column) is replaced by a `user_zones`
  junction table — an array column can't be FK-checked (a deleted zone would leave a
  dangling id silently) and zone-scoping is a many-to-many relationship, not a scalar list.
- CHECK constraints enforce `ended_at >= started_at` / `last_frame_at >= first_frame_at` on
  every interval-shaped table, so a monotonic/wall-clock mixup fails loudly at insert time
  instead of silently corrupting duration averages later.
- `compliance_reports.status` is a `VARCHAR` + `CHECK`, not a Postgres ENUM — job-lifecycle
  states are expected to churn during Phase 3 implementation and a CHECK is a plain
  `ALTER TABLE`, unlike `ALTER TYPE ... ADD VALUE`.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-17

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def _require_pgvector_hnsw_support() -> None:
    """HNSW indexes require pgvector >= 0.5.0 — fail loudly here instead of letting
    `CREATE INDEX ... USING hnsw` raise a cryptic 'access method "hnsw" does not exist'."""
    bind = op.get_bind()
    version = bind.exec_driver_sql(
        "SELECT extversion FROM pg_extension WHERE extname = 'vector'"
    ).scalar()
    if version is None:
        raise RuntimeError("pgvector extension is not installed (expected from 0001).")
    parts = tuple(int(p) for p in version.split(".")[:3])
    if parts < (0, 5, 0):
        raise RuntimeError(
            f"pgvector {version} is installed but HNSW indexes require >= 0.5.0. "
            "Upgrade the postgres image (pgvector/pgvector:pg16 ships a recent version)."
        )


def upgrade() -> None:
    _require_pgvector_hnsw_support()

    op.execute("CREATE TYPE ppe_type AS ENUM "
               "('helmet', 'vest', 'gloves', 'safety_shoes', 'mask', 'eye_prot')")
    op.execute("CREATE TYPE compliance_state AS ENUM ('compliant', 'violation', 'partial')")
    op.execute("CREATE TYPE person_source AS ENUM ('enrolled', 'auto_discovered', 'legacy_import')")
    op.execute("CREATE TYPE person_status AS ENUM ('active', 'inactive', 'merged')")
    op.execute("CREATE TYPE embedding_source AS ENUM "
               "('enrollment', 'track_aggregate', 'track_probe', 'manual')")
    op.execute("CREATE TYPE session_kind AS ENUM ('upload', 'webcam', 'rtsp')")

    # ── zones ──────────────────────────────────────────────────────────────────
    op.create_table(
        "zones",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column(
            "required_ppe",
            sa.dialects.postgresql.ARRAY(
                sa.dialects.postgresql.ENUM(
                    "helmet", "vest", "gloves", "safety_shoes", "mask", "eye_prot",
                    name="ppe_type", create_type=False,
                )
            ),
            nullable=False, server_default="{}",
        ),
        sa.Column("layout", JSONB, nullable=True),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_zones_slug", "zones", ["slug"])

    # cameras <-> zones — the platform's own `cameras` table has no zone concept at all.
    op.add_column("cameras", sa.Column("zone_id", UUID, sa.ForeignKey("zones.id", ondelete="SET NULL"), nullable=True))
    op.create_index("idx_cameras_zone", "cameras", ["zone_id"])

    # ── persons (Re-ID identity) ──────────────────────────────────────────────
    op.create_table(
        "persons",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("label", sa.String(64), nullable=False, unique=True),
        sa.Column("employee_id", sa.String(64), nullable=True, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("department", sa.String(255), nullable=True),
        sa.Column(
            "source",
            sa.dialects.postgresql.ENUM(
                "enrolled", "auto_discovered", "legacy_import", name="person_source", create_type=False,
            ),
            nullable=False, server_default="auto_discovered",
        ),
        sa.Column(
            "status",
            sa.dialects.postgresql.ENUM("active", "inactive", "merged", name="person_status", create_type=False),
            nullable=False, server_default="active",
        ),
        sa.Column("centroid_embedding", sa.Text, nullable=True),  # cast to vector(512) below
        sa.Column("embedding_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("merged_into_id", UUID, sa.ForeignKey("persons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    # sa has no native pgvector type without the optional `pgvector` python package
    # (not installed — see IMPLEMENTATION_PLAN.md §1.6 on keeping dependencies minimal
    # on this Python 3.14 box); alter the column to the real type with raw SQL instead.
    op.execute("ALTER TABLE persons ALTER COLUMN centroid_embedding TYPE vector(512) USING NULL")
    op.create_index("idx_persons_label", "persons", ["label"])

    # ── detection_sessions ────────────────────────────────────────────────────
    op.create_table(
        "detection_sessions",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("camera_id", UUID, sa.ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "source_kind",
            sa.dialects.postgresql.ENUM("upload", "webcam", "rtsp", name="session_kind", create_type=False),
            nullable=False,
        ),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("frames_processed", sa.Integer, nullable=False, server_default="0"),
        sa.CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ck_sessions_time_order"),
    )
    op.create_index("idx_detection_sessions_camera", "detection_sessions", ["camera_id"])

    # ── track_segments ────────────────────────────────────────────────────────
    op.create_table(
        "track_segments",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("session_id", UUID, sa.ForeignKey("detection_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("track_id", sa.Integer, nullable=False),
        # Fixes a real bug: PPE_LOOP_VIDEO defaults True and ByteTrack track-ids recur on
        # every loop restart, so (session_id, track_id) alone collides on the 2nd loop.
        sa.Column("loop_index", sa.Integer, nullable=False, server_default="0"),
        sa.Column("person_id", UUID, sa.ForeignKey("persons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("first_frame_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("last_frame_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("frame_count", sa.Integer, nullable=False, server_default="0"),
        sa.UniqueConstraint("session_id", "loop_index", "track_id", name="uq_track_segments_session_loop_track"),
        sa.CheckConstraint("last_frame_at >= first_frame_at", name="ck_track_segments_time_order"),
    )
    op.create_index("idx_track_segments_person", "track_segments", ["person_id"])

    # ── person_embeddings (Re-ID gallery) ────────────────────────────────────
    op.create_table(
        "person_embeddings",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("person_id", UUID, sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", sa.Text, nullable=False),  # cast to vector(512) below
        sa.Column("quality", sa.Float, nullable=False),
        sa.Column("sharpness", sa.Float, nullable=True),
        sa.Column(
            "source",
            sa.dialects.postgresql.ENUM(
                "enrollment", "track_aggregate", "track_probe", "manual", name="embedding_source", create_type=False,
            ),
            nullable=False, server_default="track_probe",
        ),
        sa.Column("is_centroid", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("camera_id", UUID, sa.ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True),
        sa.Column("track_segment_id", UUID, sa.ForeignKey("track_segments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.execute("ALTER TABLE person_embeddings ALTER COLUMN embedding TYPE vector(512) USING NULL")
    op.create_index("idx_person_embeddings_quality", "person_embeddings", ["person_id", "quality"])

    # ── compliance_events ─────────────────────────────────────────────────────
    op.create_table(
        "compliance_events",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("person_id", UUID, sa.ForeignKey("persons.id", ondelete="SET NULL"), nullable=True),
        sa.Column("track_segment_id", UUID, sa.ForeignKey("track_segments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("camera_id", UUID, sa.ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True),
        sa.Column("zone_id", UUID, sa.ForeignKey("zones.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "ppe_type",
            sa.dialects.postgresql.ENUM(
                "helmet", "vest", "gloves", "safety_shoes", "mask", "eye_prot", name="ppe_type", create_type=False,
            ),
            nullable=False,
        ),
        sa.Column(
            "state",
            sa.dialects.postgresql.ENUM("compliant", "violation", "partial", name="compliance_state", create_type=False),
            nullable=False,
        ),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_seconds", sa.Float, nullable=True),
        sa.Column("alert_id", UUID, sa.ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("frame_reference", sa.String(512), nullable=True),
        sa.CheckConstraint("ended_at IS NULL OR ended_at >= started_at", name="ck_compliance_events_time_order"),
    )
    op.create_index("idx_compliance_events_person_time", "compliance_events", ["person_id", sa.text("started_at DESC")])
    op.create_index("idx_compliance_events_zone_time", "compliance_events", ["zone_id", sa.text("started_at DESC")])
    op.create_index("idx_compliance_events_ppe_time", "compliance_events", ["ppe_type", sa.text("started_at DESC")])
    op.create_index("idx_compliance_events_state_time", "compliance_events", ["state", sa.text("started_at DESC")])

    # ── person_daily_compliance (rollup for trend queries) ───────────────────
    op.create_table(
        "person_daily_compliance",
        sa.Column("person_id", UUID, sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day", sa.Date, nullable=False),
        sa.Column("zone_id", UUID, sa.ForeignKey("zones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("violation_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("compliant_seconds", sa.Float, nullable=False, server_default="0"),
        sa.Column("violation_seconds", sa.Float, nullable=False, server_default="0"),
        sa.Column("compliance_rate", sa.Float, nullable=True),
        sa.PrimaryKeyConstraint("person_id", "day", "zone_id", name="pk_person_daily_compliance"),
    )

    # ── compliance_reports ────────────────────────────────────────────────────
    op.create_table(
        "compliance_reports",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("params", JSONB, nullable=False, server_default="{}"),
        sa.Column("generated_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("file_reference", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "status IN ('pending','running','ready','failed','expired')", name="ck_compliance_reports_status"
        ),
    )

    # ── person_merge_log — the merge/de-fragmentation workflow (needed from day one,
    # not as a Phase-2 follow-up: an empty Re-ID gallery guarantees early over-counting) ──
    op.create_table(
        "person_merge_log",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("source_person_id", UUID, nullable=False),  # no FK: source row is gone post-merge
        sa.Column("target_person_id", UUID, sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=False),
        sa.Column("performed_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("embeddings_moved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("events_moved", sa.Integer, nullable=False, server_default="0"),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("snapshot", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── user_zones — zone-scoping junction table (replaces a plan-specified plain
    # users.zone_ids array column — see module docstring) ───────────────────────
    op.create_table(
        "user_zones",
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("zone_id", UUID, sa.ForeignKey("zones.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("user_id", "zone_id", name="pk_user_zones"),
    )
    op.create_index("idx_user_zones_zone", "user_zones", ["zone_id"])

    # ── vector ANN indexes (guarded above; pgvector op classes require the extension) ──
    op.execute(
        "CREATE INDEX idx_person_embeddings_hnsw ON person_embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )
    op.execute(
        "CREATE INDEX idx_persons_centroid_hnsw ON persons "
        "USING hnsw (centroid_embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_persons_centroid_hnsw")
    op.execute("DROP INDEX IF EXISTS idx_person_embeddings_hnsw")

    op.drop_table("user_zones")
    op.drop_table("person_merge_log")
    op.drop_table("compliance_reports")
    op.drop_table("person_daily_compliance")
    op.drop_table("compliance_events")
    op.drop_table("person_embeddings")
    op.drop_table("track_segments")
    op.drop_table("detection_sessions")
    op.drop_table("persons")

    op.drop_index("idx_cameras_zone", table_name="cameras")
    op.drop_column("cameras", "zone_id")

    op.drop_table("zones")

    for enum in ["session_kind", "embedding_source", "person_status", "person_source",
                 "compliance_state", "ppe_type"]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")
