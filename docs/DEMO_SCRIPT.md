# 5-minute Demo Script

Use only local synthetic data. Never show real patient information or secrets.

1. (0:00–0:30) Show README, architecture and stack: Express + PostgreSQL + Docker.
2. (0:30–1:10) Register a patient and log in; show the returned short-lived JWT.
3. (1:10–1:50) Register a doctor, log in, create an availability slot.
4. (1:50–2:40) Use a seeded admin to verify the doctor; book the slot as patient with an `Idempotency-Key`.
5. (2:40–3:20) Repeat the same booking key and show that the saved response is returned; try a competing booking and show a conflict.
6. (3:20–4:00) Show consultation state transitions and prescription creation by the assigned doctor.
7. (4:00–4:30) Show admin analytics and audit logs.
8. (4:30–5:00) Show automated tests, CI workflow, threat model and architecture docs.

Important: run through these steps and record the actual behavior. Do not claim an untested step works.
