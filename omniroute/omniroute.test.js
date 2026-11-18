const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { plan, apply } = require('./apply-recipe');
const { mergeSettings, envFor } = require('./connect');

const recipe = JSON.parse(fs.readFileSync(path.join(__dirname, 'recipe.json'), 'utf8'));
const conn = (provider, extra = {}) => ({ id: `id-${provider}`, provider, name: provider, isActive: true, ...extra });
const THREE = [conn('nvidia'), conn('gemini'), conn('anthropic')];

test('recipe: only model names, no secrets, risky steps flagged', () => {
  const text = fs.readFileSync(path.join(__dirname, 'recipe.json'), 'utf8');
  assert.ok(!/sk-|nvapi|AIza|[0-9a-f]{8}-[0-9a-f]{4}-/.test(text), 'looks like it holds a key or an ID');
  assert.deepStrictEqual(recipe.combos.map((c) => c.name), ['claude-code-paid-middle', 'claude-code-paid-last']);
  for (const c of recipe.combos) for (const s of c.steps) if (s.provider === 'xkiro') assert.ok(s.risk, 'xkiro steps must be flagged');
});

test('plan: without xkiro the risky steps are skipped, free models are priced, paid ones are not', () => {
  const p = plan(recipe, THREE);
  const [mid, last] = p.combos;
  assert.strictEqual(mid.models.length, 7); assert.strictEqual(last.models.length, 6);
  assert.deepStrictEqual(p.risky, ['xkiro']); assert.deepStrictEqual(p.missing, []);
  assert.deepStrictEqual(Object.keys(p.prices).sort(), ['gemini', 'nvidia']); // anthropic is paid, not priced at $0
  assert.strictEqual(mid.models.at(-1).model, 'anthropic/claude-sonnet-5-5'); // paid fallback stays last
  assert.strictEqual(mid.models[0].connectionId, 'id-nvidia');
});

test('plan: --include-risky uses xkiro when connected; missing or inactive providers are reported and skipped', () => {
  const full = plan(recipe, [...THREE, conn('xkiro')], { includeRisky: true });
  assert.strictEqual(full.combos[0].models.length, 10);
  assert.strictEqual(full.combos[0].models[0].model, 'xkiro/mistralai/mistral-large-2512');
  const partial = plan(recipe, [conn('gemini'), conn('nvidia', { isActive: false })]);
  assert.deepStrictEqual(partial.missing.sort(), ['anthropic', 'nvidia']);
  assert.deepStrictEqual(partial.combos[0].models.map((m) => m.providerId), ['gemini', 'gemini']);
  assert.strictEqual(plan(recipe, []).combos[0].models.length, 0);
});

// A tiny stand-in for OmniRoute's management API and /v1/models.
async function fakeOmni({ connections = THREE, combos = [] } = {}) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = ''; req.on('data', (c) => (body += c));
    req.on('end', () => {
      const json = (code, o, h = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...h }); res.end(JSON.stringify(o)); };
      if (req.url === '/api/auth/login') return JSON.parse(body).password === 'pw' ? json(200, { success: true }, { 'set-cookie': 'auth_token=abc; Path=/; HttpOnly' }) : json(401, { error: 'Invalid password' });
      if (req.url === '/v1/models') return req.headers.authorization === 'Bearer goodkey' ? json(200, { data: [{ id: 'claude-code-paid-middle' }, { id: 'x' }] }) : json(401, {});
      if (!(req.headers.cookie || '').includes('auth_token=abc')) return json(401, { error: 'login first' });
      if (req.method === 'GET' && req.url === '/api/providers') return json(200, { connections, total: connections.length });
      if (req.method === 'GET' && req.url === '/api/combos') return json(200, { combos });
      seen.push({ method: req.method, url: req.url, body: body ? JSON.parse(body) : null });
      json(201, { ok: true });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() };
}

test('apply: logs in, creates the combos, prices the free models', async () => {
  const o = await fakeOmni();
  try {
    const r = await apply({ url: o.url, password: 'pw', recipe });
    assert.strictEqual(r.created.length, 2); assert.strictEqual(r.priced, 5);
    const posts = o.seen.filter((s) => s.method === 'POST'), patch = o.seen.find((s) => s.method === 'PATCH');
    assert.deepStrictEqual(posts.map((p) => p.body.name), ['claude-code-paid-middle', 'claude-code-paid-last']);
    assert.strictEqual(posts[0].body.strategy, 'priority');
    assert.deepStrictEqual(patch.body.nvidia['nvidia/nemotron-3-ultra-550b-a55b'], { input: 0, output: 0, cached: 0, reasoning: 0, cache_creation: 0 });
    assert.ok(!('anthropic' in patch.body));
  } finally { o.close(); }
});

test('apply: never overwrites a combo you already have; dry run changes nothing; wrong password stops', async () => {
  const o = await fakeOmni({ combos: [{ name: 'claude-code-paid-middle' }] });
  try {
    const r = await apply({ url: o.url, password: 'pw', recipe });
    assert.deepStrictEqual(r.kept, ['claude-code-paid-middle']); assert.strictEqual(r.created.length, 1);
    o.seen.length = 0;
    const dry = await apply({ url: o.url, password: 'pw', recipe, dryRun: true });
    assert.strictEqual(dry.created.length, 1); assert.strictEqual(o.seen.length, 0); // nothing sent
    await assert.rejects(apply({ url: o.url, password: 'nope', recipe }), /Login failed \(401\)/);
  } finally { o.close(); }
});

test('connect: merges into settings.json, keeping everything else and the helper-agent pins', () => {
  const before = JSON.stringify({ theme: 'dark', env: { KEEP_ME: '1' }, enabledPlugins: { a: true } });
  const after = JSON.parse(mergeSettings(before, envFor('http://box:20128/v1/', 'k', 'combo')));
  assert.strictEqual(after.theme, 'dark'); assert.deepStrictEqual(after.enabledPlugins, { a: true });
  assert.strictEqual(after.env.KEEP_ME, '1');
  assert.strictEqual(after.env.ANTHROPIC_BASE_URL, 'http://box:20128'); // trailing slash and /v1 removed
  for (const k of ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'CLAUDE_CODE_SUBAGENT_MODEL']) assert.strictEqual(after.env[k], 'combo', k);
  assert.ok(JSON.parse(mergeSettings('', {})).env); // a missing file is fine
  assert.throws(() => mergeSettings('{ not json', {}), /not valid JSON/); // the mistake that once broke a real settings.json
  assert.throws(() => mergeSettings('[1]', {}), /not a JSON object/);
});

test('connect (the real command): checks the key first, backs up, writes private file, never prints the key', async () => {
  const o = await fakeOmni(); const home = fs.mkdtempSync(path.join(os.tmpdir(), 'conn-'));
  fs.mkdirSync(path.join(home, '.claude')); fs.writeFileSync(path.join(home, '.claude', 'settings.json'), '{"theme":"dark"}');
  // Async on purpose: the fake OmniRoute lives in this process and must be free to answer while the command runs.
  const run = (key) => new Promise((resolve) => execFile(process.execPath, [path.join(__dirname, 'connect.js'), '--url', o.url], { env: { ...process.env, HOME: home, OMNIROUTE_KEY: key } }, (err, stdout, stderr) => resolve({ status: err ? err.code : 0, stdout, stderr })));
  try {
    const bad = await run('wrongkey');
    assert.strictEqual(bad.status, 1); assert.match(bad.stderr, /refused that key/);
    assert.strictEqual(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8'), '{"theme":"dark"}'); // untouched on failure
    const ok = await run('goodkey');
    assert.strictEqual(ok.status, 0); assert.ok(!(ok.stdout + ok.stderr).includes('goodkey'));
    const file = path.join(home, '.claude', 'settings.json'), s = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.strictEqual(s.theme, 'dark'); assert.strictEqual(s.env.ANTHROPIC_AUTH_TOKEN, 'goodkey');
    assert.strictEqual(fs.statSync(file).mode & 0o077, 0); // owner-only
    assert.ok(fs.readdirSync(path.join(home, '.claude')).some((f) => f.startsWith('settings.json.bak-')));
  } finally { o.close(); }
});
