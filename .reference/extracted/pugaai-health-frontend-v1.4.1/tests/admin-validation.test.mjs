import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isNaicAdminSession, canAccessNaicConsole, clearNaicAdminSession } from '../src/services/naic-admin.js'

test('NAIC console requires an authenticated NAIC admin role', () => {
  assert.equal(isNaicAdminSession({ status: 'authenticated', role: 'naic_admin' }), true)
  assert.equal(isNaicAdminSession({ status: 'authenticated', role: 'patient' }), false)
  assert.equal(isNaicAdminSession({ status: 'signed-out', role: 'naic_admin' }), false)
  assert.equal(canAccessNaicConsole({ status: 'authenticated', role: 'super_admin' }), true)
})

test('clearing the NAIC admin session removes admin credentials', () => {
  const storage = new Map([['pugaai-naic-admin-token', 'secret'], ['pugaai-naic-admin-state', 'authenticated'], ['pugaai-naic-admin-role', 'naic_admin']])
  const adapter = { removeItem: (key) => storage.delete(key) }
  clearNaicAdminSession(adapter)
  assert.equal(storage.size, 0)
})


test('NAIC admin API contract uses a separate admin authentication scope', () => {
  const api = requireApiText()
  assert.match(api, /\/api\/v1\/admin\/auth\/login/)
  assert.match(api, /scope: 'naic_validation'/)
  assert.match(api, /\/api\/v1\/admin\/auth\/logout/)
  assert.match(api, /requestNaicAdmin\('\/api\/v1\/naic\/validation'\)/)
})

function requireApiText() {
  return fs.readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8')
}
