"""Idempotent script to insert construction-site zone and bind camera 00000000-0000-0000-0000-000000000003."""

import asyncio
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import asyncpg
from config import DATABASE_URL

SQL = """
INSERT INTO zones (slug, name, description, required_ppe, active)
VALUES ('construction-site', 'Construction site', 'Helmet, vest, gloves, safety shoes',
        ARRAY['helmet','vest','gloves','safety_shoes']::ppe_type[], true)
ON CONFLICT (slug) DO NOTHING;

UPDATE cameras SET zone_id = (SELECT id FROM zones WHERE slug='construction-site')
WHERE code = '00000000-0000-0000-0000-000000000003';
"""


async def main():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(SQL)
        print("Successfully bound camera 00000000-0000-0000-0000-000000000003 to construction-site zone.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
