# Amrutam Telemedicine Backend (Assignment Reference)

A Node.js + Express + PostgreSQL reference implementation for core telemedicine workflows. This is a strong assignment starter, **not a fully production-certified telemedicine platform**. Review the implementation, run tests, and complete the checklist before submission.

## Features
- Register/login and short-lived JWT authentication
- Patient/doctor/admin roles (admin account is created only by seed script)
- Doctor search/filter and doctor availability slots
- Transactional consultation booking with row locking, uniqueness constraints and `Idempotency-Key`
- Consultation state transitions and prescriptions
- Pending payment record (no payment gateway integration)
- Admin analytics, doctor verification and audit-log listing
- Zod validation, bcrypt password hashing, Helmet, CORS allow-list, rate limit
- Health/readiness endpoints, request IDs, Docker Compose, OpenAPI, CI workflow and architecture/security docs

## Prerequisites
- Node.js 20+
- Docker Desktop (recommended) OR PostgreSQL 16 installed locally
- npm

## Quick start with Docker
1. Copy `.env.example` to `.env` and set a unique `JWT_SECRET` and local DB password.
2. Start services:
   ```bash
   docker compose up --build
   ```
   PostgreSQL initializes from `migrations/001_init.sql`. API listens on `http://localhost:3000`.
3. Seed a local development admin in another terminal:
   ```bash
   docker compose exec api node src/db/seed.js
   ```
   Demo-only credentials: `admin@example.test` / `ChangeMe123!ChangeMe`. Change/remove before any shared environment.
4. Verify:
   ```bash
   curl http://localhost:3000/health/live
   curl http://localhost:3000/health/ready
   ```

## Local run without Docker
1. Install PostgreSQL 16 and create database `amrutam`.
2. Copy `.env.example` to `.env`, set `DATABASE_URL` to your local credentials and set a random JWT secret.
3. Install dependencies and apply schema:
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm start
   ```
4. Run tests:
   ```bash
   npm test
   ```
   Tests are basic smoke tests; integration and concurrency tests should be added before production.

## Main API endpoints
| Method | Path | Purpose | Access |
|---|---|---|---|
| GET | `/health/live` | Liveness | Public |
| GET | `/health/ready` | DB readiness | Public |
| POST | `/api/v1/auth/register` | Register patient/doctor | Public |
| POST | `/api/v1/auth/login` | Login | Public |
| GET | `/api/v1/auth/me` | Current profile | Authenticated |
| GET | `/api/v1/doctors?search=&specialization=&limit=20&offset=0` | Search verified doctors | Public |
| POST | `/api/v1/doctors/me/availability` | Create availability slot | Doctor |
| GET | `/api/v1/doctors/:id/availability` | List future available slots | Public |
| POST | `/api/v1/consultations` | Book slot | Patient + `Idempotency-Key` header |
| GET | `/api/v1/consultations/mine` | Visible consultations | Authenticated |
| PATCH | `/api/v1/consultations/:id/status` | Update consultation state | Assigned doctor/admin |
| POST | `/api/v1/consultations/:id/prescriptions` | Create prescription | Assigned doctor |
| GET | `/api/v1/admin/analytics` | Consultation counts and daily trend | Admin |
| GET | `/api/v1/admin/audit-logs` | Recent audit entries | Admin |
| POST | `/api/v1/admin/doctors/:id/verify` | Verify doctor | Admin |

## Example requests
Register:
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.test","password":"StrongPassword123!","fullName":"Demo Patient","role":"patient"}'
```
Login:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"patient@example.test","password":"StrongPassword123!"}'
```
Create booking (replace token and slot UUID):
```bash
curl -X POST http://localhost:3000/api/v1/consultations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: booking-demo-0001" \
  -d '{"slotId":"SLOT_UUID","reason":"General consultation"}'
```

## Folder structure
```text
src/
  app.js
  server.js
  config.js
  db/{pool,migrate,seed}.js
  middleware/{auth,errors,requestId,validate}.js
  routes/{auth,doctors,consultations,admin}.js
  services/audit.js
migrations/001_init.sql
tests/unit.test.js
docs/{ARCHITECTURE,THREAT_MODEL,OBSERVABILITY,DEMO_SCRIPT}.md
openapi.yaml
Dockerfile
docker-compose.yml
.github/workflows/ci.yml
```

## Important design decisions
- SQL values are parameterized.
- Booking is transactional and uses a row lock plus unique constraints.
- Idempotency responses are stored by user/key. The same key with a different payload is not fingerprint-checked yet; complete this before production.
- Doctor registration creates an unverified doctor profile; only an admin can verify it.
- A local admin can be created by the seed script. Do not expose seeded credentials publicly.
- JWT uses HS256 and a short lifetime; production should use managed secret storage and rotation.
- General rate limiting exists; dedicated login throttling is a production follow-up.
- Health fields are not logged intentionally. Encryption at rest/TLS must be configured in deployment infrastructure.

## Assignment limitations / remaining work
- MFA is not implemented (only a schema flag exists).
- Prometheus metrics and OpenTelemetry tracing are described in docs but not wired into code.
- Payment is only a pending database record; no gateway or webhook.
- Async jobs/outbox, Redis cache, real notifications/video calling, production migrations tooling, DB backup automation and multi-AZ deployment are not included.
- Add end-to-end tests for registration, booking, idempotency replay, concurrent double-booking, state transitions, prescriptions, admin RBAC and object-level authorization.
- Add request fingerprinting to idempotency keys, audit-log immutability controls, dependency scanning/SBOM, load tests and restore drills.
- Validate legal/privacy requirements and security posture before handling real patient data.

## Submission checklist
- [ ] Run locally and fix any environment-specific errors
- [ ] `npm test` passes
- [ ] Run API demo using synthetic data
- [ ] Review all files and be ready to explain design decisions
- [ ] Commit `package-lock.json` after `npm install`
- [ ] Replace local secrets; never commit `.env`
- [ ] Record actual 5-minute demo
- [ ] Do not claim production SLA/scale without load tests and deployment evidence
