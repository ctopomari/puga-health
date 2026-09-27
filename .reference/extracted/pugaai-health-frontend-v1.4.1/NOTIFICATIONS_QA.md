# PugaAI Health v1.2.0 — Notifications QA

## Scope
- Care, payment, security and system notification categories.
- Unread count and unread visual state.
- Filtered notification views.
- Mark one notification read.
- Mark all notifications read.
- Routing into relevant PugaAI Health areas.
- Responsive mobile/tablet layout.
- Privacy-safe preview guidance.

## Backend boundary
The frontend exposes adapters for `GET /api/v1/notifications`, `POST /api/v1/notifications/:notificationId/read`, and `POST /api/v1/notifications/read-all`. The backend remains authoritative for notification content and state.
