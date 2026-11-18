const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { makeZip, makeDocx, crc32 } = require('./docx');

const unzip = (buf, ...args) => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'z-')), 'a.zip'); fs.writeFileSync(f, buf); return (a) => execFileSync('unzip', [...a, f]).toString(); };

test('crc32 matches the known check value', () => assert.strictEqual(crc32(Buffer.from('123456789')), 0xcbf43926));

test('a zip passes the system unzip integrity test and returns the same bytes', () => {
  const big = 'x'.repeat(5000) + 'é✓';
  const z = unzip(makeZip([{ name: 'a.txt', data: Buffer.from('hello') }, { name: 'dir/ü.md', data: Buffer.from(big) }]));
  assert.match(z(['-t']), /No errors detected/);
  assert.strictEqual(z(['-p']), 'hello' + big); // -p prints every file, in order
});

test('docx: valid package, text escaped, control characters removed', () => {
  const z = unzip(makeDocx({ title: 'A & B <t>', cwd: '/p', items: [{ role: 'user', text: 'line1\nline2 <script> \u0007bell' }, { role: 'tool', text: 'Bash ls' }] }));
  assert.match(z(['-t']), /No errors detected/);
  const doc = z(['-p', '-q']);
  assert.ok(doc.includes('A &amp; B &lt;t&gt;') && doc.includes('&lt;script&gt;'));
  assert.ok(!doc.includes('\u0007') && doc.includes('<w:br/>'));
});
