import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(new URL('..', import.meta.url).pathname)
const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8')
const api = fs.readFileSync(path.join(root, 'src/services/api.js'), 'utf8')
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8')

assert.match(main, /PUGAPAY/)
assert.match(main, /Review before payment/i)
assert.match(main, /Puga platform fee/)
assert.match(main, /Payment method/i)
assert.match(main, /paymentState === 'ready'/)
assert.match(main, /Receipt|receipt/i)
assert.match(main, /transaction-details/)
assert.match(main, /Pending payment/) 
assert.match(api, /getPaymentTransactions/)
assert.match(api, /initiatePayment/)
assert.match(api, /checkoutUrl/)
assert.match(css, /payment-receipt/)
assert.match(css, /transaction-details/)
assert.match(css, /payment-status-banner/)
console.log('Payment UX tests passed: 13 assertions')
