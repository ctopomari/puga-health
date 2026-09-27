import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8')

assert.match(main, /CARE_STAGES/)
assert.match(main, /Find care/)
assert.match(main, /Choose facility/)
assert.match(main, /Choose provider/)
assert.match(main, /Appointment/)
assert.match(main, /Consultation/)
assert.match(main, /Lab \/ medication/)
assert.match(main, /Follow-up/)
assert.match(main, /CareJourneyStrip/)
assert.match(main, /authorized Puga services/)
assert.match(css, /care-journey-strip/)
assert.match(css, /care-journey-steps/)
assert.match(css, /care-journey-step/)
console.log('Care journey tests passed: 11 assertions')
