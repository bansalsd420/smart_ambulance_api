-- 007_staff_ownership.sql
-- Add ownership columns to paramedics and doctors so each staff belongs to exactly one owner (hospital OR fleet)

ALTER TABLE paramedics
  ADD COLUMN hospital_id BIGINT NULL,
  ADD COLUMN fleet_id BIGINT NULL,
  ADD INDEX idx_paramedics_hospital (hospital_id),
  ADD INDEX idx_paramedics_fleet (fleet_id),
  ADD CONSTRAINT fk_paramedics_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_paramedics_fleet FOREIGN KEY (fleet_id) REFERENCES fleets(id) ON DELETE SET NULL;

ALTER TABLE doctors
  ADD COLUMN hospital_id BIGINT NULL,
  ADD COLUMN fleet_id BIGINT NULL,
  ADD INDEX idx_doctors_hospital (hospital_id),
  ADD INDEX idx_doctors_fleet (fleet_id),
  ADD CONSTRAINT fk_doctors_hospital FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_doctors_fleet FOREIGN KEY (fleet_id) REFERENCES fleets(id) ON DELETE SET NULL;

-- Note: MySQL versions before 8.0 may not enforce CHECK constraints. We enforce the "exactly one owner" rule in application code (controllers).
