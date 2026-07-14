const fs = require('node:fs');
const path = require('node:path');
const { ROOT, readIndex, BIDI } = require('./harness');

const html = readIndex();
const errors = [];
const cssHref = './css/app.css';
const cssPath = path.join(ROOT, 'css', 'app.css');
const baselinePath = path.join(ROOT, 'tests', 'fixtures', 'extracted-css-baseline.css');

function fail(message) { errors.push(message); }
function readBuffer(file) { return fs.existsSync(file) ? fs.readFileSync(file) : null; }
function normalizeLf(buf) { return Buffer.isBuffer(buf) ? buf.toString('utf8').replace(/\r\n?/g, '\n') : ''; }
function braceBalance(text) {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth < 0) return { ok: false, index: i, depth };
  }
  return { ok: depth === 0, index: text.length, depth };
}
function stripCssComments(text) { return text.replace(/\/\*[\s\S]*?\*\//g, ''); }

const linkRe = /<link\s+[^>]*rel=(['"])stylesheet\1[^>]*href=(['"])\.\/css\/app\.css\2|<link\s+[^>]*href=(['"])\.\/css\/app\.css\3[^>]*rel=(['"])stylesheet\4/i;
if (!linkRe.test(html)) fail('index.html must reference ./css/app.css as a stylesheet');
if (/href=(['"])\/css\/app\.css\1/i.test(html)) fail('stylesheet href must not be root-absolute');
if (!fs.existsSync(cssPath)) fail('referenced css/app.css is missing');

const styleBlocks = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
const largeStyleBlocks = styleBlocks.filter(m => m[1].trim().length > 200);
if (largeStyleBlocks.length) fail(`large static style block(s) remain in index.html: ${largeStyleBlocks.length}`);

const cssBuffer = readBuffer(cssPath);
if (cssBuffer) {
  const css = normalizeLf(cssBuffer);
  if (!css.trim()) fail('css/app.css must not be empty');
  if (cssBuffer.length >= 3 && cssBuffer[0] === 0xef && cssBuffer[1] === 0xbb && cssBuffer[2] === 0xbf) fail('css/app.css must not contain UTF-8 BOM');
  if (/\r/.test(cssBuffer.toString('binary'))) fail('css/app.css must use LF line endings');
  if (BIDI.test(css)) fail('css/app.css contains bidirectional Unicode control characters');
  const balance = braceBalance(stripCssComments(css));
  if (!balance.ok) fail(`css/app.css has unbalanced braces near index ${balance.index} depth ${balance.depth}`);
  for (const atRule of ['@media', '@supports', '@keyframes']) {
    const re = new RegExp(`${atRule.replace('@', '@(?:-[a-z]+-)?')}[^\\{]*\\{`, 'g');
    for (const match of css.matchAll(re)) {
      const tail = stripCssComments(css.slice(match.index));
      const b = braceBalance(tail);
      if (b.depth > 0) fail(`${atRule} block appears unterminated near index ${match.index}`);
    }
  }
  for (const match of css.matchAll(/url\(([^)]+)\)/g)) {
    const raw = match[1].trim().replace(/^['"]|['"]$/g, '');
    if (/^(?:data:|https?:|#|var\()/i.test(raw)) continue;
    const local = path.resolve(path.dirname(cssPath), raw.split(/[?#]/)[0]);
    if (!fs.existsSync(local)) fail(`CSS local asset reference is missing: ${raw}`);
  }
  if (/https?:\/\/|cdn\./i.test(css)) fail('css/app.css must not add external CDN references');
  if (!fs.existsSync(baselinePath)) fail('extracted CSS baseline fixture is missing');
  else {
    const baseline = normalizeLf(readBuffer(baselinePath)).trim();
    const current = css.trim();
    if (baseline !== current) fail('css/app.css differs from tests/fixtures/extracted-css-baseline.css');
  }
}

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('css extraction checks passed');
