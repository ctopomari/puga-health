# PugaAI Health Frontend v1.1.4 — PugaAccess QA

## Scope

Frontend-only completion of the PugaAccess multi-channel experience.

## Channels

- IVR / Voice
- USSD
- SMS

## Verified behaviors

- Channel selection is explicit and mutually exclusive.
- Session creation uses the existing `/api/v1/puga-access/sessions` adapter boundary.
- Existing sessions can be refreshed through `/api/v1/puga-access/sessions/:sessionId`.
- Session expiry is represented from authoritative `expiresAt` state.
- Expired sessions cannot be treated as active continuity.
- Renewal/start-new-session action is available after expiry.
- Continuity is displayed only when the backend reports `continuitySupported`.
- Demo sessions are explicitly labeled.
- Language preference is passed into session creation.
- Low-bandwidth privacy guidance does not imply channel-based authorization.
- Access history remains authoritative-backend data.
- Responsive layouts cover desktop, tablet, mobile and small screens.

## Backend boundary

The frontend does not execute IVR, USSD or SMS delivery, authenticate a user, authorize medical-record access, or manufacture continuity state. Those functions remain backend/service responsibilities.
