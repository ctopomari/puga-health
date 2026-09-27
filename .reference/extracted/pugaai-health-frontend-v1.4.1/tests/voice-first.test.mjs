import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { VOICE_STATES } from '../src/services/voice.js'

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')
const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')

test('voice state machine exposes the complete first-party interaction states', () => {
  assert.deepEqual(Object.values(VOICE_STATES), ['idle','requesting-permission','listening','processing','transcribing','responding','playing','error'])
})

test('home voice UI receives the actual voice handlers from App', () => {
  assert.match(main, /startVoiceCapture=\{startVoiceCapture\}/)
  assert.match(main, /stopVoiceCapture=\{stopVoiceCapture\}/)
})

test('voice-first UI exposes transcript review and language-aware controls', () => {
  assert.match(main, /Transcript review/)
  assert.match(main, /voiceLanguageLabel\(voiceLanguage\)/)
  assert.match(main, /voiceConfidence !== null/)
})

test('voice UI includes a reduced-motion-safe visualizer', () => {
  assert.match(css, /voice-visualizer/)
  assert.match(css, /prefers-reduced-motion:reduce/) 
})
