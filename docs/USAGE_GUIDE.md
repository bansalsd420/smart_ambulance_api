# SMART AMBULANCE API — Step-by-step Usage Guide

Use this guide to run end-to-end flows in Postman, in the exact order they should happen. It covers both fleet-owned and hospital-owned ambulance scenarios.

## Prerequisites
- Server running at http://localhost:3000
- Seeded superadmin: superadmin@example.com / admin123
- Use the Postman collection: `postman/SmartAmbulance.postman_collection.json`

## 0) Authenticate
1) Login as superadmin and save the token as `TOKEN` (the Postman collection captures it for you).

## 1) Fleet-owned ambulance — end-to-end (recommended order)
This models a typical marketplace flow where a fleet owns ambulances and hospitals connect to them.

Role hints
- Create fleet: superadmin or fleet_admin
- Create hospital: superadmin or hospital_admin
- Approve ambulance: superadmin
- Connection approve: fleet_admin
- Onboarding create: hospital_admin or paramedic (with access) or fleet_admin
- Onboarding approve (fleet-owned): fleet_admin or paramedic

Steps
1. Create a Fleet
   - POST /api/fleets (Authorization: Bearer TOKEN)
2. Create a Fleet Admin user and associate to the fleet
   - POST /api/users with { role: 'fleet_admin', fleet_id: <fleet.id>, email, password }
   - (Optional) Login as fleet admin and save `FLEET_TOKEN`.
3. Create a Hospital (the organization)
   - POST /api/hospitals (Authorization: Bearer TOKEN)
4. Create a Hospital Admin user and associate to the hospital
   - POST /api/users with { role: 'hospital_admin', hospital_id: <hospital.id>, email, password }
   - (Optional) Login as hospital admin and save `HOSP_TOKEN`.
5. Add a fleet-owned Ambulance
   - POST /api/ambulances with { code, owner_type: 'fleet', owner_id: <fleet.id>, name? }
6. Superadmin approves the Ambulance
   - GET /api/ambulance-approvals?status=pending
   - POST /api/ambulance-approvals/:id/approve
7. Hospital requests connection to the fleet ambulance (by code)
   - POST /api/connection-requests with { ambulance_code, from_hospital_id: <hospital.id> } (use HOSP_TOKEN)
8. Fleet admin approves the connection
   - POST /api/connection-requests/:id/approve (use FLEET_TOKEN)
9. Create clinical staff (optional)
   - Hospital paramedic/doctor users: POST /api/users with { role: 'paramedic'|'doctor', hospital_id: <hospital.id> }, then
   - POST /api/paramedics or /api/doctors with user_id
10. Assign staff to the (connected) ambulance (optional)
   - POST /api/ambulances/:ambulanceId/assign with { assignee_type: 'paramedic'|'doctor', assignee_id }
11. Start an Onboarding for a patient
   - POST /api/onboardings with { ambulance_id, patient {..} OR patient_id, selected_hospital_id: <hospital.id> }
   - Resulting onboarding status (fleet-owned) = requested
12. Approve and Start transport
   - POST /api/onboardings/:id/approve (fleet_admin or paramedic)
   - POST /api/onboardings/:id/start (paramedic, fleet_admin, or hospital_admin)
13. Telemetry (optional)
   - POST /api/device-data with { ambulance_id, payload {..} }
14. Dashboard
   - GET /api/ambulances/:id/dashboard (shows latest patient, onboarding, assignments, telemetry)
15. Offboard patient
   - POST /api/onboardings/:id/offboard

Quick checks
- GET /api/connection-requests?to_fleet_id=<fleet.id> (fleet) to see pending/approved
- GET /api/ambulance-connections?hospital_id=<hospital.id> (hospital) to see connected ambulances

## 2) Hospital-owned ambulance — end-to-end
This is for hospitals managing their own ambulances.

Role hints
- Create hospital and ambulance: hospital_admin (or superadmin)
- Approve ambulance: superadmin
- Onboarding create: hospital_admin or paramedic

Steps
1. Create a Hospital
   - POST /api/hospitals (Authorization: Bearer TOKEN)
2. Create a Hospital Admin user and associate to the hospital
   - POST /api/users with { role: 'hospital_admin', hospital_id: <hospital.id>, email, password }
3. Add a hospital-owned Ambulance
   - POST /api/ambulances with { code, owner_type: 'hospital', owner_id: <hospital.id>, name? }
4. Superadmin approves the Ambulance
   - GET /api/ambulance-approvals?status=pending
   - POST /api/ambulance-approvals/:id/approve
5. Create staff (optional)
   - Users: POST /api/users with { role: 'paramedic'|'doctor', hospital_id: <hospital.id> }
   - Profiles: POST /api/paramedics or /api/doctors with user_id
6. Assign staff (optional)
   - POST /api/ambulances/:ambulanceId/assign { assignee_type, assignee_id }
7. Start an Onboarding (no fleet approval needed)
   - POST /api/onboardings with { ambulance_id, patient {..} OR patient_id, selected_hospital_id: <hospital.id> }
   - Onboarding status (hospital-owned) = approved
8. Start transport
   - POST /api/onboardings/:id/start
9. Telemetry and Dashboard (optional)
   - POST /api/device-data with { ambulance_id, payload {..} }
   - GET /api/ambulances/:id/dashboard
10. Offboard patient
   - POST /api/onboardings/:id/offboard

## 3) Patients and prescriptions
- Create patient directly: POST /api/patients { patient_code, ... }
- Retrieve by code: GET /api/patients/by-code/:patient_code
- Update prescription during onboarding: PUT /api/onboardings/:id/prescription { prescriptions }

## 4) Meetings (placeholder)
- POST /api/meetings/token { onboarding_id, user_id, role } → returns { token, url }

## 5) Access control tips
- Hospital users can access hospital-owned ambulances and connected fleet ambulances not locked by an active onboarding for another hospital.
- Fleet admins manage fleet-owned ambulances and connection approvals.
- Superadmin bypasses all checks.

## 6) Common errors
- 401 token missing/invalid
- 403 role or ownership forbidden
- 404 resource not found or locked by another hospital
- 409 duplicate code/email
- 422 validation error (check required fields)
