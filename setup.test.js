const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Runs mac/setup.sh in dry-run mode with fake tools, so nothing is installed.
const setup = (args) => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-')), home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  fs.writeFileSync(path.join(bin, 'brew'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'node'), '#!/bin/sh\necho 18\n', { mode: 0o755 }); // an old Node: OmniRoute needs a newer one
  const r = spawnSync('/bin/sh', [path.join(__dirname, 'mac', 'setup.sh'), ...args], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, DRY_RUN: '1', TAILSCALE_APP: path.join(home, 'none') }, encoding: 'utf8' });
  return { out: r.stdout + r.stderr, code: r.status, home };
};
const mac = { skip: process.platform !== 'darwin' && 'macOS only' };

test('everything in order: prerequisites, OmniRoute, Desktop launcher, gateway', mac, () => {
  const { out, code, home } = setup(['--with-omniroute', '--gateway', 'http://pc.example:20128']);
  assert.strictEqual(code, 0, out);
  const at = (s) => { const i = out.indexOf(s); assert.ok(i >= 0, `missing: ${s}\n${out}`); return i; };
  const steps = ['mac/install.sh', 'brew install node', 'npm install -g omniroute', 'would run: omniroute', `build-launcher.sh ${home}/Desktop`, 'connect.js --url http://pc.example:20128'].map(at);
  assert.deepStrictEqual(steps, [...steps].sort((a, b) => a - b), 'steps out of order');
});

test('by default no OmniRoute is installed and no gateway is touched; the launcher still lands on the Desktop', mac, () => {
  const { out, home } = setup([]);
  assert.ok(!out.includes('omniroute') || out.includes('skipped (add --with-omniroute'));
  assert.ok(!out.includes('npm install -g') && !out.includes('connect.js --url'));
  assert.ok(out.includes(`build-launcher.sh ${home}/Desktop`));
});

test('an unknown option stops instead of being ignored', mac, () => {
  const { out, code } = setup(['--wat']);
  assert.notStrictEqual(code, 0); assert.match(out, /unknown option: --wat/);
});

test('the Windows setup script exists and reaches every step the Mac one does', () => {
  const ps = fs.readFileSync(path.join(__dirname, 'windows', 'setup.ps1'), 'utf8');
  for (const needle of ['install.ps1', 'npm install -g omniroute', 'build-launcher.ps1', 'connect.js', 'param(', '-DryRun']) assert.ok(ps.includes(needle), needle);
});
