"""
Password hashing + JWT/refresh-token primitives.

argon2id, not bcrypt (SCHEMA_DEEP_DIVE.md §2): bcrypt silently truncates input at 72 bytes,
and the common Python bcrypt-wrapping libraries have had maintenance/compatibility churn with
newer bcrypt releases. argon2's encoded hash fits the existing `users.password_hash
VARCHAR(255)` column.

argon2 verification costs ~50-100ms of CPU (time_cost=3, memory_cost=64MB, parallelism=4) —
run via `asyncio.to_thread` so a login request doesn't stall the event loop and every other
connected WebSocket session with it (same class of hazard as repositories/writer.py's, same
fix: never block the loop).

Refresh tokens are opaque random strings (NOT JWTs) — only their SHA-256 hash is ever stored
(in `sessions.refresh_token_hash`), so a leaked database dump doesn't hand out usable tokens.
Access tokens are short-lived JWTs (HS256) carrying user id/role/email so `require_role()`
never needs a DB round trip on the hot path of every request.
"""

from __future__ import annotations

import asyncio
import hashlib
import secrets
import time
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError

from config import JWT_ACCESS_TTL_SECONDS, JWT_SECRET

_ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4)


def _hash_sync(password: str) -> str:
    return _ph.hash(password)


def _verify_sync(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    except Exception:
        # A hash from a different scheme entirely (e.g. the platform's invalid
        # placeholder string) would raise here, not just return False —
        # treat any unexpected error as "does not verify", never as a crash.
        return False


async def hash_password(password: str) -> str:
    return await asyncio.to_thread(_hash_sync, password)


async def verify_password(password_hash: str, password: str) -> bool:
    return await asyncio.to_thread(_verify_sync, password_hash, password)


def new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_access_token(user_id: str, role: str, email: str) -> str:
    now = int(time.time())
    payload = {"sub": user_id, "role": role, "email": email, "iat": now, "exp": now + JWT_ACCESS_TTL_SECONDS}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
