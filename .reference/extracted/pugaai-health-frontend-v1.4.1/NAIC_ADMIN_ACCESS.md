# PugaAI Health v1.4.2 — NAIC Admin Access

## Purpose
The NAIC Validation Console is a restricted administrative area for viewing and exporting documented Voice-First validation interactions. Ordinary PugaAI Health users cannot access the console records.

## Roles
- `naic_admin`: access to the NAIC Validation Console.
- `super_admin`: access to the NAIC Validation Console and future broader administrative capabilities.
- Patient/user roles: no access.

## Live API contract
- `POST /api/v1/admin/auth/login` — authenticate an administrator for `scope=naic_validation`.
- `POST /api/v1/admin/auth/logout` — terminate the administrator session.
- `GET /api/v1/naic/validation` — return validation records; backend must require `naic_admin` or `super_admin`.
- `POST /api/v1/naic/interactions` — record a completed validation interaction. The backend should accept only authorized validation-session writes or apply its own trusted server-side correlation.

## Security boundary
The React route is not a security boundary. Express must enforce authentication and role authorization on every protected endpoint. The admin token is kept separately from the patient access token in session storage.

## Evidence boundary
The default NAIC evidence record stores pseudonymized metadata and transcript/correlation fields. Raw voice audio is not retained by default. If audio retention is later required, implement explicit consent, encrypted storage, retention limits, audit logging, and role-restricted playback.

## Mock development mode
The local mock environment includes a demo-only administrator path so the UI can be tested without a backend. Production configuration rejects mock mode. Replace the mock path with the real Express identity service before deployment.
