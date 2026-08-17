"""platform base schema (copied from innovision-platform, adapted for UC3)

Copied near-verbatim from innovision-platform's migrations/versions/0001_platform_base.py
(see IMPLEMENTATION_PLAN.md §1.5/§4.1 for the source and reasoning — that repo's own
Alembic cannot run as-is, so this is a one-time textual copy, never a runtime dependency).

Deviations from the platform original, all deliberate (locked decisions, §2 of the plan):

1. `operator_role` is `('admin', 'manager', 'operator', 'viewer')` — no `superadmin`.
   This app is single-tenant with a 4-tier role model (§7.3), not the platform's 5-tier one.
2. The seed user gets a real argon2id hash of `PPE_ADMIN_BOOTSTRAP_PASSWORD`, not the
   platform's placeholder string `'$2b$12$placeholder_hash_change_in_production'` — that
   string is not a valid hash of anything and would raise (not just fail) on verify().
   The migration refuses to run without that env var set, rather than shipping a guessable
   default admin password.
3. `cameras.code VARCHAR(50) UNIQUE NOT NULL` is a new column the platform lacks. The
   platform's `cameras.id` is a UUID; this app's frontend and all pre-existing JSON data use
   human ids (`CAM-01`). The UUID stays the PK for FK integrity; `code` carries the human id
   and the API layer exposes `code` as `id` to the frontend.
4. `sessions.replaced_by_id UUID` (self-referencing, SET NULL) is added up front for the
   refresh-token-rotation-with-reuse-detection design used by Phase 4 auth — cheap to add now,
   costly to retrofit onto a live `sessions` table later.
5. A case-insensitive functional unique index on `users` (`lower(email)`) is added alongside
   the platform's plain (case-sensitive) `UNIQUE` on `email`, so `Admin@x.com` and
   `admin@x.com` can't both exist as separate accounts.
6. The platform's four placeholder `cameras` seed rows (`Test Camera UC1..UC4`, tagged for
   unrelated use cases uc1/uc2/uc4 this app never implements — see §2 "Tenancy: single
   tenant") are dropped entirely rather than being force-fitted with a fabricated `code`.
   Real camera rows (`CAM-01..CAM-06`) are populated by `scripts/import_json_stores.py`
   (§4.4), which is the single source of truth for camera/zone data instead of duplicating
   it here and in the JSON import.

Revision ID: 0001
Revises:
Create Date: 2026-08-17

"""

from __future__ import annotations

import os

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID, ENUM

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute("CREATE TYPE camera_status AS ENUM ('online', 'offline', 'reconnecting', 'disabled')")
    op.execute("CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical')")
    op.execute(
        "CREATE TYPE alert_status AS ENUM "
        "('pending', 'acknowledged', 'in_progress', 'resolved', 'closed')"
    )
    op.execute(
        "CREATE TYPE incident_status AS ENUM "
        "('active', 'acknowledged', 'in_progress', 'resolved', 'closed')"
    )
    # Deviation 1: 4-tier role model, no superadmin.
    op.execute("CREATE TYPE operator_role AS ENUM ('admin', 'manager', 'operator', 'viewer')")
    op.execute("CREATE TYPE source_uc AS ENUM ('uc1', 'uc2', 'uc3', 'uc4')")

    op.create_table(
        "cameras",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        # Deviation 3: human-readable code, exposed to the frontend as `id`.
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("rtsp_url", sa.String(1024), nullable=True),
        sa.Column(
            "status",
            ENUM("online", "offline", "reconnecting", "disabled", name="camera_status", create_type=False),
            nullable=False, server_default="offline",
        ),
        sa.Column("use_cases", ARRAY(sa.String), nullable=False, server_default="{}"),
        sa.Column("fps", sa.Integer, nullable=False, server_default="10"),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_cameras_status", "cameras", ["status"])
    op.create_index("idx_cameras_code", "cameras", ["code"])

    op.create_table(
        "users",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column(
            "role",
            ENUM("admin", "manager", "operator", "viewer", name="operator_role", create_type=False),
            nullable=False, server_default="operator",
        ),
        # Left at its platform default; Phase 4 zone-scoping uses the dedicated
        # `user_zones` junction table (added in 0002) instead of repurposing this
        # camera-shaped array column for a zone-shaped concept.
        sa.Column("camera_ids", ARRAY(UUID), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_users_email", "users", ["email"])
    # Deviation 5: case-insensitive uniqueness.
    op.execute("CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email))")

    op.create_table(
        "sessions",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        # Deviation 4: refresh-token rotation chain, for reuse-detection in Phase 4.
        sa.Column("replaced_by_id", UUID, sa.ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("idx_sessions_user", "sessions", ["user_id"])
    op.create_index("idx_sessions_expires", "sessions", ["expires_at"])

    op.create_table(
        "alerts",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("alert_id", UUID, nullable=False, unique=True),
        sa.Column("camera_id", UUID, sa.ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True),
        sa.Column("source_uc", ENUM("uc1", "uc2", "uc3", "uc4", name="source_uc", create_type=False), nullable=False),
        sa.Column("alert_type", sa.String(100), nullable=False),
        sa.Column("severity", ENUM("low", "medium", "high", "critical", name="alert_severity", create_type=False), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("source_event_id", UUID, nullable=False),
        sa.Column("frame_reference", sa.String(512), nullable=True),
        sa.Column("frame_provider", sa.String(50), nullable=True),
        sa.Column(
            "status",
            ENUM("pending", "acknowledged", "in_progress", "resolved", "closed", name="alert_status", create_type=False),
            nullable=False, server_default="pending",
        ),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acknowledged_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("idx_alerts_camera_time", "alerts", ["camera_id", "created_at"])
    op.create_index("idx_alerts_status", "alerts", ["status"])
    op.create_index("idx_alerts_source_uc", "alerts", ["source_uc"])
    op.create_index("idx_alerts_severity", "alerts", ["severity"])
    op.create_index("idx_alerts_alert_id", "alerts", ["alert_id"])

    op.create_table(
        "incidents",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("alert_id", UUID, sa.ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column(
            "status",
            ENUM("active", "acknowledged", "in_progress", "resolved", "closed", name="incident_status", create_type=False),
            nullable=False, server_default="active",
        ),
        sa.Column("assigned_to", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_incidents_status", "incidents", ["status"])
    op.create_index("idx_incidents_alert", "incidents", ["alert_id"])

    op.create_table(
        "incident_timeline",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("incident_id", UUID, sa.ForeignKey("incidents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("from_status", sa.String(50), nullable=True),
        sa.Column("to_status", sa.String(50), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_incident_timeline_incident", "incident_timeline", ["incident_id"])

    op.create_table(
        "audit_log",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("service", sa.String(100), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=False),
        sa.Column("entity_id", sa.String(255), nullable=False),
        sa.Column("user_id", UUID, nullable=True),
        sa.Column("source_uc", ENUM("uc1", "uc2", "uc3", "uc4", name="source_uc", create_type=False), nullable=True),
        sa.Column("metadata", JSONB, nullable=False, server_default="{}"),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    # Append-only, enforced at the DB level — no application code path can
    # bypass this, unlike a check only in the service layer.
    op.execute("CREATE RULE audit_log_no_update AS ON UPDATE TO audit_log DO INSTEAD NOTHING")
    op.execute("CREATE RULE audit_log_no_delete AS ON DELETE TO audit_log DO INSTEAD NOTHING")
    op.create_index("idx_audit_service_time", "audit_log", ["service", "timestamp"])
    op.create_index("idx_audit_entity", "audit_log", ["entity_type", "entity_id"])

    op.create_table(
        "notification_log",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("alert_id", UUID, sa.ForeignKey("alerts.id", ondelete="SET NULL"), nullable=True),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("channel", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("error", sa.Text, nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Seed: one real admin account (Deviation 2) ────────────────────────────
    bootstrap_password = os.environ.get("PPE_ADMIN_BOOTSTRAP_PASSWORD")
    if not bootstrap_password:
        raise RuntimeError(
            "PPE_ADMIN_BOOTSTRAP_PASSWORD is not set. Refusing to seed an admin user with "
            "the platform's placeholder hash (it is not a valid hash of anything and would "
            "raise on verify()) or a guessable default. Set the env var and re-run "
            "`alembic upgrade head`."
        )
    from argon2 import PasswordHasher  # local import: only needed at migration time

    password_hash = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4).hash(bootstrap_password)
    bootstrap_email = os.environ.get("PPE_ADMIN_BOOTSTRAP_EMAIL", "admin@innovision.com")

    op.execute(
        sa.text(
            """
            INSERT INTO users (id, name, email, password_hash, role, camera_ids)
            VALUES ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Platform Admin', :email, :hash, 'admin', '{}')
            ON CONFLICT DO NOTHING
            """
        ).bindparams(email=bootstrap_email, hash=password_hash)
    )


def downgrade() -> None:
    op.drop_table("notification_log")
    op.drop_table("audit_log")
    op.drop_table("incident_timeline")
    op.drop_table("incidents")
    op.drop_table("alerts")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("cameras")

    for enum in ["source_uc", "operator_role", "incident_status", "alert_status", "alert_severity", "camera_status"]:
        op.execute(f"DROP TYPE IF EXISTS {enum}")
