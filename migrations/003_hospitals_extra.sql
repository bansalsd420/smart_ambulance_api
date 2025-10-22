-- Add extra columns for hospitals: emergency_services, total_beds, available_beds, status, metadata
ALTER TABLE hospitals
  ADD COLUMN emergency_services TINYINT(1) DEFAULT 0,
  ADD COLUMN total_beds INT DEFAULT NULL,
  ADD COLUMN available_beds INT DEFAULT NULL,
  ADD COLUMN status VARCHAR(50) DEFAULT 'active',
  ADD COLUMN metadata JSON DEFAULT NULL;
