import assert from 'node:assert/strict'
import { getPugaAccessChannelMeta, normalizePugaAccessSession, isPugaAccessSessionExpired } from '../src/services/pugaaccess.js'

const ivr = getPugaAccessChannelMeta('ivr')
assert.equal(ivr.label, 'IVR / Voice')
assert.equal(ivr.lowBandwidth, true)
assert.equal(getPugaAccessChannelMeta('unknown').label, 'PugaAccess')

const session = normalizePugaAccessSession({ sessionId: 'PA-123', channel: 'ussd', status: 'active', continuitySupported: true, expiresAt: '2099-01-01T00:00:00Z' })
assert.equal(session.channel, 'ussd')
assert.equal(session.continuitySupported, true)
assert.equal(isPugaAccessSessionExpired(session), false)
assert.equal(isPugaAccessSessionExpired({ expiresAt: '2000-01-01T00:00:00Z' }), true)
console.log('pugaaccess.test.mjs: PASS')
