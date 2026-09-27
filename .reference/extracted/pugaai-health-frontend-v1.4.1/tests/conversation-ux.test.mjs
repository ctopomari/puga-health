import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveConversationTitle, normalizeConversationText, getFeedbackLabel } from '../src/services/conversation.js'

test('normalizes conversation text for clipboard and previews', () => {
  assert.equal(normalizeConversationText('  Hello\n\nworld  '), 'Hello\nworld')
})

test('derives a concise conversation title from the first user message', () => {
  assert.equal(deriveConversationTitle('  How can I prevent malaria before travelling?  '), 'How can I prevent malaria before travelling?')
  assert.ok(deriveConversationTitle('a'.repeat(100)).length <= 64)
})

test('returns explicit feedback labels', () => {
  assert.equal(getFeedbackLabel('helpful'), 'Helpful')
  assert.equal(getFeedbackLabel('not-helpful'), 'Not helpful')
})
