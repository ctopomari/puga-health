import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8')

test('responsive shell defines tablet and mobile layout breakpoints', () => {
  assert.match(css, /@media\s*\(max-width:\s*1024px\)/)
  assert.match(css, /@media\s*\(max-width:\s*720px\)/)
})

test('mobile navigation has safe-area support', () => {
  assert.match(css, /env\(safe-area-inset-bottom\)/)
})

test('interactive controls expose minimum touch target sizing', () => {
  assert.match(css, /min-height:\s*44px/)
  assert.match(css, /min-width:\s*44px/)
})

test('main app shell uses responsive container and overflow protection', () => {
  assert.match(css, /overflow-x:\s*hidden/)
  assert.match(css, /max-width:\s*100%/)
})

test('responsive polish preserves accessibility preferences', () => {
  assert.match(css, /prefers-reduced-motion:reduce/)
  assert.match(main, /aria-label=/)
})
