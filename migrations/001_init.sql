-- Core tables based on provided schema (simplified types)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  phone VARCHAR(50),
  role ENUM('superadmin','hospital_admin','hospital_user','fleet_admin','paramedic','doctor') NOT NULL,
  hospital_id BIGINT NULL,
  fleet_id BIGINT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hospitals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT,
  contact_phone VARCHAR(50),
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fleets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(50),
  created_by BIGINT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulances (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  owner_type ENUM('hospital','fleet') NOT NULL,
  owner_id BIGINT NOT NULL,
  status ENUM('pending_approval','active','suspended','disabled') DEFAULT 'pending_approval',
  device_ids JSON NULL,
  metadata JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulance_approvals (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  requested_by BIGINT,
  approval_status ENUM('pending','approved','rejected') DEFAULT 'pending',
  approved_by BIGINT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  license_no VARCHAR(100),
  specialization VARCHAR(255),
  profile JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS paramedics (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  code VARCHAR(100) UNIQUE,
  qualifications JSON,
  profile JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  assignee_type ENUM('doctor','paramedic') NOT NULL,
  assignee_id BIGINT NOT NULL,
  assigned_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ambulance_connections (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  hospital_id BIGINT NOT NULL,
  connected_by BIGINT,
  status ENUM('connected','disconnected') DEFAULT 'connected',
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS connection_requests (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_code VARCHAR(100) NOT NULL,
  from_hospital_id BIGINT,
  to_fleet_id BIGINT,
  status ENUM('pending','approved','rejected') DEFAULT 'pending',
  requested_by BIGINT,
  responded_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  patient_code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  age INT,
  gender ENUM('male','female','other'),
  contact JSON,
  medical_history JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS onboardings (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  patient_id BIGINT NOT NULL,
  initiated_by BIGINT,
  selected_hospital_id BIGINT NULL,
  status ENUM('requested','approved','in_transit','offboarded','rejected') DEFAULT 'requested',
  start_time DATETIME NULL,
  end_time DATETIME NULL,
  prescription JSON NULL,
  notes TEXT NULL,
  audit JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS device_data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ambulance_id BIGINT NOT NULL,
  device_id VARCHAR(255),
  payload JSON,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NULL,
  action VARCHAR(255),
  resource_type VARCHAR(100),
  resource_id BIGINT,
  meta JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ambulances_code ON ambulances (code);
CREATE INDEX idx_onboardings_ambulance ON onboardings (ambulance_id);
CREATE INDEX idx_patients_code ON patients (patient_code);
