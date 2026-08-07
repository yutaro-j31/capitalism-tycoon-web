'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {ROOT,readIndex}=require('./harness');

const migrated=[
  'capital-allocation-decision-memo.js',
  'capital-allocation-forecast.js',
  'capital-allocation-policy.js',
  'capital-allocation-recovery-funding-outcome.js',
  'capital-allocation-score.js',
  'competitor-dashboard-ui.js',
  'group-capital-allocation-execution.js',
  'group-capital-allocation-plan.js',
  'inter-subsidiary-synergy-performance.js',
  'ma-portfolio-summary-ui.js',
  'new-business-market-analysis.js',
  'player-crisis-creditor-ui.js',
  'player-crisis-ui.js',
  'player-turnaround-plan-ui.js',
  'playtest-report-ui.js',
  'release-diagnostics-ui.js',
  'shareholder-returns.js',
  'subsidiary-mandate-apply.js',
  'treasury-prepayment.js',
  'treasury-refinancing-policy.js'
];
assert.equal(migrated.length,20,'Stage 3-4 must migrate exactly 20 physical-startup observer files');
const index=readIndex();
const indexPositions=[];
for(const name of migrated){
  const code=fs.readFileSync(path.join(ROOT,'js',name),'utf8');
  assert.doesNotMatch(code,/MutationObserver/,`${name} must not retain MutationObserver`);
  assert.doesNotMatch(code,/queueMicrotask/,`${name} must not retain queueMicrotask scheduling`);
  assert.match(code,new RegExp(`id:['\"]${name.replace(/\.js$/,'')}['\"]`),`${name} must statically register its enhancer id`);
  assert.match(code,/registerUIEnhancer|registerEnhancer/,`${name} must route rendering through the central enhancer registry`);
  const position=index.indexOf(`src="./js/${name}"`);
  assert.ok(position>=0,`${name} must remain statically connected in index.html`);
  indexPositions.push(position);
}
assert.equal(new Set(indexPositions).size,migrated.length,'migrated modules must remain uniquely connected in index.html');

const registry=fs.readFileSync(path.join(ROOT,'js','ui-enhancer-registry.js'),'utf8');
assert.match(registry,/__capitalismTycoonPendingUIEnhancers/,'registry must drain static pre-registry enhancer registrations');
assert.match(registry,/for\s*\(const definition of pending\)registerUIEnhancer\(definition\)/,'pending registrations must be drained deterministically in insertion order');
assert.doesNotMatch(registry,/MutationObserver|queueMicrotask|requestAnimationFrame/,'registry must remain observer- and async-render-loop free');

const jsFiles=fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js'));
const unqualified=jsFiles.filter(name=>/new\s+MutationObserver\s*\(/.test(fs.readFileSync(path.join(ROOT,'js',name),'utf8')));
const comprehensive=jsFiles.filter(name=>/new\s+(?:[A-Za-z_$][\w$]*\.)?MutationObserver\s*\(/.test(fs.readFileSync(path.join(ROOT,'js',name),'utf8')));
const qualifiedOnly=comprehensive.filter(name=>!unqualified.includes(name)).sort();
assert.equal(unqualified.length,36,`expected 36 unqualified observer-driven JS files after Stage 3-4, got ${unqualified.length}`);
assert.equal(comprehensive.length,37,`expected 37 comprehensive observer-driven JS files after Stage 3-4, got ${comprehensive.length}`);
assert.deepEqual(qualifiedOnly,['physical-iphone-playtest.js'],'only physical-iphone-playtest.js should remain qualified-only after migrating playtest-report-ui.js');

console.log('Stage 3-4 startup observer migration contract passed');
