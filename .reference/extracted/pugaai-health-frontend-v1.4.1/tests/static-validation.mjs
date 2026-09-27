import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve('.')
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'BUILD_MANIFEST.json'), 'utf8'))

const voiceStateMatches = main.match(/const \[voiceState, setVoiceState\] = useState/g) || []
assert.equal(voiceStateMatches.length, 1, 'voiceState must be declared exactly once')
assert.match(main, /Skip to main content/)
assert.match(main, /id=\"main-content\"/)
assert.match(main, /connection-banner/)
assert.equal(manifest.version, '1.4.2')
assert.equal(manifest.pugaAccessRetained, true)
assert.equal(manifest.backendImplementation, false)
assert.match(main, /New conversation/)
assert.match(main, /Response actions/)
assert.match(main, /submitConversationFeedback/)
assert.match(main, /onSpeak/)
assert.match(main, /onCopy/)
assert.match(main, /Privacy & Access Center/)
assert.match(main, /CareJourneyStrip/)
assert.match(main, /Puga Universal Health ID/)
assert.match(main, /getProtectedHealthId/)
assert.match(main, /getAccessLog/)
assert.match(main, /getPermissions/)
console.log('static validation passed')

assert.match(main, /NaicValidation/)
assert.match(main, /logNaicInteraction/)
assert.match(main, /NAIC validation session started/)
assert.match(main, /PugaAI_NAIC_Validation_Interactions\.csv/)
