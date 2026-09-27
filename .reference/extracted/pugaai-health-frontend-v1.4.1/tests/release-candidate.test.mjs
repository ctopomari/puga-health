import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (p) => readFileSync(join(root, p), 'utf8')

test('release candidate is version 1.4.2', () => {
  const manifest = JSON.parse(read('BUILD_MANIFEST.json'))
  assert.equal(manifest.version, '1.4.2')
  assert.equal(manifest.backend_included, false)
})

test('production security headers are configured in Vite', () => {
  const vite = read('vite.config.js')
  for (const header of ['Content-Security-Policy','Referrer-Policy','X-Content-Type-Options','X-Frame-Options','Permissions-Policy']) {
    assert.match(vite, new RegExp(header.replace(/-/g, '\\-')))
  }
})

test('PWA shell assets exist', () => {
  assert.equal(existsSync(join(root, 'public/manifest.webmanifest')), true)
  assert.equal(existsSync(join(root, 'public/sw.js')), true)
  assert.equal(existsSync(join(root, 'public/offline.html')), true)
})

test('official logo asset exists', () => {
  assert.equal(existsSync(join(root, 'public/puga-trinicare-official.png')), true)
})

test('no inline script remains in HTML', () => {
  const html = read('index.html')
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/i)
})

test('frontend package does not contain backend source', () => {
  const manifest = JSON.parse(read('BUILD_MANIFEST.json'))
  assert.equal(manifest.backendImplementation, false)
  assert.equal(manifest.backend_included, false)
})

test('NAIC validation evidence layer is configured', () => {
  const manifest = JSON.parse(read('BUILD_MANIFEST.json'))
  assert.equal(manifest.naicValidation.targetInteractions, 50)
  assert.equal(manifest.naicValidation.rawAudioStoredByDefault, false)
})
