// Reads Claude Code's own session files (~/.claude/projects/*/<id>.jsonl). No database, nothing copied.
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = process.env.CLAUDE_PROJECTS || path.join(os.homedir(), '.claude', 'projects');
const ID = /^[0-9a-f-]{36}$/;

// Drop harness noise from user turns; keep everything the person actually typed.
const clean = (t) =>
  t.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/<(command-message|command-name|local-command-[a-z]+)>[\s\S]*?<\/\1>/g, '')
    .replace(/<\/?command-args>/g, '')
    .trim();

// One JSONL line -> display items, or [] for lines that are not chat (hooks, queue ops, sidechains).
function lineToItems(line) {
  let o;
  try { o = JSON.parse(line); } catch { return []; }
  if (o.isSidechain || o.isMeta || !o.message || (o.type !== 'user' && o.type !== 'assistant')) return [];
  const c = o.message.content;
  const blocks = typeof c === 'string' ? [{ type: 'text', text: c }] : Array.isArray(c) ? c : [];
  const items = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      const text = o.type === 'user' ? clean(b.text) : b.text.trim();
      if (text) items.push({ role: o.type, text });
    } else if (b.type === 'tool_use') {
      items.push({ role: 'tool', text: `${b.name} ${JSON.stringify(b.input).slice(0, 160)}` });
    }
  }
  return items;
}

// Last `limit` messages (0 = all) plus the total, so a huge chat does not have to be sent or drawn whole.
function transcript(file, limit = 0) {
  const all = fs.readFileSync(file, 'utf8').split('\n').flatMap(lineToItems);
  return { total: all.length, items: limit ? all.slice(-limit) : all };
}

function head(file, bytes = 200_000, fromEnd = false) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size, start = fromEnd ? Math.max(0, size - bytes) : 0;
    const buf = Buffer.alloc(Math.min(bytes, size));
    return buf.toString('utf8', 0, fs.readSync(fd, buf, 0, buf.length, start));
  } finally { fs.closeSync(fd); }
}

// The title Claude Code itself stores (a name you set, else the auto-generated one); last entry wins.
function storedTitle(text) {
  const last = (key) => { let v = null; for (const m of text.matchAll(new RegExp(`"${key}":"((?:[^"\\\\]|\\\\.)*)"`, 'g'))) v = JSON.parse(`"${m[1]}"`); return v; };
  return last('customTitle') || last('aiTitle');
}

// Summary of one session file, or null when it holds no typed message.
function describe(file) {
  const lines = head(file).split('\n');
  const first = lines.flatMap(lineToItems).find((i) => i.role === 'user');
  if (!first) return null;
  let cwd = '';
  for (const l of lines) { const m = l.match(/"cwd":"((?:[^"\\]|\\.)*)"/); if (m) { cwd = JSON.parse(`"${m[1]}"`); break; } }
  const title = storedTitle(head(file, 200_000, true)) || storedTitle(lines.join('\n')) || first.text;
  return { id: path.basename(file, '.jsonl'), title: title.replace(/\s+/g, ' ').slice(0, 90), cwd, alive: !!cwd && fs.existsSync(cwd), mtime: fs.statSync(file).mtimeMs, file };
}

let cache = { at: 0, v: [] };
function listSessions(force = false) {
  if (!force && Date.now() - cache.at < 3000) return cache.v; // lookups reuse the list; only the sidebar refresh rescans
  const out = [];
  for (const dir of fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : []) {
    const d = path.join(ROOT, dir);
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith('.jsonl')) continue;
      const s = describe(path.join(d, f));
      if (s) out.push(s);
    }
  }
  cache = { at: Date.now(), v: out.sort((a, b) => b.mtime - a.mtime) };
  return cache.v;
}

// Direct lookup by id: no scan, and the id is checked first so it can never point outside ROOT.
function findSession(id) {
  if (!ID.test(id)) return null;
  for (const dir of fs.existsSync(ROOT) ? fs.readdirSync(ROOT) : []) {
    const file = path.join(ROOT, dir, id + '.jsonl');
    if (fs.existsSync(file)) return describe(file);
  }
  return null;
}

module.exports = { listSessions, findSession, transcript, lineToItems, storedTitle, ID };
