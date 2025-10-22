-- Add extra columns to doctors table: department, posting, contact
ALTER TABLE doctors
  ADD COLUMN department VARCHAR(255) NULL,
  ADD COLUMN posting VARCHAR(255) NULL,
  ADD COLUMN contact VARCHAR(255) NULL;
