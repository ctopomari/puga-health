import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const api = fs.readFileSync('src/services/api.js','utf8')
const app = fs.readFileSync('src/main.jsx','utf8')

test('health dashboard exposes a patient dashboard API contract', () => {
  assert.match(api, /getHealthDashboard\(/)
  assert.match(api, /\/api\/v1\/me\/health-dashboard/)
})

test('health dashboard is reachable from the application navigation', () => {
  assert.match(app, /health-dashboard/)
  assert.match(app, /Health Dashboard/)
})

test('health dashboard presents core patient health domains', () => {
  assert.match(app, /Health ID/)
  assert.match(app, /Care journey/)
  assert.match(app, /Appointments/)
  assert.match(app, /Laboratory/)
  assert.match(app, /Medications/)
  assert.match(app, /PugaAI conversations/)
})
