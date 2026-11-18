const test = require('node:test');
const assert = require('node:assert');
const F = require('./export');

const chat = { id: 'x', title: 'A <b>"quoted"</b> chat', cwd: '/p', items: [
  { role: 'user', text: 'hello, "world"\nline two' }, { role: 'assistant', text: '=HYPERLINK("http://evil")' }, { role: 'tool', text: 'Bash ls' }] };

test('every format builds, with a name and a type', () => {
  for (const [k, f] of Object.entries(F)) { assert.ok(f.ext && f.mime && f.build(chat).length > 20, k); }
  assert.deepStrictEqual(Object.keys(F), ['md', 'txt', 'json', 'csv', 'html', 'doc']);
});

test('csv keeps commas, quotes and newlines in one cell, and defuses spreadsheet formulas', () => {
  const csv = F.csv.build(chat);
  assert.ok(csv.includes('user,"hello, ""world""\nline two"'));
  assert.ok(csv.includes(`assistant,"'=HYPERLINK(`)); // leading apostrophe stops it running as a formula
});

test('html escapes chat text so an exported page cannot run script', () => {
  const html = F.html.build({ ...chat, items: [{ role: 'user', text: '<script>alert(1)</script>' }] });
  assert.ok(!html.includes('<script>alert(1)'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('json round-trips the messages', () => {
  const j = JSON.parse(F.json.build(chat));
  assert.deepStrictEqual(j.messages, chat.items);
  assert.strictEqual(j.title, chat.title);
});
