#!/usr/bin/env node
// Points Claude Code (and Claude Chats) at an OmniRoute gateway by writing the right lines into ~/.claude/settings.json.
// It keeps everything else in that file, makes a backup first, and refuses to touch a file that is not valid JSON.
//
//   node omniroute/connect.js                               local OmniRoute
//   node omniroute/connect.js --url http://other-pc:20128   an OmniRoute on another computer
//   node omniroute/connect.js --model claude-code-paid-last
// It asks for your OmniRoute API key (typed hidden). The key is stored only in settings.json.
const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');

// One model name for everything, so helper agents also go through your combo instead of straight to a paid model.
const envFor = (url, key, model) => ({
  ANTHROPIC_BASE_URL: url.replace(/\/+$/, '').replace(/\/v1$/, ''),
  ANTHROPIC_AUTH_TOKEN: key,
  ANTHROPIC_MODEL: model,
  ANTHROPIC_DEFAULT_SONNET_MODEL: model,
  ANTHROPIC_DEFAULT_OPUS_MODEL: model,
  ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
  CLAUDE_CODE_SUBAGENT_MODEL: model,
});

// Pure: existing file text (or '') + the new env lines -> new file text. Throws if the file is not valid JSON.
function mergeSettings(text, env) {
  let data = {};
  if (text.trim()) { try { data = JSON.parse(text); } catch { throw new Error('settings.json is not valid JSON, so I did not touch it. Fix or move it, then run this again.'); } }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error('settings.json is not a JSON object, so I did not touch it.');
  return JSON.stringify({ ...data, env: { ...(data.env || {}), ...env } }, null, 2) + '\n';
}

function askHidden(question) {
  return new Promise((resolve) => {
    let muted = false;
    const out = new (require('stream').Writable)({ write(chunk, _e, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
    const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); resolve(a.trim()); });
    muted = true;
  });
}

async function main() {
  const args = process.argv.slice(2), val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
  const url = val('--url', 'http://localhost:20128'), model = val('--model', 'claude-code-paid-middle');
  const key = process.env.OMNIROUTE_KEY || (await askHidden('OmniRoute API key (typing is hidden): '));
  if (!key) throw new Error('No key entered.');

  // Check the key before writing anything.
  let models;
  try {
    const r = await fetch(url.replace(/\/+$/, '').replace(/\/v1$/, '') + '/v1/models', { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(r.status === 401 ? 'OmniRoute refused that key (401).' : `OmniRoute answered ${r.status}.`);
    models = (await r.json()).data.map((m) => m.id);
  } catch (e) { throw new Error(`Could not use ${url}: ${e.message} Nothing was changed.`); }
  if (!models.includes(model)) console.log(`Note: this OmniRoute has no model called "${model}" yet. Run apply-recipe.js first, or pass --model with a name it has.`);

  const file = path.join(os.homedir(), '.claude', 'settings.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const after = mergeSettings(before, envFor(url, key, model));
  if (before) fs.writeFileSync(`${file}.bak-${Date.now()}`, before, { mode: 0o600 });
  fs.writeFileSync(file, after, { mode: 0o600 });
  fs.chmodSync(file, 0o600); // the mode above only applies to a new file; a file that already existed keeps its old, looser one
  console.log(`Done. Claude Code now uses ${url} with the model "${model}". Previous settings saved next to ${file}.`);
}

if (require.main === module) main().catch((e) => { console.error('\nStopped: ' + e.message); process.exit(1); });
module.exports = { mergeSettings, envFor };
