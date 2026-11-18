const test = require('node:test');
const assert = require('node:assert');
const { lineToItems, storedTitle } = require('./parse');

test('stored title: your name beats the auto title, last one wins', () => {
  const t = '{"aiTitle":"Auto"}\n{"customTitle":"Mine"}\n{"aiTitle":"Later auto"}\n{"customTitle":"Mine 2"}';
  assert.strictEqual(storedTitle(t), 'Mine 2');
  assert.strictEqual(storedTitle('{"aiTitle":"Only auto"}'), 'Only auto');
  assert.strictEqual(storedTitle('{}'), null);
});

const L = (o) => JSON.stringify(o);

test('keeps typed text, drops harness noise and sidechains', () => {
  assert.deepStrictEqual(
    lineToItems(L({ type: 'user', message: { content: '<system-reminder>x</system-reminder>hello' } })),
    [{ role: 'user', text: 'hello' }]);
  assert.deepStrictEqual(lineToItems(L({ type: 'user', isSidechain: true, message: { content: 'hi' } })), []);
  assert.deepStrictEqual(lineToItems(L({ type: 'queue-operation' })), []);
  assert.deepStrictEqual(lineToItems('not json'), []);
});

test('assistant text and tool calls become items', () => {
  const items = lineToItems(L({ type: 'assistant', message: { content: [
    { type: 'text', text: 'done' }, { type: 'tool_use', name: 'Bash', input: { command: 'ls' } }] } }));
  assert.deepStrictEqual(items.map((i) => i.role), ['assistant', 'tool']);
});
