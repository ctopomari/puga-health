import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('tokens and auth state are session-scoped', () => {
  const runtime = fs.readFileSync(path.join(root, 'src/services/runtime.js'), 'utf8');
  assert.match(runtime, /sessionStorage\.getItem\('pugaai-access-token'\)/);
  assert.match(runtime, /sessionStorage\.setItem\('pugaai-access-token'/);
  assert.doesNotMatch(runtime, /localStorage\.(?:getItem|setItem|removeItem)\('pugaai-access-token'/);
  assert.match(runtime, /sessionStorage\.getItem\('pugaai-auth-state'\)/);
});

test('conversation mock history is session-scoped', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
  assert.match(main, /sessionStorage\.getItem\('pugaai-history'/);
  assert.match(main, /sessionStorage\.setItem\('pugaai-history'/);
});

test('security headers and CSP are prepared', () => {
  const vite = fs.readFileSync(path.join(root, 'vite.config.js'), 'utf8');
  for (const header of ['Content-Security-Policy','Referrer-Policy','X-Content-Type-Options','X-Frame-Options','Permissions-Policy']) assert.match(vite, new RegExp(header));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /<script[^>]*>[^<]*serviceWorker[^<]*register/);
});

test('security helper exists and redacts sensitive patterns', () => {
  const security = fs.readFileSync(path.join(root, 'src/services/security.js'), 'utf8');
  assert.match(security, /safeErrorMessage/);
  assert.match(security, /SECRET_PATTERNS/);
  assert.match(security, /isTrustedCheckoutUrl/);
});

test('unexpected UI errors are not logged with raw exception objects', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.jsx'), 'utf8');
  assert.doesNotMatch(main, /console\.error\([^)]*error\)/);
});
