const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, extractEventHandlers } = require('./harness');

const INDEX = path.join(ROOT, 'index.html');
const MODULES = fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).sort();
const REAL_ESTATE_CHAIN = ['real-estate.js','real-estate-development.js','real-estate-insurance-claims.js','real-estate-insurance-risk.js','real-estate-risk-mitigation.js','real-estate-safety-certification.js','real-estate-tenant-contracts.js','real-estate-tenant-leasing.js','real-estate-tenant-operations.js','real-estate-tenant-renewals.js','real-estate-tenant-collections.js','real-estate-rent-guarantee.js','real-estate-security-deposits.js','real-estate-property-insurance.js','real-estate-maintenance-reserves.js','real-estate-property-taxes.js','real-estate-mortgage-refinancing.js','real-estate-property-disposals.js','real-estate-redevelopment-projects.js','real-estate-property-management.js','real-estate-property-maintenance.js'];
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
const expected = new Set(MODULES.map(n => `./js/${n}`));
if (srcs.length!==new Set(srcs).size) fail('duplicate script reference in index.html');
if (srcs.length!==expected.size||srcs.some(src=>!expected.has(src))) fail(`script coverage mismatch: ${JSON.stringify(srcs)}`);
let previous=-1;
for(const name of REAL_ESTATE_CHAIN){const current=srcs.indexOf(`./js/${name}`);if(current<=previous)fail(`real-estate script order mismatch at ${name}`);previous=current;}
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
