const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// The README tells people to run these files. If one is renamed or moved, this fails instead of leaving them a broken command.
test('every script the README tells you to run exists', () => {
  const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
  const named = [...readme.matchAll(/\b((?:mac|windows)[\\/][\w.-]+\.(?:sh|ps1))/g)].map((m) => m[1].replace(/\\/g, '/'));
  assert.ok(named.length >= 8, `found ${named.length} script mentions`);
  for (const f of new Set(named)) assert.ok(fs.existsSync(path.join(__dirname, f)), `README mentions ${f} but it is missing`);
  for (const f of ['assets/whink-logo.png', 'assets/whink-logo.ico']) assert.ok(fs.existsSync(path.join(__dirname, f)), f);
});
