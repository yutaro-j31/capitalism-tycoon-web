const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, extractEventHandlers } = require('./harness');

const INDEX = path.join(ROOT, 'index.html');
const MODULES = ['runtime.js','data.js','workforce.js','supply.js','competitor.js','competitor-projects.js','competitor-entry.js','competitor-credit.js','competitor-distress.js','market.js','finance.js','engine.js','save-v9.js','expansion.js','competitor-media.js','completion.js','parity.js','competitor-parity.js','competitor-dashboard.js','app.js'];
function fail(message) { console.error(message); process.exit(1); }
function assertLfNoBom(file) { const b = fs.readFileSync(file); if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) fail(`${file} has UTF-8 BOM`); const text = b.toString('utf8'); if (/\r/.test(text)) fail(`${file} must use LF line endings`); }

const html = readIndex();
const scripts = extractScripts(html);
assertLfNoBom(INDEX);
for (const name of MODULES) {
  const file = path.join(ROOT, 'js', name);
  if (!fs.existsSync(file)) fail(`js/${name} is missing`);
  assertLfNoBom(file);
  if (!fs.readFileSync(file, 'utf8').trim()) fail(`js/${name} is empty`);
}
const srcs = scripts.filter(s => s.src).map(s => s.src);
const expected = MODULES.map(n => `./js/${n}`);
if (JSON.stringify(srcs) !== JSON.stringify(expected)) fail(`script order mismatch: ${JSON.stringify(srcs)}`);
for (const s of scripts) {
  if (s.parsedAttrs.type !== undefined) fail(`${s.src} must remain a classic script without type/module`);
  if (s.parsedAttrs.defer !== undefined || s.parsedAttrs.async !== undefined) fail(`${s.src} must not use defer or async`);
}
const inlineLarge = scripts.filter(s => !s.src && s.code.trim().length > 1000);
if (inlineLarge.length) fail(`large executable inline script remains in index.html: ${inlineLarge.length}`);
if (/https?:\/\/[^"']+\.js/i.test(html)) fail('new external CDN JavaScript reference detected');
for (const [i, s] of scripts.entries()) {
  const type = (s.parsedAttrs.type || '').toLowerCase();
  if (type && !/^(text|application)\/javascript$/.test(type)) continue;
  try { new vm.Script(s.code, { filename: s.src || `index.html <script #${i + 1}> line ${s.startLine}` }); }
  catch (e) { fail(`script #${i + 1} syntax failed: ${e.message}`); }
}
for (const h of extractEventHandlers(html)) {
  try { new vm.Script(`(function(event){${h.code}\n})`, { filename: `index.html ${h.name} line ${h.line}` }); }
  catch (e) { fail(`${h.name} at line ${h.line}: ${e.message}`); }
}
console.log('javascript extraction checks passed');
