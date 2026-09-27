# PugaAI Health v1.0.7 — Integration QA / Release Candidate

## Commands
- `npm install` (network access required)
- `npm test` — contract, resilience, release configuration tests
- `npm run qa:static` — structural checks
- `npm run qa:preflight` — validate `.env.production` if supplied
- `npm run build` — compile production assets; mandatory in CI
- `npm run qa` — full sequence

## Developer-owned integration acceptance
1. Supply `.env.production` with HTTPS Express API URL and actual PugaAccess URL; **never put secrets in VITE_ variables**.
2. Match `src/services/integration-contract.js` to actual backend routes, HTTP methods and schemas. This frontend checks route presence, not backend compatibility.
3. Exercise login/logout, session expiry, Health ID authorization and consent revocation using staging accounts. Deny access by default.
4. Exercise N-ATLAS transcription with permitted languages and explicit microphone consent. Verify the browser does not send recordings without user action.
5. Exercise IVR/USSD/SMS session creation and session continuity on PugaAccess staging; check channel attribution and audit logs.
6. Test appointment requests, clinician confirmation, lab/refill handoffs and PugaPay payment handoff with test transactions only.
7. Browser QA: keyboard-only navigation, mobile widths 320/375/768 px, desktop, offline/slow network, error boundary, screen reader announcements.
8. Security review: CORS allowlist, HTTPS, CSP, authentication storage strategy, authorization enforced on server, no patient records in client logs.
9. Performance: production bundle audit, Lighthouse on target low-bandwidth Android, verify large image sizes and avoid excessive startup JavaScript.
10. Deploy behind staging, review logs, then approve production release. **This package is not backend-integrated or clinically validated.**


## v1.1.0 conversational UX checks
- New conversation resets the active UI conversation state.
- Assistant responses expose copy, listen/stop and feedback controls.
- Feedback remains frontend-visible even when the backend adapter is unavailable.
- Conversation history preview text is normalized and titles are capped at 64 characters.
- Voice playback remains optional and browser capability dependent.


### v1.2.0 notification center QA
- 39 automated tests passed.
- Static validation passed.
- Notification read-state adapters covered.
- Responsive notification center covered.
- Production build remains environment-dependent until Vite dependencies and .env.production are supplied.
