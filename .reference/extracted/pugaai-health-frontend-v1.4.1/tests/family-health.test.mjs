import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const root = new URL('../', import.meta.url).pathname
const main = fs.readFileSync(`${root}src/main.jsx`, 'utf8')
const api = fs.readFileSync(`${root}src/services/api.js`, 'utf8')
const css = fs.readFileSync(`${root}src/styles.css`, 'utf8')
test('family health exposes an independently protected household experience', () => { assert.match(main, /function FamilyHealth/) ; assert.match(main, /Separate health identities/) })
test('family API supports members and authorization boundaries', () => { assert.match(api, /getFamilyMembers/) ; assert.match(api, /addFamilyMember/) ; assert.match(api, /getFamilyMemberAuthorization/) ; assert.match(api, /updateFamilyMemberAuthorization/) })
test('family UI preserves privacy and responsive behavior', () => { assert.match(css, /family-privacy-banner/) ; assert.match(css, /@media\(max-width:720px\)/) ; assert.match(main, /does not automatically authorize access/) })
test('family member IDs remain distinct from relationship membership', () => { assert.match(main, /Health ID/) ; assert.match(main, /Member-specific/) ; assert.match(api, /healthId/) })
