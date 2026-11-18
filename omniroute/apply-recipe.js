#!/usr/bin/env node
// Creates the Claude Code combos in YOUR OmniRoute from recipe.json, using the providers YOU have connected.
// Nothing is copied from anyone else's setup: no keys, no accounts.
//
//   node omniroute/apply-recipe.js                    asks for your OmniRoute dashboard password
//   node omniroute/apply-recipe.js --dry-run          show what it would do, change nothing
//   node omniroute/apply-recipe.js --include-risky    also use providers OmniRoute marks tos: avoid (xkiro)
//   node omniroute/apply-recipe.js --url http://host:20128
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ZERO = { input: 0, output: 0, cached: 0, reasoning: 0, cache_creation: 0 };
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-');

// Pure: which combos can be built from the connections you have. No network.
function plan(recipe, connections, { includeRisky = false } = {}) {
  const have = new Map();
  for (const c of connections) if (c.isActive !== false && !have.has(c.provider)) have.set(c.provider, c);
  const missing = new Set(), risky = new Set(), prices = {};
  const combos = recipe.combos.map((combo) => {
    const models = [];
    for (const s of combo.steps) {
      if (s.risk && !includeRisky) { risky.add(s.provider); continue; }
      const conn = have.get(s.provider);
      if (!conn) { missing.add(s.provider); continue; }
      models.push({ id: `${combo.name}-model-${models.length + 1}-${slug(s.model)}-${conn.id}`, kind: 'model', model: `${s.provider}/${s.model}`, providerId: s.provider, connectionId: conn.id, weight: 0, label: conn.name || s.provider });
      if (s.free) (prices[s.provider] ||= {})[s.model] = ZERO;
    }
    return { name: combo.name, models };
  });
  return { combos, prices, missing: [...missing], risky: [...risky] };
}

async function apply({ url, password, recipe, includeRisky = false, dryRun = false, log = () => {}, fetchImpl = fetch }) {
  const base = url.replace(/\/+$/, '');
  const login = await fetchImpl(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
  if (!login.ok) throw new Error(`Login failed (${login.status}). Check the dashboard password.`);
  const cookie = (login.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; ');
  if (!cookie) throw new Error('Login worked but no session came back. Is this OmniRoute?');
  const call = async (method, p, body) => {
    const r = await fetchImpl(base + p, { method, headers: { cookie, 'content-type': 'application/json' }, body: body && JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${text.slice(0, 200)}`);
    return text ? JSON.parse(text) : {};
  };

  const conns = (await call('GET', '/api/providers')).connections || [];
  const existing = new Set(((await call('GET', '/api/combos')).combos || []).map((c) => c.name));
  const p = plan(recipe, conns, { includeRisky });
  const report = { created: [], kept: [], empty: [], missing: p.missing, risky: p.risky, priced: 0, dryRun };

  for (const c of p.combos) {
    if (existing.has(c.name)) { report.kept.push(c.name); continue; } // never overwrite a combo you already have
    if (!c.models.length) { report.empty.push(c.name); continue; }
    if (!dryRun) await call('POST', '/api/combos', { name: c.name, strategy: 'priority', models: c.models, config: { maxRetries: 1, retryDelayMs: 2000, fallbackDelayMs: 0, maxComboDepth: 3, trackMetrics: true } });
    report.created.push(`${c.name} (${c.models.length} steps)`);
  }
  const n = Object.values(p.prices).reduce((a, m) => a + Object.keys(m).length, 0);
  if (n && !dryRun) await call('PATCH', '/api/pricing', p.prices);
  report.priced = n;
  log(report);
  return report;
}

function askHidden(question) {
  return new Promise((resolve) => {
    let muted = false;
    const out = new (require('stream').Writable)({ write(chunk, _e, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
    const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
    rl.question(question, (a) => { rl.close(); process.stdout.write('\n'); resolve(a); });
    muted = true; // the prompt is already printed; what you type is not echoed
  });
}

function print(r) {
  const list = (a) => (a.length ? a.join(', ') : 'none');
  console.log(`\n${r.dryRun ? '[dry run, nothing changed]\n' : ''}Combos created:     ${list(r.created)}`);
  console.log(`Combos left alone:  ${list(r.kept)}   (you already had these)`);
  if (r.empty.length) console.log(`Combos not built:   ${list(r.empty)}   (none of their providers are connected yet)`);
  console.log(`Free models priced: ${r.priced}   (at $0, so a spend cap can be enforced)`);
  if (r.missing.length) console.log(`\nNot connected yet, so these steps were skipped: ${list(r.missing)}\nConnect them in the dashboard (Providers), then run this again. Combos you already have are never overwritten, so delete a combo first if you want it rebuilt.`);
  if (r.risky.length) console.log(`\nSkipped on purpose: ${list(r.risky)} (OmniRoute marks it tos: avoid, meaning your account could be at risk). Add --include-risky to use it anyway.`);
}

if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2), flag = (f) => args.includes(f), val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
    const recipe = JSON.parse(fs.readFileSync(path.join(__dirname, 'recipe.json'), 'utf8'));
    const password = process.env.OMNIROUTE_PASSWORD || (await askHidden('OmniRoute dashboard password: '));
    try { print(await apply({ url: val('--url', 'http://localhost:20128'), password, recipe, includeRisky: flag('--include-risky'), dryRun: flag('--dry-run') })); }
    catch (e) { console.error('\nStopped: ' + e.message); process.exit(1); }
  })();
}
module.exports = { plan, apply };
