"""password reset tokens

Backs a real POST /api/auth/forgot-password / POST /api/auth/reset-password, replacing
src/features/auth/ForgotPasswordPage.tsx / ResetPasswordPage.tsx's dead-end forms (found
during a fake-frontend audit — those pages called an authApi.ts function that always threw
"not implemented"). Mirrors the `sessions` table's own pattern from 0001 exactly: only a
SHA-256 hash of the opaque token is ever stored, never the token itself.

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-17

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", UUID, primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", UUID, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_password_reset_user", "password_reset_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_table("password_reset_tokens")
