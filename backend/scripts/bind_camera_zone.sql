-- Idempotent SQL script to insert 'construction-site' zone policy and bind camera '00000000-0000-0000-0000-000000000003' to it.

INSERT INTO zones (slug, name, description, required_ppe, active)
VALUES ('construction-site', 'Construction site', 'Helmet, vest, gloves, safety shoes',
        ARRAY['helmet','vest','gloves','safety_shoes']::ppe_type[], true)
ON CONFLICT (slug) DO NOTHING;

UPDATE cameras SET zone_id = (SELECT id FROM zones WHERE slug='construction-site')
WHERE code = '00000000-0000-0000-0000-000000000003';
