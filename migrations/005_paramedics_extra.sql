-- 005_paramedics_extra.sql
-- Add commonly-used columns to the `paramedics` table and rename `code` -> `paramedic_code`.
-- This migration follows the same straightforward ALTER style as other files in the repo.

-- 1) Add name and rename code -> paramedic_code
ALTER TABLE paramedics
	ADD COLUMN name VARCHAR(255) NOT NULL,
	CHANGE COLUMN code paramedic_code VARCHAR(100) DEFAULT NULL;

-- 2) Add additional metadata columns
ALTER TABLE paramedics
	ADD COLUMN contact JSON DEFAULT NULL,
	ADD COLUMN metadata JSON DEFAULT NULL,
	ADD COLUMN posting VARCHAR(255) DEFAULT NULL,
	ADD COLUMN department VARCHAR(255) DEFAULT NULL;

-- 4) Remove unused columns qualifications and profile if present
ALTER TABLE paramedics
  DROP COLUMN IF EXISTS qualifications,
  DROP COLUMN IF EXISTS profile;

-- 3) Unique index for generated paramedic_code
-- Add unique index only if it doesn't already exist (avoids duplicate-index warnings)
-- ensure any duplicate named index is removed first
-- (if it doesn't exist this will error on some MySQL versions; it's safe to run manually)
DROP INDEX IF EXISTS ux_paramedics_paramedic_code ON paramedics;

ALTER TABLE paramedics
	ADD UNIQUE INDEX ux_paramedics_paramedic_code (paramedic_code);

-- Note: assignment mapping (ambulance_paramedics) is deferred for now.
