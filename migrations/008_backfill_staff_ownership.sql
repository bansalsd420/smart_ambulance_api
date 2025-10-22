-- 008_backfill_staff_ownership.sql
-- Backfill hospital_id/fleet_id for existing paramedics and doctors from the linked users table.

-- Update paramedics from users, but only when referenced hospital/fleet actually exists to avoid FK errors
-- 1) Prefer hospital if users.hospital_id references an existing hospital
UPDATE paramedics p
JOIN users u ON u.id = p.user_id
JOIN hospitals h ON h.id = u.hospital_id
SET p.hospital_id = h.id,
    p.fleet_id = NULL
WHERE p.user_id IS NOT NULL AND p.id IS NOT NULL;

-- 2) For users without a valid hospital, set fleet when the referenced fleet exists
UPDATE paramedics p
JOIN users u ON u.id = p.user_id
JOIN fleets f ON f.id = u.fleet_id
SET p.fleet_id = f.id,
    p.hospital_id = NULL
WHERE p.user_id IS NOT NULL AND p.id IS NOT NULL AND (u.hospital_id IS NULL OR u.hospital_id = '');

-- Update doctors from users with same safe-checks
-- 1) Prefer hospital if users.hospital_id references an existing hospital
UPDATE doctors d
JOIN users u ON u.id = d.user_id
JOIN hospitals h ON h.id = u.hospital_id
SET d.hospital_id = h.id,
    d.fleet_id = NULL
WHERE d.user_id IS NOT NULL AND d.id IS NOT NULL;

-- 2) For users without a valid hospital, set fleet when the referenced fleet exists
UPDATE doctors d
JOIN users u ON u.id = d.user_id
JOIN fleets f ON f.id = u.fleet_id
SET d.fleet_id = f.id,
    d.hospital_id = NULL
WHERE d.user_id IS NOT NULL AND d.id IS NOT NULL AND (u.hospital_id IS NULL OR u.hospital_id = ''); -- include primary key in WHERE for safe-update mode

-- Normalize: if both hospital_id and fleet_id are present on staff, prefer hospital and clear fleet_id
UPDATE paramedics SET fleet_id = NULL WHERE hospital_id IS NOT NULL AND fleet_id IS NOT NULL;
UPDATE doctors SET fleet_id = NULL WHERE hospital_id IS NOT NULL AND fleet_id IS NOT NULL;

-- Note: this migration assumes users table has accurate hospital_id/fleet_id for staff users. Review before running in prod.
