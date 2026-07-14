const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, extractEventHandlers } = require('./harness');

const INDEX = path.join(ROOT, 'index.html');
const APP_JS = path.join(ROOT, 'js', 'app.js');
const BASELINE = path.join(ROOT, 'tests', 'fixtures', 'embedded-javascript-baseline.js');

function fail(message) { console.error(message); process.exit(1); }
function normalizeNewlines(s) { return s.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'); }
function normalizeForIdentity(s) {
  return normalizeNewlines(s)
    .replace(/^\/\/ Script boundary: index\.html original inline script #\d+ \(classic JavaScript\)\n/gm, '')
    .replace(/^\n+|\n+$/g, '');
}
function assertLfNoBom(file) {
  const b = fs.readFileSync(file);
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) fail(`${file} has UTF-8 BOM`);
  const text = b.toString('utf8');
  if (/\r/.test(text)) fail(`${file} must use LF line endings`);
}

const html = readIndex();
const scripts = extractScripts(html);
if (!/<script\s+src="\.\/js\/app\.js"\s*><\/script>/i.test(html)) fail('index.html must reference ./js/app.js exactly as a classic script');
if (!fs.existsSync(APP_JS)) fail('js/app.js is missing');
if (!fs.existsSync(BASELINE)) fail('embedded JavaScript baseline fixture is missing');
assertLfNoBom(INDEX);
assertLfNoBom(APP_JS);
assertLfNoBom(BASELINE);
if (!fs.readFileSync(APP_JS, 'utf8').trim()) fail('js/app.js is empty');
const appScripts = scripts.filter(s => s.src === './js/app.js');
if (appScripts.length !== 1) fail(`expected exactly one ./js/app.js script, found ${appScripts.length}`);
if (appScripts[0].parsedAttrs.type !== undefined) fail('./js/app.js must remain a classic script without type/module');
if (appScripts[0].parsedAttrs.defer !== undefined || appScripts[0].parsedAttrs.async !== undefined) fail('./js/app.js must not use defer or async');
const inlineLarge = scripts.filter(s => !s.src && normalizeForIdentity(s.code).length > 1000);
if (inlineLarge.length) fail(`large executable inline script remains in index.html: ${inlineLarge.length}`);
if (/https?:\/\/[^"']+\.js/i.test(html)) fail('new external CDN JavaScript reference detected');
const app = fs.readFileSync(APP_JS, 'utf8');
const baseline = fs.readFileSync(BASELINE, 'utf8');
if (normalizeForIdentity(app) !== normalizeForIdentity(baseline)) fail('js/app.js differs from embedded JavaScript baseline fixture');
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
