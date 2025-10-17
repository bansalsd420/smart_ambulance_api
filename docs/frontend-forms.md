## Frontend Forms Spec: Smart Ambulance (v1)

This document defines how UI forms should behave so they align with the backend API and validation. Share this with frontend implementers and AI assistants.

### Common conventions

- All forms should show server-side validation errors (422) inline next to the field and as a toast/banner summary.
- Disable submit while a request is in-flight; re-enable after response.
- Use searchable dropdowns for selecting related entities to prevent ID mix-ups.
- Debounce search inputs (~250ms) and paginate where lists are large.
- Show required fields with an asterisk; do basic client validation before submit.

---

## Ambulance: Create

Endpoint: POST /api/ambulances

Payload shape:
{
  code: string (required),
  name?: string,
  owner_type: 'hospital' | 'fleet' (required),
  owner_id: number (required),   // ID of the selected hospital or fleet depending on owner_type
  device_ids?: Array<{ device_id: string, [k: string]: any }>,
  metadata?: Record<string, any>
}

Field behavior:
- Code (text): required, unique. Show duplicate error if 409 is returned.
- Name (text): optional.
- Owner type (segmented control or dropdown): values: Hospital, Fleet. Default based on user role:
  - hospital_admin/hospital_user: preselect Hospital, lock to current hospital.
  - fleet_admin: preselect Fleet, lock to current fleet.
  - superadmin: allow switching; both options enabled.
- Owner (dropdown): dynamic options based on owner_type.
  - If owner_type = hospital: dropdown lists hospitals (id, name)
  - If owner_type = fleet: dropdown lists fleets (id, name)
  - This field provides owner_id to the API.
  - For non-superadmin roles, preselect and disable (read-only) to their org id.
- Device IDs (tag input or table): optional. Allow adding simple strings or key/value rows; send as array of objects like [{ device_id: 'DEV-001' }].
- Metadata (JSON editor or key/value): optional; send as object.

Validation and errors:
- Client: require code, owner_type, owner_id. Prevent submit if owner is empty.
- Server: validates owner_type in ['hospital','fleet'] and checks owner_id exists in the relevant table; returns 422 if not found. Show that error next to Owner field.
- Server: for hospital_admin: must be their hospital; for fleet_admin: must be their fleet; otherwise 403. Show a banner "You can only create ambulances for your organization".

Prefetch for dropdowns:
- Hospitals list: GET /api/hospitals (authorized). Show name; value=id.
- Fleets list: GET /api/fleets (authorized). Show name; value=id.
- For large orgs, implement typeahead: GET with optional ?q= support when added; for now fetch first page and paginate client-side if needed.

States and transitions:
- Newly created ambulances have status=pending_approval and an approval request is opened automatically.

Access rules summary for UX hints:
- Hospital users can view their hospital-owned ambulances and fleet-owned ambulances connected to their hospital (read-only rules depend on connection and onboarding lock).
- Fleet admins can view fleet-owned ambulances.

---

## Ambulance: Update (Edit)

Endpoint: PUT /api/ambulances/:id

Editable fields now:
- name (string)
- status: one of pending_approval | active | suspended | disabled
- device_ids (array)
- metadata (object)

Non-editable:
- code (immutable in UI)
- owner_type/owner_id (owner cannot be changed in v1)

Behavior:
- Pre-fill existing values.
- Save should only send changed fields or the full object; backend will merge safely.
- If server returns 404, show "Ambulance not found" and navigate back.

---

## Hospitals: Create
- Fields: name (required), address (optional), contact_phone (optional)
- Endpoint: POST /api/hospitals
- List for dropdowns: GET /api/hospitals

## Fleets: Create
- Fields: name (required), contact_phone (optional)
- Endpoint: POST /api/fleets
- List for dropdowns: GET /api/fleets

---

## Assignments

Create assignment to an ambulance:
- Endpoint: POST /api/ambulances/:ambulanceId/assign
- Fields:
  - assignee_type: 'paramedic' | 'doctor' (segmented control)
  - assignee_id: number (dropdown populated by GET /api/paramedics?hospital_id=... or GET /api/doctors?hospital_id=... depending on user org)

List assignments: GET /api/ambulances/:id/assignments

---

## Onboardings (create and actions)

Create onboarding:
- Endpoint: POST /api/onboardings
- Fields: ambulance (dropdown: list ambulances user can access), patient inline form, initiated_by auto=me, selected_hospital (dropdown hospitals), initial_vitals (key/values)

Actions:
- Approve: POST /api/onboardings/:id/approve
- Start: POST /api/onboardings/:id/start
- Offboard: POST /api/onboardings/:id/offboard

---

## Error mapping cheat sheet

- 401 Unauthorized: prompt re-login.
- 403 Forbidden: show banner: "You don't have permission for this action." Disable controls accordingly.
- 404 Not Found: show toast and go back to list.
- 409 Conflict (e.g., duplicate code): show inline on Code field.
- 422 Validation errors: render field-level messages from response.errors[].

---

## Example UI wireflow (Ambulance Create)

1) Open Create Ambulance
2) Owner type selector (Hospital/Fleet)
3) Owner dropdown populated accordingly
4) Code input, Name input (optional)
5) Device IDs (optional), Metadata (optional)
6) Submit -> POST /api/ambulances
7) On success: show success toast and navigate to detail; status shows Pending Approval.

---

## Notes
- Use dropdowns for owner selection; never let users type raw IDs.
- For users tied to one org, lock preselected value to avoid errors.
- Consider caching frequently used lists (hospitals, fleets) for 5 minutes.
