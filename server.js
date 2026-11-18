// Local chat UI for Claude Code. Run: node server.js  ->  http://127.0.0.1:3030
const http = require('http');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { listSessions, findSession, transcript } = require('./parse');
const { makeZip, makeDocx } = require('./docx');
const EXPORT_FORMATS = require('./export');
const { isApproval } = require('./rules');

const PORT = process.env.PORT === undefined ? 3030 : Number(process.env.PORT);
// Read per request. Default: the usual install spot if it exists, else whatever `claude` is on PATH.
const EXE = process.platform === 'win32' ? 'claude.exe' : 'claude';
const claudeBin = () => process.env.CLAUDE_BIN || (fs.existsSync(path.join(os.homedir(), '.local', 'bin', EXE)) ? path.join(os.homedir(), '.local', 'bin', EXE) : 'claude');
const MAX_TURNS = process.env.CLAUDE_UI_MAX_TURNS || '60'; // a stuck loop must end on its own
const UPLOADS = process.env.CLAUDE_UI_UPLOADS || path.join(os.homedir(), '.claude-local-ui', 'uploads');
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const MAX_BODY = 1_000_000;        // typed text per message
const MAX_UPLOAD = 25 * 1024 * 1024; // per attached file
const SHOW_LAST = 200;

// Runs without asking: web search and lookups that cannot change anything. Everything else is refused
// and shown to you as an approval card (the browser sends back an exact-command rule for one run).
const READ_ONLY = [
  'WebSearch',
  'Bash(gh auth status:*)', 'Bash(gh repo view:*)', 'Bash(gh pr list:*)', 'Bash(gh pr view:*)', 'Bash(gh pr diff:*)',
  'Bash(gh issue list:*)', 'Bash(gh issue view:*)', 'Bash(gh run list:*)', 'Bash(gh run view:*)',
  'Bash(composio search:*)', 'Bash(composio connections list:*)',
];
// Picker contents: your OmniRoute combos plus its plain Anthropic models, read live from the gateway named in settings.json.
async function models() {
  let env = {};
  try { env = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude/settings.json'), 'utf8')).env || {}; } catch {}
  const fallback = { default: env.ANTHROPIC_MODEL || '', models: env.ANTHROPIC_MODEL ? [env.ANTHROPIC_MODEL] : [] };
  if (!env.ANTHROPIC_BASE_URL) return { ...fallback, status: 'none' };
  try {
    const r = await fetch(env.ANTHROPIC_BASE_URL.replace(/\/$/, '') + '/v1/models', { headers: { authorization: `Bearer ${env.ANTHROPIC_AUTH_TOKEN}` }, signal: AbortSignal.timeout(8000) });
    const ids = (await r.json()).data.map((m) => m.id);
    const combos = ids.filter((i) => i.startsWith('claude-code'));
    const paid = ids.filter((i) => i.startsWith('anthropic/') && !/-(low|medium|high|xhigh|max)$/.test(i));
    return { default: fallback.default, models: [...combos, ...paid], status: 'up' };
  } catch { return { ...fallback, status: 'down' }; } // unreachable, or the key was refused
}

// Is Claude Code startable? Checked at most once a minute.
let claudeCheck = { at: 0, bin: '', ok: false };
const claudeFound = () => {
  const bin = claudeBin();
  if (bin !== claudeCheck.bin || Date.now() - claudeCheck.at > 60_000) claudeCheck = { at: Date.now(), bin, ok: spawnSync(bin, ['--version'], { timeout: 5000 }).status === 0 };
  return claudeCheck.ok;
};

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };

// Each upload gets its own random folder: UPLOADS/<16 hex>/<name>. A chat can read only the upload folders its own text mentions.
const slashes = (x) => String(x).replace(/\\+/g, '/'); // Windows paths use backslashes, and JSON doubles them
const UPLOAD_ID = new RegExp(slashes(UPLOADS).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/([0-9a-f]{16})/', 'gi');
const uploadDirsIn = (...texts) => [...new Set(texts.flatMap((t) => [...slashes(t).matchAll(UPLOAD_ID)].map((m) => path.join(UPLOADS, m[1].toLowerCase()))))].filter((d) => fs.existsSync(d));
// Delete upload folders not touched for N days (default 30).
function pruneUploads(days = Number(process.env.CLAUDE_UI_UPLOAD_DAYS) || 30) {
  const cutoff = Date.now() - days * 864e5; let removed = 0;
  for (const d of fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS) : []) {
    const p = path.join(UPLOADS, d);
    if (fs.statSync(p).mtimeMs < cutoff) { fs.rmSync(p, { recursive: true, force: true }); removed++; }
  }
  return removed;
}

const safeName = (t) => (String(t).replace(/[^\w -]+/g, '').trim().slice(0, 60) || 'chat');
const download = (res, buf, type, name) => { res.writeHead(200, { 'content-type': type, 'content-disposition': `attachment; filename="${name}"` }); res.end(buf); };

// Collect a request body up to `max` bytes; answers 413 and stops reading when it is bigger.
function readBody(req, res, max, done) {
  const parts = []; let n = 0;
  req.on('data', (c) => {
    n += c.length;
    if (n > max) { send(res, 413, { error: `too large (limit ${max} bytes)` }); req.destroy(); return; }
    parts.push(c);
  });
  req.on('end', () => { if (!res.writableEnded) done(Buffer.concat(parts)); });
}

// Inside your home folder, after following ../ and symlinks? (works for Windows paths too)
const homeReal = () => fs.realpathSync(os.homedir());
const insideHome = (real) => { const rel = path.relative(homeReal(), real); return !rel.startsWith('..') && !path.isAbsolute(rel); };
// An existing folder inside your home directory, as its real path, or null.
const resolveDir = (d) => {
  try {
    if (typeof d !== 'string' || !path.isAbsolute(d)) return null;
    const real = fs.realpathSync(d);
    return insideHome(real) && fs.statSync(real).isDirectory() ? real : null;
  } catch { return null; }
};
// Same, but creates the folder (and parents) if it does not exist yet. Checks the nearest existing parent so ../ tricks fail.
const makeDir = (d) => {
  try {
    if (typeof d !== 'string' || !path.isAbsolute(d)) return null;
    let near = path.resolve(d); while (!fs.existsSync(near)) near = path.dirname(near);
    if (!insideHome(fs.realpathSync(near))) return null;
    fs.mkdirSync(path.resolve(d), { recursive: true });
    return resolveDir(path.resolve(d));
  } catch { return null; }
};

// Projects: a name plus a folder. Chats started in that folder belong to the project. Stored in one small file.
const dataDir = () => process.env.CLAUDE_UI_DATA || path.join(os.homedir(), '.claude-local-ui');
const projectsFile = () => path.join(dataDir(), 'projects.json');
const loadProjects = () => { try { return JSON.parse(fs.readFileSync(projectsFile(), 'utf8')); } catch { return []; } };
const saveProjects = (list) => { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(projectsFile(), JSON.stringify(list, null, 2)); };
const withAlive = (p) => ({ ...p, alive: fs.existsSync(p.cwd) });
function createProject(name, wanted) {
  const clean = String(name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 60);
  if (!clean) return { error: 'give the project a name' };
  const folder = wanted ? makeDir(wanted) : makeDir(path.join(os.homedir(), 'Claude Projects', clean.replace(/[^\w .-]+/g, '_')));
  if (!folder) return { error: 'the folder must be inside your home folder' };
  const list = loadProjects(), same = list.find((p) => p.cwd === folder);
  if (same) return { project: withAlive(same), existing: true };
  const project = { id: 'p' + crypto.randomBytes(5).toString('hex'), name: clean, cwd: folder };
  saveProjects([...list, project]);
  return { project: withAlive(project) };
}

const server = http.createServer((req, res) => {
  // This server runs commands, so only the page itself may call it: block DNS-rebinding and cross-site posts.
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || '')) return send(res, 403, { error: 'bad host' });
  const url = new URL(req.url, 'http://x');

  if (req.method === 'GET' && url.pathname === '/') return send(res, 200, fs.readFileSync(path.join(__dirname, 'index.html')), 'text/html');
  if (req.method === 'GET' && url.pathname === '/rules.js') return send(res, 200, fs.readFileSync(path.join(__dirname, 'rules.js')), 'text/javascript');
  if (req.method === 'GET' && url.pathname === '/export.js') return send(res, 200, fs.readFileSync(path.join(__dirname, 'export.js')), 'text/javascript');
  if (req.method === 'GET' && url.pathname === '/api/sessions') return send(res, 200, listSessions(true).map(({ file, ...s }) => s));
  if (req.method === 'GET' && url.pathname === '/api/health') return models().then((m) => send(res, 200, { gateway: m.status, claude: claudeFound() }));
  if (req.method === 'GET' && url.pathname === '/api/models') return models().then((m) => send(res, 200, m));

  // Every chat as a Markdown file inside one zip.
  if (req.method === 'GET' && url.pathname === '/api/export-all.zip') {
    const files = listSessions(true).map((s) => ({ name: `${safeName(s.title)}-${s.id.slice(0, 8)}.md`, data: Buffer.from(EXPORT_FORMATS.md.build({ ...s, items: transcript(s.file).items })) }));
    return download(res, makeZip(files), 'application/zip', 'claude-chats.zip');
  }
  const word = url.pathname.match(/^\/api\/sessions\/([^/]+)\/export\.docx$/);
  if (req.method === 'GET' && word) {
    const s = findSession(word[1]);
    if (!s) return send(res, 404, { error: 'unknown session' });
    return download(res, makeDocx({ ...s, items: transcript(s.file).items }), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', `${safeName(s.title)}.docx`);
  }

  if (req.method === 'POST' && url.pathname === '/api/upload') {
    if (req.headers['x-ui'] !== '1') return send(res, 405, { error: 'method not allowed' });
    return readBody(req, res, MAX_UPLOAD, (buf) => {
      const name = path.basename(url.searchParams.get('name') || 'file').replace(/[^\w.-]+/g, '_').slice(-80) || 'file';
      const dir = path.join(UPLOADS, crypto.randomBytes(8).toString('hex'));
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, name);
      fs.writeFileSync(file, buf);
      send(res, 200, { path: file, bytes: buf.length });
    });
  }

  if (url.pathname === '/api/projects') {
    if (req.method === 'GET') return send(res, 200, loadProjects().map(withAlive));
    if (req.method === 'POST' && req.headers['x-ui'] === '1') return readBody(req, res, 10_000, (raw) => {
      let b; try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
      const r = createProject(b.name, b.path || '');
      send(res, r.error ? 400 : 200, r);
    });
  }
  const proj = url.pathname.match(/^\/api\/projects\/(p[0-9a-f]{10})$/);
  if (proj && req.method === 'DELETE' && req.headers['x-ui'] === '1') { // removes the entry only; the folder and its chats stay
    saveProjects(loadProjects().filter((p) => p.id !== proj[1]));
    return send(res, 200, { ok: true });
  }

  const m = url.pathname.match(/^\/api\/sessions\/([^/]+)(\/send)?$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const id = m[1];
  const known = id === 'new' ? null : findSession(id);
  if (id !== 'new' && !known) return send(res, 404, { error: 'unknown session' });

  if (req.method === 'GET' && !m[2]) return send(res, 200, transcript(known.file, url.searchParams.has('all') ? 0 : SHOW_LAST));

  if (req.method === 'POST' && m[2] && req.headers['x-ui'] === '1') {
    return readBody(req, res, MAX_BODY, (raw) => {
      let b;
      try { b = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
      // A new chat may start only in a project folder or a folder you already use with Claude Code.
      const cwd = known ? known.cwd : [...loadProjects().map((p) => p.cwd), ...listSessions().map((s) => s.cwd)].find((c) => c && c === b.cwd);
      if (!cwd || !b.text) return send(res, 400, { error: 'need text and a known folder' });
      if (!fs.existsSync(cwd)) return send(res, 400, { error: `That chat's folder no longer exists: ${cwd}` });
      const allow = b.allow ?? [], asked = b.dirs ?? [];
      if (!Array.isArray(allow) || allow.length > 5 || !allow.every(isApproval)) return send(res, 400, { error: 'bad approval' });
      const dirs = Array.isArray(asked) && asked.length <= 5 ? asked.map(resolveDir) : [null];
      if (dirs.includes(null)) return send(res, 400, { error: 'attached folders must exist inside your home folder' });
      // auto = Claude Code's AI judge: routine dev commands flow, risky ones are refused and come back as approval cards.
      const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'auto', '--max-turns', MAX_TURNS];
      if (known) args.push('--resume', id);
      if (b.model) { if (!/^[\w][\w./:-]*$/.test(b.model)) return send(res, 400, { error: 'bad model' }); args.push('--model', b.model); }
      if (b.effort) { if (!EFFORTS.includes(b.effort)) return send(res, 400, { error: 'bad effort' }); args.push('--effort', b.effort); }
      const mine = uploadDirsIn(b.text, known ? fs.readFileSync(known.file, 'utf8') : ''); // only this chat's own uploads
      args.push(...[...dirs, ...mine].flatMap((d) => ['--add-dir', d]));
      args.push('--allowedTools', ...READ_ONLY, ...allow); // variadic flag: keep it last
      // Inherited ANTHROPIC_*/CLAUDE_CODE_* (e.g. from a launching app) would override ~/.claude/settings.json; let settings decide.
      const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(ANTHROPIC_|CLAUDE_CODE_)/.test(k)));
      const child = spawn(claudeBin(), args, { cwd, env });
      res.writeHead(200, { 'content-type': 'application/x-ndjson' });
      child.stdout.pipe(res);
      child.stderr.on('data', (d) => res.write(JSON.stringify({ type: 'stderr', text: String(d) }) + '\n'));
      child.on('error', (e) => res.end(JSON.stringify({ type: 'stderr', text: e.code === 'ENOENT' ? "Could not start Claude Code. Install it, or set CLAUDE_BIN to its full path." : e.message }) + '\n'));
      res.on('close', () => child.kill());
      child.stdin.end(b.text);
    });
  }
  send(res, 405, { error: 'method not allowed' });
});

if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => console.log(`Claude chats: http://127.0.0.1:${PORT}`));
  pruneUploads(); setInterval(pruneUploads, 6 * 3600e3).unref();
}
server.pruneUploads = pruneUploads;
server.createProject = createProject;
module.exports = server;
