import test from 'node:test'
import assert from 'node:assert/strict'
import { createValidationRecord, summarizeValidation, isValidationConsentComplete } from '../src/services/naic-validation.js'

test('creates a pseudonymized NAIC interaction record without raw audio', () => {
  const record = createValidationRecord({
    participantId: ' participant-07 ',
    language: 'en-NG',
    channel: 'web-voice',
    transcript: 'How can I prevent malaria?',
    confidence: 0.94,
    conversationId: 'conv-1',
    messageId: 'msg-1',
    responseCategory: 'primary-health-information',
    feedback: 'helpful',
  }, () => '2026-09-25T10:00:00.000Z')

  assert.equal(record.participantId, 'participant-07')
  assert.equal(record.channel, 'web-voice')
  assert.equal(record.transcript, 'How can I prevent malaria?')
  assert.equal(record.confidence, 0.94)
  assert.equal(record.status, 'completed')
  assert.equal(record.audio, undefined)
  assert.equal(record.createdAt, '2026-09-25T10:00:00.000Z')
  assert.match(record.interactionId, /^NAI-/)
})

test('summarizes validation progress against the 50-interaction target', () => {
  const records = [
    { participantId: 'p1', language: 'en-NG', status: 'completed' },
    { participantId: 'p1', language: 'yo-NG', status: 'completed' },
    { participantId: 'p2', language: 'en-NG', status: 'failed' },
  ]
  const summary = summarizeValidation(records, 50)
  assert.equal(summary.total, 3)
  assert.equal(summary.completed, 2)
  assert.equal(summary.uniqueParticipants, 1)
  assert.equal(summary.target, 50)
  assert.equal(summary.remaining, 48)
  assert.equal(summary.languages['en-NG'], 2)
  assert.equal(summary.languages['yo-NG'], 1)
})

test('requires participant code and explicit consent before validation logging', () => {
  assert.equal(isValidationConsentComplete({ participantId: '', consent: true }), false)
  assert.equal(isValidationConsentComplete({ participantId: 'p1', consent: false }), false)
  assert.equal(isValidationConsentComplete({ participantId: 'p1', consent: true }), true)
})
