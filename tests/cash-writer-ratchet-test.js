'use strict';
// Cash writer ratchet (Track B, step B1). Company and personal cash are still written directly from
// many production modules instead of through one cash/ledger API. This static test records every
// such write site per file and fails when a file gains one, so new code cannot widen the problem
// while the existing sites are migrated. It never changes runtime behavior.
//
// Counted per production file (js/*.js) and per cash field:
//   direct      `companyCash = / += / -= / *= …`, `++` / `--` on the field (comparisons are excluded)
//   dynamicKey  the field name as a string literal, e.g. `g[key]` with key = 'companyCash'
//   literalKey  the field name as an object-literal key, e.g. Object.assign(g,{companyCash:…})
// dynamicKey and literalKey also match some reads; they are ratcheted because they are the
// indirect write routes the direct pattern cannot see.
//
// A count above the baseline fails: route the new write through an existing writer instead.
// A count below the baseline also fails, so the baseline stays tight: lower the entry in
// tests/fixtures/cash-writer-ratchet-baseline.json in the same PR (`--print` shows the counts).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.join(ROOT, 'js');
const BASELINE = path.join(__dirname, 'fixtures', 'cash-writer-ratchet-baseline.json');
const FIELDS = ['companyCash', 'personalCash'];
const ASSIGN = '(?:\\*\\*|<<|>>>|>>|\\?\\?|&&|\\|\\||[-+*/%&|^])?=(?!=)';

function count(source, re) { return (source.match(re) || []).length; }

function scan(source) {
  const out = {};
  for (const field of FIELDS) {
    const direct = count(source, new RegExp(`\\b${field}\\s*${ASSIGN}`, 'g')) +
      count(source, new RegExp(`\\b${field}\\s*(?:\\+\\+|--)|(?:\\+\\+|--)\\s*[\\w$.\\]\\[]*\\b${field}\\b`, 'g'));
    const dynamicKey = count(source, new RegExp(`['"\`]${field}['"\`]`, 'g'));
    const literalKey = count(source, new RegExp(`[{,]\\s*${field}\\s*:(?!:)`, 'g'));
    const row = {};
    if (direct) row.direct = direct;
    if (dynamicKey) row.dynamicKey = dynamicKey;
    if (literalKey) row.literalKey = literalKey;
    if (Object.keys(row).length) out[field] = row;
  }
  return out;
}

function snapshot() {
  const files = {};
  for (const name of fs.readdirSync(JS_DIR).filter(name => name.endsWith('.js')).sort()) {
    const row = scan(fs.readFileSync(path.join(JS_DIR, name), 'utf8'));
    if (Object.keys(row).length) files[`js/${name}`] = row;
  }
  return files;
}

function totals(files) {
  const sum = {};
  for (const row of Object.values(files)) for (const [field, kinds] of Object.entries(row))
    for (const [kind, n] of Object.entries(kinds)) sum[`${field}.${kind}`] = (sum[`${field}.${kind}`] || 0) + n;
  return sum;
}

const current = snapshot();
if (process.argv.includes('--print')) {
  console.log(JSON.stringify({ files: current, totals: totals(current) }, null, 2));
  process.exit(0);
}

// The scanner itself: assignments are counted, comparisons and other fields are not.
assert.deepEqual(scan('g.companyCash-=x;g.companyCash+=y;g.companyCash=z;g.companyCash++;--g.personalCash;'),
  { companyCash: { direct: 4 }, personalCash: { direct: 1 } });
assert.deepEqual(scan('if(g.companyCash>=x&&g.companyCash<=y&&g.companyCash==z&&g.companyCash!==w)g.myCompanyCash=1;'), {});
assert.deepEqual(scan("const k=o==='personal'?'personalCash':'companyCash';Object.assign(g,{companyCash:1});"),
  { companyCash: { dynamicKey: 1, literalKey: 1 }, personalCash: { dynamicKey: 1 } });

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
assert.equal(baseline.schema, 1, 'cash writer ratchet baseline schema');
const problems = [];
for (const file of new Set([...Object.keys(baseline.files), ...Object.keys(current)])) {
  for (const field of FIELDS) for (const kind of ['direct', 'dynamicKey', 'literalKey']) {
    const was = baseline.files[file]?.[field]?.[kind] || 0, now = current[file]?.[field]?.[kind] || 0;
    if (now > was) problems.push(`${file} ${field}.${kind}: ${was} -> ${now} (new cash write site; use an existing writer)`);
    else if (now < was) problems.push(`${file} ${field}.${kind}: ${was} -> ${now} (sites removed; lower the baseline)`);
  }
}
assert.deepEqual(problems, [], `cash writer ratchet:\n  ${problems.join('\n  ')}\nBaseline: tests/fixtures/cash-writer-ratchet-baseline.json`);
assert.deepEqual(baseline.totals, totals(current), 'baseline totals must equal the sum of its file rows');
const t = totals(current);
console.log(`cash writer ratchet PASS: ${Object.keys(current).length} files; companyCash direct ${t['companyCash.direct'] || 0}, personalCash direct ${t['personalCash.direct'] || 0}`);
