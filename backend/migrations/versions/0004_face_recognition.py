"""face recognition: face_embeddings gallery + identity_tag on compliance_events

WHY THIS MIGRATION EXISTS
--------------------------
face/resolver.py needs somewhere to store face embeddings and match against
them, and repositories/writer.py needs somewhere to record which identity
(if any) a violation was attributed to.

Design notes
------------
- No new `enrolled_persons`/global-identity table — `persons` (0002) is
  reused as-is. A face embedding is just another embedding *source* for the
  same global identity body Re-ID already resolves against; introducing a
  second identity table would fragment one person's history across two
  unrelated tables instead of converging on one global ID. See
  face/resolver.py's module docstring.
- `face_embeddings` is a SEPARATE table from `person_embeddings`, not a
  shared one, even though both store 512-d vectors: cosine similarity
  between a body (OSNet) vector and a face (ArcFace) vector is meaningless
  despite the matching dimensionality, so the two galleries must never be
  compared against each other in one KNN query.
- `person_id` is nullable — an unmatched ("unknown") face-resolution
  attempt still gets logged (useful for later enrollment review), but is
  excluded from the KNN match query itself (see face/resolver.py) so two
  different unmatched strangers can never spuriously match each other.
- `embedding`/`centroid_embedding`-style columns in this codebase are
  created as `sa.Text` and then ALTERed to `vector(512)` via raw SQL,
  matching 0002_uc3_compliance.py's own established pattern (the optional
  `pgvector` python package isn't installed here — see that migration's
  docstring on keeping dependencies minimal).
- `identity_tag` enum lives on `compliance_events` (not a separate
  per-attempt audit table) for this increment: 'enrolled' / 'visitor' /
  'unknown', matching face/resolver.py's three-way outcome. A full
  per-attempt audit log (mirroring a `face_recognition_events` table) is a
  reasonable future addition, not required to satisfy "tag the violation
  with the global ID."

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-28

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE identity_tag AS ENUM ('enrolled', 'visitor', 'unknown')")

    # ── face_embeddings (face Re-ID gallery) ──────────────────────────────────
    op.create_table(
        "face_embeddings",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("person_id", UUID, sa.ForeignKey("persons.id", ondelete="CASCADE"), nullable=True),
        sa.Column("embedding", sa.Text, nullable=False),  # cast to vector(512) below
        sa.Column("quality", sa.Float, nullable=False),
        sa.Column("is_enrollment", sa.Boolean, nullable=False, server_default=sa.text("false")),
        sa.Column("source_camera_id", UUID, sa.ForeignKey("cameras.id", ondelete="SET NULL"), nullable=True),
        sa.Column("track_segment_id", UUID, sa.ForeignKey("track_segments.id", ondelete="SET NULL"), nullable=True),
        sa.Column("refined_face_bbox", JSONB, nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("quality >= 0 AND quality <= 1", name="ck_face_embeddings_quality_range"),
    )
    op.execute("ALTER TABLE face_embeddings ALTER COLUMN embedding TYPE vector(512) USING NULL")
    op.create_index("idx_face_embeddings_person", "face_embeddings", ["person_id", "quality"])
    op.execute(
        "CREATE INDEX idx_face_embeddings_hnsw ON face_embeddings "
        "USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64)"
    )

    # ── identity tagging on compliance_events ─────────────────────────────────
    op.add_column(
        "compliance_events",
        sa.Column("identity_tag", sa.dialects.postgresql.ENUM("enrolled", "visitor", "unknown", name="identity_tag", create_type=False), nullable=True),
    )
    op.add_column("compliance_events", sa.Column("identity_similarity", sa.Float, nullable=True))
    op.create_check_constraint(
        "ck_compliance_events_identity_similarity_range",
        "compliance_events",
        "identity_similarity IS NULL OR (identity_similarity >= 0 AND identity_similarity <= 1)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_compliance_events_identity_similarity_range", "compliance_events", type_="check")
    op.drop_column("compliance_events", "identity_similarity")
    op.drop_column("compliance_events", "identity_tag")

    op.execute("DROP INDEX IF EXISTS idx_face_embeddings_hnsw")
    op.drop_index("idx_face_embeddings_person", table_name="face_embeddings")
    op.drop_table("face_embeddings")

    op.execute("DROP TYPE IF EXISTS identity_tag")
