const fs = require('node:fs');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const TEXT_EXTENSIONS = new Set(['.html', '.js', '.json', '.yml', '.yaml', '.md', '.css']);
const EXCLUDED_DIRS = new Set(['.git', 'node_modules']);
const ALLOWED_EXISTING = new Set([
  'index.html:3382:154:U+200D',
  'js/app.js:3382:154:U+200D',
  'tests/fixtures/embedded-javascript-baseline.js:3381:154:U+200D'
]);

function isForbiddenCodePoint(codePoint, char) {
  if (codePoint >= 0x202A && codePoint <= 0x202E) return true;
  if (codePoint >= 0x2066 && codePoint <= 0x2069) return true;
  if (codePoint >= 0x200B && codePoint <= 0x200F) return true;
  if (codePoint === 0xFEFF || codePoint === 0x2028 || codePoint === 0x2029) return true;
  if (codePoint < 0x20 && char !== '\n' && char !== '\t') return true;
  if (codePoint >= 0x7F && codePoint <= 0x9F) return true;
  return false;
}

function locationFor(text, index) {
  let line = 1;
  let column = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') { line++; column = 1; }
    else column++;
  }
  return { line, column };
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) yield full;
  }
}

function checkFile(file) {
  const rel = path.relative(ROOT, file) || file;
  const data = fs.readFileSync(file);
  const findings = [];
  if (data.includes(0)) return findings;
  if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
    const item = { file: rel, line: 1, column: 1, codePoint: 'U+FEFF', reason: 'UTF-8 BOM' };
    if (!ALLOWED_EXISTING.has(`${item.file}:${item.line}:${item.column}:${item.codePoint}`)) findings.push(item);
  }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(data); }
  catch (error) { findings.push({ file: rel, line: 1, column: 1, codePoint: 'INVALID_UTF8', reason: error.message }); return findings; }
  if (text.includes('\r')) {
    for (let i = 0; i < text.length; i++) if (text[i] === '\r') {
      const loc = locationFor(text, i);
      const item = { file: rel, line: loc.line, column: loc.column, codePoint: 'U+000D', reason: 'CR/CRLF line ending' };
      if (!ALLOWED_EXISTING.has(`${item.file}:${item.line}:${item.column}:${item.codePoint}`)) findings.push(item);
    }
  }
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '\r') continue;
    const codePoint = char.codePointAt(0);
    if (codePoint > 0xFFFF) i++;
    if (!isForbiddenCodePoint(codePoint, char)) continue;
    const loc = locationFor(text, i);
    const item = { file: rel, line: loc.line, column: loc.column, codePoint: `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`, reason: 'forbidden invisible/control character' };
    if (!ALLOWED_EXISTING.has(`${item.file}:${item.line}:${item.column}:${item.codePoint}`)) findings.push(item);
  }
  return findings;
}

function checkRepository() {
  return [...walk(ROOT)].flatMap(checkFile);
}

if (require.main === module) {
  const findings = checkRepository();
  if (findings.length) {
    for (const f of findings) console.error(`${f.file}:${f.line}:${f.column} ${f.codePoint} ${f.reason}`);
    process.exit(1);
  }
  console.log('text safety checks passed');
}

module.exports = { checkRepository, checkFile, isForbiddenCodePoint };
