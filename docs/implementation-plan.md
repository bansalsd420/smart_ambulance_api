# SMART Ambulance API Implementation Plan

1. **Project Setup**
   - Configure TypeScript build tooling with ts-node-dev for development and build scripts.
   - Install Express, MySQL client (mysql2), JWT utilities, bcrypt, and validation libraries.
   - Initialize dotenv for environment configuration and set up configuration module.

2. **Database Layer**
   - Introduce an ORM/query builder (Knex) with migration and seed scripts.
   - Translate provided schema into migration files with foreign keys and indexes.
   - Create seed data for superadmin, sample hospital, fleet, and baseline roles.

3. **Core Infrastructure**
   - Implement Express app with modular routing per resource group.
   - Add middleware: request logging, error handling, JWT auth, RBAC, validation helpers.
   - Configure MySQL connection pool and transaction helper utilities.

4. **Modules & Routes**
   - **Auth & Users**: registration (admin only), login, logout placeholders, refresh token scaffold.
   - **Hospitals & Fleets**: CRUD endpoints with ownership checks.
   - **Ambulances**: creation, approval workflow, status transitions; integrate audit logging.
   - **Assignments**: doctor/paramedic assignment management with RBAC constraints.
   - **Connection Requests**: request lifecycle between hospitals and fleets.
   - **Onboardings & Patients**: onboarding lifecycle, status transitions, patient record management.
   - **Device Data**: ingestion endpoint with optional API key verification; dashboard aggregation.
   - **Meetings & Tokens**: placeholder token generation returning signed payload (mock provider).
   - **Audit Logs**: create entries for critical actions; expose filtered retrieval endpoint.

5. **Security & Validation**
   - Hash passwords with bcrypt; enforce password strength validation.
   - Use JWTs embedding user metadata (role, hospital_id, fleet_id) with refresh token strategy.
   - Apply rate limiting to auth and device endpoints.
   - Sanitize user input with validation middleware and central error formatting.

6. **Testing Strategy**
   - Configure Jest + Supertest for integration tests.
   - Cover auth, ambulance lifecycle, connection requests, onboarding flow, device ingestion, and RBAC guards.
   - Add seed fixtures for consistent test data.

7. **Documentation & Tooling**
   - Prepare README with setup instructions, environment variables, migration commands, and sample cURL requests.
   - Add npm scripts for linting (ESLint + Prettier) and testing.
   - Document API contracts using OpenAPI/Swagger stub for future expansion.

8. **Next Steps**
   - Evaluate need for caching patient dashboards.
   - Consider background job queue for heavy telemetry processing in future iterations.
