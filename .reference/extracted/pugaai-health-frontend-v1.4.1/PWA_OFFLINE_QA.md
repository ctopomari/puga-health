# PugaAI Health v1.2.3 — PWA & Offline QA

## Scope
Frontend-only PWA shell, connection-aware behavior and low-bandwidth/offline UX. No backend or protected-data synchronization is implemented here.

## Implemented
- Installable web-app manifest.
- Service-worker shell caching.
- Navigation fallback to cached app shell/offline page.
- Static asset caching for official Puga TriniCare assets.
- Safe offline messaging that distinguishes cached UI from live/protected services.
- Existing browser online/offline connection state retained.
- PugaAccess remains the low-bandwidth fallback channel.

## Security boundary
Offline mode does not authorize access to protected clinical records, payments, or consequential care actions. Backend authorization remains authoritative when connectivity returns.

## Developer verification
1. Run `npm install`.
2. Run `npm test` and `npm run qa:static`.
3. Run `npm run build`.
4. Serve the production `dist` over HTTPS (or localhost) and verify install prompt.
5. Load once online, disable network, reload, and verify shell/offline fallback.
6. Reconnect and verify live-service actions return to normal.
7. Verify no protected response is persisted by the service worker.
