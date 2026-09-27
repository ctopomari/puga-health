# PugaAI Health Frontend v1.0.0

PugaAI Health — Your AI-powered voice health navigator.

## Segment
Production integration foundation built on v0.9.0.

### Added
- Runtime environment configuration
- Authenticated API transport with bearer-token support
- Request timeout and Puga channel header
- Live/mock runtime status
- Authentication login/logout API boundaries
- Puga Universal Health ID API boundary
- PugaAccess session bridge
- N-ATLAS health-status boundary
- Production integration status UI in Settings
- Environment example for Express.js, PugaAccess and N-ATLAS endpoints

### Important
This segment prepares the frontend for real production services but does not claim that the corresponding backend, N-ATLAS endpoint, authentication service or PugaAccess session endpoint is already deployed. Set `VITE_API_MODE=live` only after the actual Express.js contracts are verified.

## Run
```bash
npm install
npm run dev
```

## Production configuration
Copy `.env.example` to `.env` and configure the real service endpoints. Never commit secrets or patient data.

## Validation
Static/source validation completed. Production Vite compilation was not verified because dependency installation timed out in the build environment.


## v1.0.5 Production Resilience Segment

This segment hardens the frontend integration boundary without claiming that production backend services are already deployed. It adds browser online/offline awareness, safe retry behavior for idempotent GET requests, request timeout handling, explicit HTTP 401/session-expiry handling, a backend health-check adapter, production diagnostics, and a global UI error boundary.

PugaAccess remains a first-class channel bridge, and all live integrations remain configurable through Vite environment variables.


## v1.0.2 — Protected Data & Consent Integration

This segment hardens authenticated access to protected PugaAI Health areas and adds a consent/permission control center.

Production boundaries remain adapter-based until the Express.js backend contracts are confirmed. PugaAccess remains a first-class channel bridge.


## v1.0.3 — Frontend Production-Integration Readiness

This segment does not connect to or modify the production backend. It formalizes frontend capability contracts, API error semantics, protected capability boundaries, channel identifiers, PugaAccess integration expectations, and a developer handoff checklist.


## v1.0.4 — Voice UX Hardening

Adds a frontend voice state machine, MediaRecorder abstraction, transcription boundary, multilingual voice selection, confidence display, speech playback, and graceful voice failure/retry states. Backend/N-ATLAS implementation remains developer-owned.


## v1.0.5 — PugaAccess Channel Experience

Adds the frontend PugaAccess channel bridge for IVR, USSD and SMS, including channel selection, session creation, continuity status, retry handling and entry from the PugaAI Health home/access experience.

The backend PugaAccess gateway remains developer-owned.

The IVR, USSD and SMS channels are designed to continue into the same PugaAI Health service rather than separate AI implementations.


## v1.0.6 — Production Hardening
- Fixed the duplicate `voiceState` React state declaration carried forward from v1.0.5.
- Added skip navigation, semantic main landmark focus, keyboard focus-visible states, and persistent connection status.
- Added centralized user-facing error normalization and retry-safety helpers.
- Preserved PugaAccess IVR/USSD/SMS continuity and all prior production integration boundaries.
- This release remains frontend-only; backend implementation is not included.


## v1.0.8 release QA
Run `npm test`, `npm run qa:static`, `npm run qa:preflight` and `npm run build`. See `RELEASE_CANDIDATE_QA.md`. No backend or live clinical service is included.


## v1.0.8 — Responsive & Mobile Product Polish
- Tablet breakpoint at 1024px.
- Mobile breakpoint at 720px with small-screen refinement at 380px.
- Safe-area-aware mobile navigation.
- Minimum 44px interactive touch targets.
- Overflow protection and responsive content sizing.
- Mobile modal, chat composer, payment, voice and PugaAccess refinements.
- Reduced-motion/accessibility behavior retained.


## v1.1.1 — Complete PugaAI Conversational UX

This segment completes the primary conversational interaction layer while remaining frontend-only.

### Added
- New conversation reset control.
- Conversation title derivation and normalized local previews.
- Copy assistant response to clipboard.
- Listen/stop assistant responses using the browser speech layer.
- Helpful / not-helpful response feedback controls.
- Frontend adapter for conversation feedback: `POST /api/v1/conversations/:conversationId/feedback`.
- Conversation safety strip and responsive response-action controls.
- TDD coverage for conversation text normalization, title derivation and feedback labels.

### Backend boundary
The feedback route is an integration contract only. No backend implementation is included.

## v1.2.0 — PugaPay & Transaction UX

- Explicit healthcare service amount + ₦200 Puga platform fee + total.
- Payment method selection and review-before-payment boundary.
- Pending payment status and secure checkout handoff when a backend checkout URL is supplied.
- Paid transaction detail/receipt presentation without inventing authoritative receipt data.
- Failed/cancelled transaction status styling.
- Payment safety boundary: PugaAI Health never collects card PIN, OTP, password or wallet credentials.


## v1.2.0 — PugaAccess Multi-Channel UX

Adds channel selection, session continuity states, language preference, session refresh/renewal, expiry handling, low-bandwidth privacy guidance, and responsive IVR/USSD/SMS UX. Backend remains authoritative for session and continuity state.

## v1.2.0 — Notifications & Communication Center

Adds a dedicated patient communication center for care, payment, security and system updates. Notifications are filterable, routable, and support read-state updates through frontend API adapters. Notification previews intentionally avoid sensitive clinical details.


## v1.2.3 — PWA & Offline
Adds installable PWA metadata, service-worker shell caching, offline navigation fallback, and low-bandwidth/offline safety boundaries. PugaAccess remains the preferred channel for users who need IVR, USSD or SMS access.


## v1.4.0 Security hardening
Client-side storage, error hygiene, browser security-header preparation, payment URL boundary checks, and privacy-safe logging have been hardened. See `SECURITY_PRIVACY_HARDENING.md`.


## v1.4.0 Final Release Candidate

This package consolidates the frontend feature set through the final release-candidate gate. See `FINAL_RELEASE_CANDIDATE_QA.md` for deployment-dependent checks.


## NAIC admin access
The NAIC Validation Console is protected by a separate administrator session. See `NAIC_ADMIN_ACCESS.md` for the Express endpoint and role contract.
