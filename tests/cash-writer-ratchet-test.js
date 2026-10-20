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
// Counted per production file, independent of field (key computed at run time):
//   computedStateKey  an assignment to a computed key of the game-state root, e.g.
//                     g[key] -= x, this.g[cashKey] += x, state[cashKey(owner)] = x
// dynamicKey and literalKey also match some reads, and computedStateKey also matches non-cash
// computed root writes; they are ratcheted because they are the indirect write routes (such as
// a cashKey() helper) that the direct pattern cannot see.
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

// Roots: g, state, any <object>.g, and every local alias the file binds to one of them
// (const root=this.g; let live = engine.g; ({game}=...) is not resolved). Lexical, like the
// Phase 0.5 inventory: a tripwire for new write sites, not a proof of completeness.
const BASE_ROOTS = ['(?<![\\w$.])g', '(?<![\\w$.])state', '[\\w$]+\\.g'];
function stateAliases(source) {
  const roots = new RegExp(`^(?:${BASE_ROOTS.join('|')})$`);
  const aliases = new Set();
  for (const m of source.matchAll(/(?:\b(?:const|let|var)\s+|[,(]\s*)([A-Za-z_$][\w$]*)\s*=\s*([\w$.]+)(?=\s*(?:[;,)}]|$))/gm))
    if (m[1] !== 'g' && m[1] !== 'state' && (roots.test(m[2]) || aliases.has(m[2]))) aliases.add(m[1]);
  return [...aliases];
}
function computedStateKeys(source) {
  const root = `(?:${[...BASE_ROOTS, ...stateAliases(source).map(a => `(?<![\\w$.])${a.replace(/\$/g, '\\$')}`)].join('|')})`;
  return count(source, new RegExp(`${root}\\s*\\[[^\\]\\n]+\\]\\s*(?:${ASSIGN}|\\+\\+|--)`, 'g')) +
    count(source, new RegExp(`(?:\\+\\+|--)\\s*${root}\\s*\\[[^\\]\\n]+\\]`, 'g'));
}
function snapshot() {
  const files = {};
  for (const name of fs.readdirSync(JS_DIR).filter(name => name.endsWith('.js')).sort()) {
    const source = fs.readFileSync(path.join(JS_DIR, name), 'utf8');
    const row = scan(source), computed = computedStateKeys(source);
    if (computed) row.computedStateKey = computed;
    if (Object.keys(row).length) files[`js/${name}`] = row;
  }
  return files;
}

function totals(files) {
  const sum = {};
  for (const row of Object.values(files)) for (const [field, kinds] of Object.entries(row)) {
    if (typeof kinds === 'number') { sum[field] = (sum[field] || 0) + kinds; continue; }
    for (const [kind, n] of Object.entries(kinds)) sum[`${field}.${kind}`] = (sum[`${field}.${kind}`] || 0) + n;
  }
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

assert.equal(computedStateKeys('g[cashKey(owner)]-=amount;this.g[key]+=1;state[k]=0;engine.g[debtKey]--;++g[x];'), 5);
assert.equal(computedStateKeys('g.loans[i]=1;rows[i]=2;if(g[key]===1||g[key]>=2)x=g[key];myg[key]=1;'), 0);
// Codex P1: a local alias of the state root is followed, including chained aliases and other engines.
assert.equal(computedStateKeys('const game=this.g;game[cashKey(owner)]-=amount;let live = engine.g, w = live;w[k]+=1;const p=e.g;p[k]=0;'), 3);
assert.equal(computedStateKeys('const rows=this.g.loans;rows[i]=1;const f=compute(this.g);f[k]=1;const r=g&&g.x;r[k]=1;'), 0);

const baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
assert.equal(baseline.schema, 1, 'cash writer ratchet baseline schema');
const problems = [];
for (const file of new Set([...Object.keys(baseline.files), ...Object.keys(current)])) {
  const compare = (label, was, now) => {
    if (now > was) problems.push(`${file} ${label}: ${was} -> ${now} (new cash write site; use an existing writer)`);
    else if (now < was) problems.push(`${file} ${label}: ${was} -> ${now} (sites removed; lower the baseline)`);
  };
  for (const field of FIELDS) for (const kind of ['direct', 'dynamicKey', 'literalKey'])
    compare(`${field}.${kind}`, baseline.files[file]?.[field]?.[kind] || 0, current[file]?.[field]?.[kind] || 0);
  compare('computedStateKey', baseline.files[file]?.computedStateKey || 0, current[file]?.computedStateKey || 0);
}
assert.deepEqual(problems, [], `cash writer ratchet:\n  ${problems.join('\n  ')}\nBaseline: tests/fixtures/cash-writer-ratchet-baseline.json`);
assert.deepEqual(baseline.totals, totals(current), 'baseline totals must equal the sum of its file rows');
const t = totals(current);
console.log(`cash writer ratchet PASS: ${Object.keys(current).length} files; companyCash direct ${t['companyCash.direct'] || 0}, personalCash direct ${t['personalCash.direct'] || 0}`);
