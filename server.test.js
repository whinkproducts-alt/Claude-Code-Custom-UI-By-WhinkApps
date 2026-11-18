const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

// Fake projects folder and a stub `claude` that just prints its own arguments, set up before the server loads.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clui-'));
const home = path.join(tmp, 'home'); fs.mkdirSync(path.join(home, 'work'), { recursive: true }); fs.symlinkSync('/etc', path.join(home, 'escape'));
process.env.HOME = home; // folder checks are made against this fake home, never your real one
const proj = path.join(tmp, 'proj'); fs.mkdirSync(path.join(proj, 'p1'), { recursive: true }); // real layout: projects/<folder>/<id>.jsonl
const LIVE = '11111111-1111-1111-1111-111111111111', GONE = '22222222-2222-2222-2222-222222222222';
const sess = (id, cwd, n = 1) => fs.writeFileSync(path.join(proj, 'p1', id + '.jsonl'),
  Array.from({ length: n }, (_, i) => JSON.stringify({ type: 'user', cwd, message: { content: 'msg ' + i } })).join('\n'));
sess(LIVE, tmp, 300); sess(GONE, '/no/such/dir');
const stub = path.join(tmp, 'claude'); fs.writeFileSync(stub, '#!/bin/sh\ncat >/dev/null\n[ -n "$STUB_PID" ] && echo $$ > "$STUB_PID"\n[ -n "$STUB_SLEEP" ] && exec sleep "$STUB_SLEEP"\necho "{\\"type\\":\\"result\\",\\"args\\":\\"$*\\"}"\n', { mode: 0o755 });
process.env.CLAUDE_PROJECTS = proj; process.env.CLAUDE_BIN = stub; process.env.CLAUDE_UI_UPLOADS = path.join(tmp, 'uploads'); process.env.CLAUDE_UI_DATA = path.join(tmp, 'data');

const server = require('./server');
let port;
test.before(() => new Promise((r) => server.listen(0, '127.0.0.1', () => { port = server.address().port; r(); })));
test.after(() => server.close());

const call = (method, p, { headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
    let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => resolve({ status: res.statusCode, body: d }));
  });
  req.on('error', reject); req.end(body);
});
const post = (id, obj, headers = { 'x-ui': '1' }) => call('POST', `/api/sessions/${id}/send`, { headers, body: JSON.stringify(obj) });

test('only the page itself may call the server', async () => {
  assert.strictEqual((await call('GET', '/api/sessions', { headers: { host: 'evil.com' } })).status, 403);
  assert.strictEqual((await post(LIVE, { text: 'x' }, {})).status, 405); // no x-ui header
});

test('model and effort are checked before they reach the command line', async () => {
  assert.strictEqual((await post(LIVE, { text: 'x', model: '--dangerous' })).status, 400);
  assert.strictEqual((await post(LIVE, { text: 'x', effort: 'ultra' })).status, 400);
  assert.strictEqual((await post('..%2f..%2fetc', { text: 'x' })).status, 404);
});

test('a valid send resumes the right session with the chosen model and effort', async () => {
  const r = await post(LIVE, { text: 'hi', model: 'claude-code-paid-last', effort: 'low' });
  assert.strictEqual(r.status, 200);
  const args = JSON.parse(r.body.trim().split('\n').pop()).args;
  assert.match(args, new RegExp(`--resume ${LIVE}`));
  assert.match(args, /--permission-mode auto/); // the AI judge, not the blanket acceptEdits
  assert.match(args, /--model claude-code-paid-last/);
  assert.match(args, /--effort low/);
});

test('a chat whose folder was deleted gives a clear error', async () => {
  const r = await post(GONE, { text: 'hi' });
  assert.strictEqual(r.status, 400);
  assert.match(r.body, /no longer exists/);
});

test('opening a long chat returns only the last 200 messages, and ?all returns everything', async () => {
  const some = JSON.parse((await call('GET', `/api/sessions/${LIVE}`)).body);
  assert.deepStrictEqual([some.total, some.items.length, some.items.at(-1).text], [300, 200, 'msg 299']);
  assert.strictEqual(JSON.parse((await call('GET', `/api/sessions/${LIVE}?all`)).body).items.length, 300);
});

const lastArgs = (r) => JSON.parse(r.body.trim().split('\n').pop()).args;

test('read-only tools are always allowed; an approval adds exactly one command', async () => {
  const plain = lastArgs(await post(LIVE, { text: 'hi' }));
  assert.match(plain, /--allowedTools WebSearch Bash\(gh auth status:\*\)/);
  assert.doesNotMatch(plain, /gh repo delete/);
  const ok = lastArgs(await post(LIVE, { text: 'go', allow: ['Bash(gh repo list)'] }));
  assert.match(ok, /Bash\(gh repo list\)$/);
});

test('approvals cannot be widened: no wildcards, no other tools, no more than five, no smuggled second rule', async () => {
  const smuggled = ['Bash(x) Bash(rm -rf ~)', 'Bash(x),Bash(rm -rf ~)', 'Bash(echo hi) Bash(echo bye)', 'Bash((a)', 'Bash(a))'];
  for (const allow of [['Bash(gh *)'], ['Bash(rm -rf ~)\nBash(x)'], ['Edit(/etc/hosts)'], ['WebFetch(domain:a.com/../x)'], Array(6).fill('Bash(ls)'), 'Bash(ls)', ...smuggled.map((r) => [r])]) {
    assert.strictEqual((await post(LIVE, { text: 'x', allow })).status, 400, JSON.stringify(allow));
  }
  for (const allow of [['WebFetch(domain:example.com)'], ['Bash(echo $(date))'], ["Bash(python3 -c \"open('f','w').write('x')\")"]]) {
    assert.strictEqual((await post(LIVE, { text: 'x', allow })).status, 200, JSON.stringify(allow)); // normal brackets are fine
  }
});

test('attached folders: only real folders inside home, after resolving ../ and symlinks', async () => {
  const bad = ['/etc', path.join(home, '..', '..', 'etc'), path.join(home, 'escape'), path.join(home, 'nope'), 'work', path.join(home, 'work', '..', '..')];
  for (const d of bad) assert.strictEqual((await post(LIVE, { text: 'x', dirs: [d] })).status, 400, d);
  const ok = await post(LIVE, { text: 'x', dirs: [path.join(home, 'work', '..', 'work')] }); // ../ that stays inside is fine
  assert.strictEqual(ok.status, 200);
  assert.ok(lastArgs(ok).includes(`--add-dir ${fs.realpathSync(path.join(home, 'work'))}`)); // the cleaned real path is what is passed
});

test('every run has a turn cap', async () => {
  assert.match(lastArgs(await post(LIVE, { text: 'hi' })), /--max-turns 60/);
});

test('closing the request (Stop) kills the running claude', async () => {
  const pidFile = path.join(tmp, 'stub.pid'); process.env.STUB_PID = pidFile; process.env.STUB_SLEEP = '30';
  try {
    const req = http.request({ host: '127.0.0.1', port, method: 'POST', path: `/api/sessions/${LIVE}/send`, headers: { host: `127.0.0.1:${port}`, 'x-ui': '1' } }, (res) => res.resume());
    req.on('error', () => {}); req.end(JSON.stringify({ text: 'long job' }));
    let pid; for (let i = 0; i < 50 && !pid; i++) { await new Promise((r) => setTimeout(r, 100)); try { pid = Number(fs.readFileSync(pidFile, 'utf8')); } catch {} }
    assert.ok(pid, 'claude started');
    const alive = () => { try { process.kill(pid, 0); return true; } catch { return false; } };
    assert.ok(alive());
    req.destroy(); // what the Stop button does
    for (let i = 0; i < 50 && alive(); i++) await new Promise((r) => setTimeout(r, 100));
    assert.ok(!alive(), 'claude was killed');
  } finally { delete process.env.STUB_PID; delete process.env.STUB_SLEEP; }
});

test('a missing claude gives a plain-English error, not a crash', async () => {
  process.env.CLAUDE_BIN = '/no/such/claude';
  try { assert.match((await post(LIVE, { text: 'hi' })).body, /Could not start Claude Code/); } finally { process.env.CLAUDE_BIN = stub; }
});

test('uploads are saved in their own folder, names are cleaned, and 25 MB is the limit', async () => {
  const r = await call('POST', '/api/upload?name=..%2F..%2Fevil%20name.txt', { headers: { 'x-ui': '1' }, body: 'hello' });
  const { path: saved, bytes } = JSON.parse(r.body);
  assert.strictEqual(bytes, 5);
  assert.match(saved.slice(process.env.CLAUDE_UI_UPLOADS.length), /^\/[0-9a-f]{16}\/[\w.-]+$/);
  assert.ok(!saved.includes('..'), saved);
  assert.strictEqual(fs.readFileSync(saved, 'utf8'), 'hello');
  assert.strictEqual((await call('POST', '/api/upload?name=a', { body: 'x' })).status, 405); // no x-ui header
  const big = await call('POST', '/api/upload?name=big', { headers: { 'x-ui': '1' }, body: Buffer.alloc(26 * 1024 * 1024) }).catch((e) => ({ status: e.code }));
  assert.ok([413, 'ECONNRESET', 'EPIPE'].includes(big.status), String(big.status));
});

test('a chat can read only the uploads it mentions, new or from its own history', async () => {
  const up = async (n) => path.dirname(JSON.parse((await call('POST', `/api/upload?name=${n}`, { headers: { 'x-ui': '1' }, body: n })).body).path);
  const [mineNow, mineBefore, someoneElses] = [await up('a.txt'), await up('b.txt'), await up('c.txt')];
  fs.appendFileSync(path.join(proj, 'p1', LIVE + '.jsonl'), '\n' + JSON.stringify({ type: 'user', message: { content: `earlier I attached ${mineBefore}/b.txt` } }));
  const args = lastArgs(await post(LIVE, { text: `read ${mineNow}/a.txt` }));
  assert.ok(args.includes(`--add-dir ${mineNow}`) && args.includes(`--add-dir ${mineBefore}`));
  assert.ok(!args.includes(someoneElses) && !args.includes(`--add-dir ${process.env.CLAUDE_UI_UPLOADS} `));
});

test('old upload folders are deleted, fresh ones kept', () => {
  const root = process.env.CLAUDE_UI_UPLOADS, old = path.join(root, 'aaaaaaaaaaaaaaaa'), fresh = path.join(root, 'bbbbbbbbbbbbbbbb');
  for (const d of [old, fresh]) fs.mkdirSync(d, { recursive: true });
  const longAgo = new Date(Date.now() - 40 * 864e5); fs.utimesSync(old, longAgo, longAgo);
  assert.ok(server.pruneUploads(30) >= 1);
  assert.ok(!fs.existsSync(old) && fs.existsSync(fresh));
});

test('health reports the gateway and whether Claude Code can start', async () => {
  const health = async () => JSON.parse((await call('GET', '/api/health')).body);
  assert.deepStrictEqual(await health(), { gateway: 'none', claude: true }); // fake HOME has no settings.json, so no gateway
  process.env.CLAUDE_BIN = '/no/such/claude';
  try { assert.strictEqual((await health()).claude, false); } finally { process.env.CLAUDE_BIN = stub; }
});

test('gateway light: down when unreachable or the key is refused, up when it answers, and the model list is filtered', async () => {
  const settings = path.join(home, '.claude', 'settings.json'); fs.mkdirSync(path.dirname(settings), { recursive: true });
  const fake = http.createServer((req, res) => {
    if (req.headers.authorization !== 'Bearer good') { res.writeHead(401); return res.end('{}'); }
    res.end(JSON.stringify({ data: ['claude-code', 'claude-code-x', 'anthropic/claude-haiku-5-5', 'anthropic/claude-haiku-5-5-high', 'mistral/other'].map((id) => ({ id })) }));
  });
  await new Promise((r) => fake.listen(0, '127.0.0.1', r));
  const setGateway = (url, token) => fs.writeFileSync(settings, JSON.stringify({ env: { ANTHROPIC_BASE_URL: url, ANTHROPIC_AUTH_TOKEN: token, ANTHROPIC_MODEL: 'claude-code' } }));
  const health = async () => JSON.parse((await call('GET', '/api/health')).body).gateway;
  try {
    setGateway('http://127.0.0.1:9', 'good'); assert.strictEqual(await health(), 'down'); // nothing listening
    setGateway(`http://127.0.0.1:${fake.address().port}`, 'wrong'); assert.strictEqual(await health(), 'down'); // key refused
    setGateway(`http://127.0.0.1:${fake.address().port}`, 'good'); assert.strictEqual(await health(), 'up');
    const m = JSON.parse((await call('GET', '/api/models')).body);
    assert.deepStrictEqual(m.models, ['claude-code', 'claude-code-x', 'anthropic/claude-haiku-5-5']); // combos + plain Anthropic only, no effort variants
    assert.strictEqual(m.default, 'claude-code');
  } finally { fake.close(); fs.rmSync(settings); }
});

const api = async (method, p, obj) => { const r = await call(method, p, { headers: { 'x-ui': '1' }, body: obj && JSON.stringify(obj) }); return { status: r.status, json: r.body ? JSON.parse(r.body) : null }; };

test('projects: a new project gets a new folder inside home, and the same folder is not added twice', async () => {
  assert.deepStrictEqual((await api('GET', '/api/projects')).json, []);
  const a = await api('POST', '/api/projects', { name: 'My App' });
  assert.strictEqual(a.status, 200);
  assert.strictEqual(a.json.project.cwd, fs.realpathSync(path.join(home, 'Claude Projects', 'My App')));
  assert.ok(fs.statSync(a.json.project.cwd).isDirectory());
  const again = await api('POST', '/api/projects', { name: 'Renamed', path: a.json.project.cwd });
  assert.ok(again.json.existing && again.json.project.id === a.json.project.id);
  assert.strictEqual((await api('GET', '/api/projects')).json.length, 1);
});

test('projects: an existing or new nested folder inside home works; anything outside home is refused', async () => {
  const nested = await api('POST', '/api/projects', { name: 'Deep', path: path.join(home, 'a', 'b', 'c') });
  assert.strictEqual(nested.status, 200); assert.ok(fs.existsSync(path.join(home, 'a', 'b', 'c')));
  const mine = await api('POST', '/api/projects', { name: 'Work', path: path.join(home, 'work') });
  assert.strictEqual(mine.status, 200);
  for (const bad of ['/etc', '/tmp/clui-outside', path.join(home, '..', 'outside'), path.join(home, 'x', '..', '..', 'outside'), path.join(home, 'escape', 'sub'), 'relative/path']) {
    assert.strictEqual((await api('POST', '/api/projects', { name: 'Bad', path: bad })).status, 400, bad);
  }
  assert.ok(!fs.existsSync(path.join(tmp, 'outside')) && !fs.existsSync('/tmp/clui-outside')); // refused means nothing was created
  assert.strictEqual((await api('POST', '/api/projects', { name: '   ' })).status, 400);
});

test('projects: a new chat may start in a project folder (and only there or in a known folder); removing a project keeps the folder', async () => {
  const work = fs.realpathSync(path.join(home, 'work')), other = path.join(home, 'a');
  assert.strictEqual((await post('new', { text: 'hi', cwd: other })).status, 400); // not a project, no chats there
  assert.strictEqual((await post('new', { text: 'hi', cwd: work })).status, 200);
  const id = (await api('GET', '/api/projects')).json.find((p) => p.cwd === work).id;
  assert.strictEqual((await call('DELETE', `/api/projects/${id}`)).status, 404); // needs x-ui
  assert.strictEqual((await api('DELETE', `/api/projects/${id}`)).status, 200);
  assert.ok(fs.existsSync(work)); // the folder stays
  assert.ok(!(await api('GET', '/api/projects')).json.some((p) => p.id === id));
});

test('uploads are found even when the chat history holds Windows-style (doubled backslash) paths', async () => {
  const dir = path.dirname(JSON.parse((await call('POST', '/api/upload?name=w.txt', { headers: { 'x-ui': '1' }, body: 'w' })).body).path);
  fs.appendFileSync(path.join(proj, 'p1', LIVE + '.jsonl'), '\n' + JSON.stringify({ type: 'user', message: { content: dir.split('/').join('\\\\') + '\\\\w.txt' } }));
  assert.ok(lastArgs(await post(LIVE, { text: 'again' })).includes(`--add-dir ${dir}`));
});

test('the WhinkApps logo is served by exact name only', async () => {
  const r = await new Promise((resolve, reject) => http.get({ host: '127.0.0.1', port, path: '/assets/whink-logo-small.png', headers: { host: `127.0.0.1:${port}` } }, (res) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body: Buffer.concat(c) })); }).on('error', reject));
  assert.deepStrictEqual([r.status, r.type, r.body.subarray(1, 4).toString()], [200, 'image/png', 'PNG']);
  for (const p of ['/assets/whink-logo.png', '/assets/../server.js', '/assets/%2e%2e/server.js']) assert.strictEqual((await call('GET', p)).status, 404, p);
});

test('branding: the page shows the logo linked to the Whink website, and the package names the author', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'), pkg = require('./package.json');
  assert.match(html, /<a id="brand" href="https:\/\/whink-group\.onrender\.com\/[^"]*utm_source=github[^"]*" target="_blank" rel="noopener"[^>]*><img src="\/assets\/whink-logo-small\.png"/);
  assert.match(pkg.author, /^WhinkApps/); assert.strictEqual(pkg.license, 'Apache-2.0');
  assert.ok(fs.readFileSync(path.join(__dirname, 'NOTICE'), 'utf8').includes('WhinkApps'));
});
