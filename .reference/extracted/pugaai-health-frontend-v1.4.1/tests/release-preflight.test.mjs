import test from 'node:test'
import assert from 'node:assert/strict'
import { validateReleaseConfig } from '../src/services/release-preflight.js'
const base = {appEnv:'production',apiMode:'live',apiBaseUrl:'https://api.example.org',channel:'web',requestTimeoutMs:15000,pugaAccessUrl:'https://access.example.org'}
test('valid production configuration passes',()=>assert.equal(validateReleaseConfig(base).ok,true))
test('production mock mode is rejected',()=>assert.match(validateReleaseConfig({...base,apiMode:'mock'}).errors.join(' '),/Production must use live/))
test('production HTTP is rejected',()=>assert.match(validateReleaseConfig({...base,apiBaseUrl:'http://api.example.org'}).errors.join(' '),/HTTPS/))
test('embedded API URL credentials are rejected',()=>assert.match(validateReleaseConfig({...base,apiBaseUrl:'https://key:secret@api.example.org'}).errors.join(' '),/credentials/))
test('missing live API URL is rejected',()=>assert.equal(validateReleaseConfig({...base,apiBaseUrl:''}).ok,false))
test('unsupported channel is rejected',()=>assert.equal(validateReleaseConfig({...base,channel:'fax'}).ok,false))
test('unsafe timeout is rejected',()=>assert.equal(validateReleaseConfig({...base,requestTimeoutMs:0}).ok,false))
test('unconfigured PugaAccess is surfaced',()=>assert.equal(validateReleaseConfig({...base,pugaAccessUrl:''}).warnings.length,1))
test('localhost HTTP allowed for development',()=>assert.equal(validateReleaseConfig({...base,appEnv:'development',apiBaseUrl:'http://localhost:3000'}).ok,true))
