# SMART AMBULANCE API (Node.js + Express + MySQL)

A simple REST API with JWT auth and role-based access control for hospitals, fleets, paramedics, and doctors.

## Quick start

1. Create a `.env` from the example and update values.
2. Create the MySQL database and run migrations.
3. Seed a superadmin user.
4. Start the server.

### Environment

Copy `.env.example` to `.env` and edit as needed.

### Migrations

Run migrations to create tables:

```sh
npm run migrate
```

### Seed initial data

```sh
npm run seed
```

Default superadmin:
- Email: `superadmin@example.com`
- Password: `admin123` (change via env `SEED_SUPERADMIN_PASSWORD`)

### Run

Dev mode:

```sh
npm run dev
```

Prod:

```sh
npm start
```

### Test

```sh
npm test
```

## Endpoints (MVP started)

- GET `/api/health` — health check
- POST `/api/auth/login` — email + password -> JWT

Further endpoints per scope to be added iteratively.

## Notes

- No TypeScript — CommonJS modules only.
- Keep JWT secret safe. Do not commit real secrets.
