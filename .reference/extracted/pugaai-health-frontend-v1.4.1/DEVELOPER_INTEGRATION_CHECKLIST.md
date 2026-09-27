# PugaAI Health — Developer Integration Checklist v1.0.3

## Purpose

This frontend is now structured for backend integration. Production developers should map the frontend adapters to the authoritative Puga API/Express contracts without changing the user-facing safety and state model.

## Required integration sequence

1. Authentication/session
2. Puga Universal Health ID
3. Consent/authorization
4. PugaAI conversations
5. N-ATLAS voice transcription
6. PugaCare appointments/teleconsultation
7. Laboratory
8. Medication/refill
9. PugaPay
10. PugaAccess channel bridge

## Required response semantics

Every protected API should provide enough information for the frontend to distinguish:

- unauthenticated
- forbidden
- consent required
- validation error
- not found
- conflict
- rate limited
- temporarily unavailable
- timeout/network failure

Do not expose secrets, raw tokens, internal stack traces, or unnecessary patient identifiers in frontend error payloads.

## Identity and consent

The Puga Universal Health ID identifies the person; it does not itself authorize access to the medical record.

Expected conceptual flow:

Identity → Authentication → Authorization → Consent → Minimum-necessary permitted data

## PugaAccess

PugaAccess must remain a channel into the same PugaAI Health service.

Supported channel identifiers prepared by the frontend:

- web
- mobile
- pugaaccess-ivr
- pugaaccess-ussd
- pugaaccess-sms

Do not create a separate PugaAI identity or duplicate AI service for PugaAccess.

## N-ATLAS

The frontend provides the voice-transcription boundary. The backend owns:

- N-ATLAS credentials/configuration
- audio processing
- model/service invocation
- language/model routing
- production monitoring
- licensing/commercial deployment controls

## Production gates

- [ ] Authoritative API schemas confirmed
- [ ] Authentication contract confirmed
- [ ] Consent contract confirmed
- [ ] Health ID contract confirmed
- [ ] PugaAccess contract confirmed
- [ ] N-ATLAS contract confirmed
- [ ] PugaCare/PugaCure contracts confirmed
- [ ] PugaPay contract confirmed
- [ ] Staging environment connected
- [ ] End-to-end staging tests passed
- [ ] Security review passed
- [ ] Accessibility review passed
- [ ] Performance review passed
- [ ] Production environment variables configured
- [ ] Monitoring/error reporting configured
