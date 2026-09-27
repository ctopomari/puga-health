import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('design system exports canonical version and token groups', async () => {
  const mod = await import(path.join(root, 'src/design-system.js'));
  assert.equal(mod.DESIGN_SYSTEM_VERSION, '1.4.0');
  assert.equal(mod.PUGA_DESIGN_TOKENS.color.purple, '#4b126f');
  assert.equal(mod.PUGA_DESIGN_TOKENS.color.gold, '#d9a52d');
  assert.equal(mod.PUGA_DESIGN_TOKENS.spacing.md, '12px');
  assert.equal(mod.PUGA_DESIGN_TOKENS.radius.xl, '20px');
});

test('styles define shared design-system primitives', () => {
  const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  for (const token of ['--space-1','--space-7','--radius-xl','--focus-ring','--font-body']) assert.match(css, new RegExp(token.replace(/[-]/g, '\\-')));
  for (const cls of ['.ds-card','.ds-chip','.ds-status','.ds-divider','.ds-visually-hidden','.ds-field','.ds-skeleton']) assert.match(css, new RegExp('\\'+cls));
});

test('design-system documentation exists', () => {
  const doc = fs.readFileSync(path.join(root, 'DESIGN_SYSTEM.md'), 'utf8');
  assert.match(doc, /PugaAI Health Design System v1\.3\.1/);
  assert.match(doc, /Accessibility/);
  assert.match(doc, /Responsive contract/);
});
