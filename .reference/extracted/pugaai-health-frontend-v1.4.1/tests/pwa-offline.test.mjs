import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
test('PWA manifest declares standalone PugaAI Health app',()=>{const m=JSON.parse(fs.readFileSync(path.join(root,'public/manifest.webmanifest'),'utf8'));assert.equal(m.name,'PugaAI Health');assert.equal(m.display,'standalone');assert.ok(m.icons.length>=1)});
test('service worker contains offline navigation fallback',()=>{const s=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');assert.match(s,/addEventListener\(['"]fetch/);assert.match(s,/offline\.html/);assert.match(s,/skipWaiting/)});
test('index registers manifest and service worker',()=>{const s=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(s,/manifest\.webmanifest/);assert.match(s,/serviceWorker/)});
test('offline shell does not imply access to protected health data',()=>{const s=fs.readFileSync(path.join(root,'public/offline.html'),'utf8');assert.match(s,/protected health data/);assert.match(s,/need a connection/)});
