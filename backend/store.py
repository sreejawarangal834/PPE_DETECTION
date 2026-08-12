"""
Lightweight JSON-file persistence for zones/cameras/alerts.

backend/ has no database dependency at all (unlike the unrelated app/
service, which owns its own SQLite file) — a full DB is disproportionate
for this small, low-write config/alert volume, so each named store is just
a JSON array of dicts under backend/data/, read on first use and rewritten
wholesale on every mutation.
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

_lock = threading.Lock()


def load(name: str, seed: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    """Load a named store, seeding it on disk the first time it's read."""
    path = DATA_DIR / f"{name}.json"
    with _lock:
        if not path.exists():
            data = list(seed) if seed is not None else []
            path.write_text(json.dumps(data, indent=2))
            return data
        return json.loads(path.read_text())


def save(name: str, data: list[dict[str, Any]]) -> None:
    path = DATA_DIR / f"{name}.json"
    with _lock:
        path.write_text(json.dumps(data, indent=2))
