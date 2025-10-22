-- 006_ambulance_assignments.sql
-- Create explicit join tables for ambulance <-> paramedic and ambulance <-> doctor assignments

-- Table: ambulance_paramedics
-- Tracks which paramedics are assigned to which ambulances
CREATE TABLE IF NOT EXISTS ambulance_paramedics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  paramedic_id BIGINT NOT NULL,
  assigned_by BIGINT DEFAULT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ambulance_paramedics_ambulance (ambulance_id),
  INDEX idx_ambulance_paramedics_paramedic (paramedic_id),
  CONSTRAINT fk_ambulance_paramedics_ambulance FOREIGN KEY (ambulance_id) REFERENCES ambulances(id) ON DELETE CASCADE,
  CONSTRAINT fk_ambulance_paramedics_paramedic FOREIGN KEY (paramedic_id) REFERENCES paramedics(id) ON DELETE CASCADE,
  CONSTRAINT fk_ambulance_paramedics_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Table: ambulance_doctors
-- Tracks which doctors are assigned to which ambulances
CREATE TABLE IF NOT EXISTS ambulance_doctors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  doctor_id BIGINT NOT NULL,
  assigned_by BIGINT DEFAULT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  removed_at TIMESTAMP NULL DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ambulance_doctors_ambulance (ambulance_id),
  INDEX idx_ambulance_doctors_doctor (doctor_id),
  CONSTRAINT fk_ambulance_doctors_ambulance FOREIGN KEY (ambulance_id) REFERENCES ambulances(id) ON DELETE CASCADE,
  CONSTRAINT fk_ambulance_doctors_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT fk_ambulance_doctors_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Notes:
-- - We intentionally do not add a conditional unique constraint for active assignments (removed_at IS NULL) because
--   MySQL does not support partial indexes; application logic should prevent duplicate active assignments or we can
--   implement a trigger if stricter enforcement is required.
-- - The ON DELETE behavior will remove assignment rows if the referenced ambulance/doctor/paramedic is deleted; assigned_by
--   will be set to NULL if the user who assigned is removed.
-- - Run this migration after your other schema migrations so referenced tables exist.
