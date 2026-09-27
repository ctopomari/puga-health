import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {CAPABILITIES, CHANNELS, INTEGRATION_VERSION, normalizeApiError} from '../src/services/integration-contract.js'
const api = fs.readFileSync(new URL('../src/services/api.js',import.meta.url),'utf8')
test('integration contract version is current',()=>assert.equal(INTEGRATION_VERSION,'1.0.8'))
test('PugaAccess supports IVR, USSD and SMS channels',()=>{for(const ch of ['pugaaccess-ivr','pugaaccess-ussd','pugaaccess-sms']) assert.ok(CHANNELS.includes(ch))})
test('every declared API route has a frontend adapter path',()=>{for(const [group,methods] of Object.entries(CAPABILITIES))for(const [name,route] of Object.entries(methods)){const path=route.split(' ').slice(1).join(' '); const prefix=path.split('/:')[0]; assert.ok(api.includes(prefix),`${group}.${name}: ${path} not found in frontend adapter`)}})
test('session expiry cannot be retried',()=>assert.deepEqual(normalizeApiError({status:401}).retryable,false))
test('server errors can be retried',()=>assert.equal(normalizeApiError({status:503}).retryable,true))
