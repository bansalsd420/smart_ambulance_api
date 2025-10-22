ALTER TABLE patients
  ADD COLUMN bio JSON DEFAULT NULL,
  ADD COLUMN treatment JSON DEFAULT NULL,
  ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'requested',
  ADD COLUMN hospital_id BIGINT DEFAULT NULL,
  ADD COLUMN fleet_id BIGINT DEFAULT NULL;

CREATE INDEX ix_patients_status ON patients (status);
CREATE INDEX ix_patients_hospital ON patients (hospital_id);
CREATE INDEX ix_patients_fleet ON patients (fleet_id);
