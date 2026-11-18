// Chat export formats. Loaded by the page (window.EXPORT_FORMATS) and by the tests (require).
// A chat is { id, title, cwd, items: [{ role: 'user' | 'assistant' | 'tool', text }] }.
(function (root) {
  const who = { user: 'You', assistant: 'Claude', tool: 'Tool' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // A spreadsheet runs a cell that starts with = + - @ as a formula, so those get a leading apostrophe.
  const cell = (s) => `"${(/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`;

  const html = (c) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(c.title)}</title>
<style>body{font:15px/1.55 -apple-system,system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1f1e1d}
.m{white-space:pre-wrap;margin:0 0 1rem}.user{background:#efece3;padding:.6rem .9rem;border-radius:10px}.tool{color:#73726c;font:12px ui-monospace,Menlo,monospace}
h1{font-size:1.3rem}small{color:#73726c}</style></head><body><h1>${esc(c.title)}</h1><small>${esc(c.cwd || '')}</small>
${c.items.map((i) => `<div class="m ${i.role}">${i.role === 'tool' ? '' : `<b>${who[i.role]}</b><br>`}${esc(i.text)}</div>`).join('\n')}
</body></html>`;

  const formats = {
    md: { ext: 'md', mime: 'text/markdown', build: (c) => `# ${c.title}\n\n` + c.items.map((i) => (i.role === 'tool' ? `> Tool: ${i.text}` : `## ${who[i.role]}\n\n${i.text}`)).join('\n\n') + '\n' },
    txt: { ext: 'txt', mime: 'text/plain', build: (c) => `${c.title}\n\n` + c.items.map((i) => `${who[i.role]}:\n${i.text}`).join('\n\n') + '\n' },
    json: { ext: 'json', mime: 'application/json', build: (c) => JSON.stringify({ title: c.title, id: c.id, folder: c.cwd, exportedAt: new Date().toISOString(), messages: c.items }, null, 2) },
    csv: { ext: 'csv', mime: 'text/csv', build: (c) => 'role,text\n' + c.items.map((i) => `${i.role},${cell(i.text)}`).join('\n') + '\n' },
    html: { ext: 'html', mime: 'text/html', build: html },
    // Word opens an HTML file saved as .doc, which avoids shipping a real .docx writer.
    doc: { ext: 'doc', mime: 'application/msword', build: html },
  };
  root.EXPORT_FORMATS = formats;
  if (typeof module !== 'undefined') module.exports = formats;
})(typeof window !== 'undefined' ? window : globalThis);
