# PugaAI Health — NAIC Voice-First Validation Implementation

## Purpose

This release adds an NAIC validation evidence layer for the Voice-First Access submission. The official 2026 NAIC requirement for this problem statement is a minimum of 50 documented real user interactions and genuine N-ATLAS integration.

## Frontend behavior

1. A validation coordinator starts a session with a pseudonymous participant code and explicit consent.
2. A participant uses PugaAI Health voice input normally.
3. N-ATLAS ASR returns the transcript and confidence.
4. The participant submits the transcript as a PugaAI Health question.
5. When the AI response is successfully returned, the frontend creates a pseudonymized interaction record.
6. The record contains no raw audio by default.
7. Mock mode stores records in sessionStorage for testing.
8. Live mode posts the record to `POST /api/v1/naic/interactions`.
9. The coordinator console reads validation data from `GET /api/v1/naic/validation`.
10. The console exports the documented interaction dataset as CSV.

## Required backend endpoints

### POST `/api/v1/naic/interactions`

Request JSON:

```json
{
  "interactionId": "NAI-...",
  "participantId": "participant-07",
  "language": "en-NG",
  "channel": "web-voice",
  "transcript": "How can I prevent malaria?",
  "confidence": 0.94,
  "conversationId": "conv-123",
  "messageId": "msg-456",
  "responseCategory": "primary-health-information",
  "feedback": null,
  "status": "completed",
  "createdAt": "2026-09-25T10:00:00.000Z"
}
```

The backend should validate the participant/session consent, persist the record, prevent duplicate `interactionId` values, and enforce appropriate retention/access controls.

### GET `/api/v1/naic/validation`

This endpoint is for an authorized validation coordinator/admin only. It should return the documented records and/or an aggregated validation summary. Authorization must be enforced server-side; hiding the page in the frontend is not a security control.

## Privacy boundary

Do not store raw voice recordings for NAIC evidence unless a separate, documented consent and retention basis exists. The default evidence record is pseudonymized and contains the minimum information needed to demonstrate real-world validation.

Do not use the NAIC validation logger as a substitute for the normal patient medical-record, consent, authorization, or audit systems.
