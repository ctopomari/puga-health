import assert from 'node:assert/strict'
import { getUserFacingError, canRetry, getLoadingLabel } from '../src/services/resilience.js'

// RED/GREEN contract: session expiry must not be retried.
assert.equal(canRetry({ code: 'SESSION_EXPIRED', status: 401 }), false)
assert.equal(getUserFacingError({ code: 'SESSION_EXPIRED', status: 401 }), 'Your session has expired. Please sign in again.')
assert.equal(getUserFacingError({ code: 'TIMEOUT' }), 'The request took too long. Check your connection and try again.')
assert.equal(canRetry({ status: 503, retryable: true }), true)
assert.equal(getLoadingLabel('access history'), 'Loading access history…')
console.log('resilience tests passed')
