# PugaAI Health Frontend Security & Privacy Hardening v1.3.1

## Scope
Client-side security hardening only. Backend authentication, authorization, consent, audit logging, key management, payment security, and protected-data enforcement remain server responsibilities.

## Storage hygiene
- Access tokens are held in `sessionStorage`, not persistent `localStorage`.
- Authentication state is session-scoped.
- Mock conversation history is session-scoped to reduce persistent sensitive-text exposure.
- Language preference may remain in `localStorage` because it is not an authentication credential.
- Never store passwords, OTPs, payment credentials, refresh tokens, or raw clinical records in browser storage.

## Error hygiene
- API error messages are normalized and redacted before user-facing display.
- Unexpected UI errors are not serialized to console output.
- Avoid putting health data, tokens, or identifiers into URLs.

## Browser security
The Vite development server includes a security-header baseline. Production hosting must enforce equivalent headers and replace broad `connect-src https:` with the exact trusted API origins.

Recommended production headers:
- Content-Security-Policy
- Referrer-Policy: `strict-origin-when-cross-origin`
- X-Content-Type-Options: `nosniff`
- frame-ancestors / X-Frame-Options
- Permissions-Policy
- Strict-Transport-Security (HTTPS production only)

## Sensitive-data boundary
The frontend must not treat Puga Universal Health ID as a master key. Identity, authentication, authorization, consent, and permitted data remain separate boundaries.

## Payment boundary
PugaAI Health never stores payment credentials. Checkout is delegated to the approved payment boundary and only trusted checkout URLs should be opened.

## PugaAccess
IVR, USSD and SMS remain supported low-bandwidth channels. Offline mode must not be interpreted as authorization to view protected clinical data.

## Release gate
Before production: verify CSP with the real API origin, HTTPS, session expiry, authorization denial, sensitive-data redaction, payment handoff, PugaAccess continuity, and browser storage inspection.
