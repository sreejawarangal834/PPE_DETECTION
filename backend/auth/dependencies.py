"""
FastAPI auth dependencies.

The frontend's route guards (RoleGuard/ProtectedRoute) are UX only — they hide a nav item,
nothing more. Every dependency here re-checks on the server, which is the only place this
actually matters (SCHEMA_DEEP_DIVE.md §2): an operator hitting an admin endpoint directly with
curl must get a real 403, not just a hidden button.
"""

from __future__ import annotations

from typing import Any

import jwt as pyjwt
from fastapi import Header, HTTPException

from auth.security import decode_access_token


async def get_current_user(authorization: str | None = Header(None)) -> dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[len("Bearer "):]
    try:
        payload = decode_access_token(token)
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Access token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid access token")
    return {"id": payload["sub"], "role": payload["role"], "email": payload["email"]}


def require_role(*roles: str):
    """Dependency factory — `Depends(require_role("admin"))`,
    `Depends(require_role("admin", "operator"))`, etc. Raises 403 (not 401 — the caller IS
    authenticated, just not authorized) when the current user's role isn't in the allowed set."""

    async def _dependency(authorization: str | None = Header(None)) -> dict[str, Any]:
        user = await get_current_user(authorization)
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"This action requires one of roles: {', '.join(roles)}")
        return user

    return _dependency
