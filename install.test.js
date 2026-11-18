const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

// Runs install.sh in dry-run mode with a controlled PATH, so nothing real is installed or required.
const install = (tools, args = []) => {
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'inst-')), home = fs.mkdtempSync(path.join(os.tmpdir(), 'home-'));
  for (const [name, body] of Object.entries(tools)) fs.writeFileSync(path.join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  const r = spawnSync('/bin/sh', [path.join(__dirname, 'mac', 'install.sh'), ...args], { env: { PATH: `${bin}:/usr/bin:/bin`, HOME: home, DRY_RUN: '1' }, encoding: 'utf8' });
  return { out: r.stdout + r.stderr, code: r.status };
};
const mac = { skip: process.platform !== 'darwin' && 'macOS only' };

test('nothing installed: every missing piece gets an install command, and Claude needs a sign-in', mac, () => {
  const { out, code } = install({ brew: 'exit 0' });
  assert.strictEqual(code, 0);
  for (const cmd of ['brew install node', 'brew install gh', 'claude.ai/install.sh']) assert.ok(out.includes(cmd), cmd);
  assert.match(out, /Run: claude/);
  assert.ok(!out.includes('tailscale')); // optional: only with the flag
});

test('everything installed: nothing is run', mac, () => {
  const { out } = install({ brew: 'exit 0', git: 'echo git', node: 'echo 22', claude: 'exit 0', gh: 'exit 0' });
  assert.ok(!out.includes('would run'), out);
  assert.match(out, /node: already installed \(v22\)/);
});

test('an old Node is replaced, and Tailscale is installed only when asked', mac, () => {
  const { out } = install({ brew: 'exit 0', git: 'echo git', node: 'echo 18', claude: 'exit 0', gh: 'exit 0' }, ['--with-tailscale']);
  assert.ok(out.includes('brew install node') && out.includes('brew install --cask tailscale'));
});

test('without Homebrew it prints the official install command and stops', mac, () => {
  const { out, code } = install({});
  assert.strictEqual(code, 1);
  assert.ok(out.includes('Homebrew/install/HEAD/install.sh'));
});
