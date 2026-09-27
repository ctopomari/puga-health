import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_MANIFEST.json'), 'utf8'))

test('Health ID uses the protected identity adapter and keeps identity separate from authorization', () => {
  assert.match(main, /aiHealthApi\.getProtectedHealthId\(\)/)
  assert.match(main, /Identity credential/)
  assert.match(main, /does not itself grant access to medical records/)
  assert.match(main, /Identify.*authenticate.*authorize.*permit/)
})

test('Access transparency exposes auditable event details without inventing backend records', () => {
  assert.match(main, /aiHealthApi\.getAccessLog\(\)/)
  assert.match(main, /Access event details/)
  assert.match(main, /Authoritative backend record/)
})

test('Privacy center exposes purpose-limited permission state and revocation', () => {
  assert.match(main, /aiHealthApi\.getPermissions\(\)/)
  assert.match(main, /aiHealthApi\.updatePermission\(/)
  assert.match(main, /Revoke permission/)
  assert.match(main, /Minimum necessary/)
})

test('Responsive privacy and identity styles are present', () => {
  assert.match(css, /privacy-flow/)
  assert.match(css, /identity-status/)
  assert.match(css, /access-explainer/)
  assert.match(css, /@media\(max-width:760px\)/)
})

test('Release manifest identifies current release as frontend-only', () => {
  assert.equal(manifest.version, '1.4.2')
  assert.equal(manifest.backendImplementation, false)
  assert.equal(manifest.pugaAccessRetained, true)
})
