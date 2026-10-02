'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadGame}=require('./harness');

const clone=value=>JSON.parse(JSON.stringify(value));
const {ctx,modules,engineModule}=loadGame();
const engine=ctx.__ct_engine;
const bond=modules.corporateBondsRatings;
const cb=modules.convertibleBondsDilution;
const preferred=modules.preferredSharesDividends;

assert.equal(engineModule.SAVE_KEY,'capitalism_tycoon_web_v1');
assert.equal(engineModule.SAVE_VERSION,9);
assert.equal(engine.g.saveVersion,9);
assert.deepEqual([bond.MODE,cb.MODE,preferred.MODE],[0,0,0]);

// Production module and compatibility APIs reject before normalization, IDs, RNG, or ledger mutation.
for(const [label,call] of [
  ['bond module',()=>bond.issue(engine.g,5_000_000,104)],
  ['bond engine',()=>engine.issueCorporateBond(5_000_000,104)],
  ['CB module',()=>cb.issue(engine.g,3_000_000,104)],
  ['CB engine',()=>engine.issueConvertibleBond(3_000_000,104)],
  ['preferred module',()=>preferred.issue(engine.g,4_000_000)],
  ['preferred engine',()=>engine.issuePreferredShares(4_000_000)]
]){
  const before=JSON.stringify(engine.g);
  assert.equal(call(),false,`${label} is deterministically rejected`);
  assert.equal(JSON.stringify(engine.g),before,`${label} rejection is a complete state no-op`);
}
assert.equal(engine.g.bondFinancing?.bonds?.length||0,0);
assert.equal(engine.g.convertibleFinancing?.notes?.length||0,0);
assert.equal(engine.g.preferredFinancing?.series?.length||0,0);

// Production finance UI describes Mode 0 without exposing a dead issuance control.
engine.g.configured=true;engine.g.selectedTab='finance';
for(const [label,html,selector] of [
  ['bond',bond.renderSection(engine),'data-bond-issue'],
  ['CB',cb.renderSection(engine),'data-cb-issue'],
  ['preferred',preferred.renderSection(engine),'data-preferred-issue']
]){
  assert.match(html,/現在利用できません/,`${label} UI explains availability`);
  assert.ok(!html.includes(selector),`${label} UI has no issuance control`);
}

const legacy={
  bondFinancing:{bonds:[{id:'legacy-bond-1',startWeek:2,maturityWeek:104,lastServiceWeek:8,principal:5_000_000,balance:4_500_000,coupon:.04,rating:'BBB',status:'active'}],history:[{week:8,type:'coupon',bondId:'legacy-bond-1',coupon:3461}]},
  convertibleFinancing:{notes:[{id:'legacy-cb-1',startWeek:3,maturityWeek:120,lastServiceWeek:8,principal:3_000_000,balance:3_000_000,coupon:.025,conversionPrice:125,conversionShares:24000,status:'active'}],history:[]},
  preferredFinancing:{series:[{id:'legacy-pref-1',startWeek:4,lastServiceWeek:8,principal:4_000_000,annualDividendRate:.06,weeklyDividend:4615,arrears:0,status:'active'}],history:[],lastServiceWeek:8,totalDividendsPaid:18460}
};
Object.assign(engine.g,clone(legacy));
const expected=clone(legacy);
engine.importSave(JSON.stringify(engine.g));
assert.deepEqual(clone(engine.g.bondFinancing.bonds),expected.bondFinancing.bonds,'legacy bonds round-trip unchanged');
assert.deepEqual(clone(engine.g.convertibleFinancing.notes),expected.convertibleFinancing.notes,'legacy CBs round-trip unchanged');
assert.deepEqual(clone(engine.g.preferredFinancing.series),expected.preferredFinancing.series,'legacy preferred shares round-trip unchanged');

// The former servicers were not finance-ledger integrated. Mode 0 quarantines all records,
// including finite-looking and incomplete ones, rather than guessing economics.
engine.g.bondFinancing.bonds.push({id:'incomplete-bond',balance:1_000_000,status:'active'});
engine.g.convertibleFinancing.notes.push({id:'incomplete-cb',balance:1_000_000,status:'active'});
engine.g.preferredFinancing.series.push({id:'incomplete-pref',principal:1_000_000,status:'active'});
const beforeService=JSON.stringify(engine.g);
assert.equal(bond.service(engine.g),false);
assert.equal(cb.service(engine.g),false);
assert.equal(cb.convert(engine.g,engine.g.convertibleFinancing.notes[0]),false);
assert.equal(preferred.service(engine.g),false);
assert.equal(JSON.stringify(engine.g),beforeService,'legacy servicing and conversion perform no invented settlement');
engine.importSave(JSON.stringify(engine.g));
assert.ok(engine.g.bondFinancing.bonds.some(row=>row.id==='incomplete-bond'&&!('coupon' in row)));
assert.ok(engine.g.convertibleFinancing.notes.some(row=>row.id==='incomplete-cb'&&!('conversionPrice' in row)));
assert.ok(engine.g.preferredFinancing.series.some(row=>row.id==='incomplete-pref'&&!('weeklyDividend' in row)));
assert.ok(modules.finance.validate(engine.g).ok,'unchanged canonical accounting remains valid');

// Static writer/AI inventory: these three compatibility modules are the only production files
// allowed to name the disabled APIs/state writers, and each exposes the explicit Mode 0 guard.
const production=fs.readdirSync(path.join(__dirname,'..','js')).filter(name=>name.endsWith('.js')).sort();
const needles=/issueCorporateBond|issueConvertibleBond|issuePreferredShares|bondFinancing\.bonds\.(?:push|unshift)|convertibleFinancing\.notes\.(?:push|unshift)|preferredFinancing\.series\.(?:push|unshift)/;
const writers=[];
for(const name of production){const source=fs.readFileSync(path.join(__dirname,'..','js',name),'utf8');if(needles.test(source))writers.push(name);}
assert.deepEqual(writers,['convertible-bonds-dilution.js','corporate-bonds-ratings.js','preferred-shares-dividends.js']);
for(const name of writers){const source=fs.readFileSync(path.join(__dirname,'..','js',name),'utf8');assert.match(source,/MODE:0/);assert.match(source,/function issue\(\)\{return false;\}/);}
const otherProduction=production.filter(name=>!writers.includes(name)).map(name=>fs.readFileSync(path.join(__dirname,'..','js',name),'utf8')).join('\n');
assert.ok(!/(?:bondFinancing|convertibleFinancing|preferredFinancing|issueCorporateBond|issueConvertibleBond|issuePreferredShares)/.test(otherProduction),'AI, recovery, allocation, and fallback production paths cannot reach Mode 0 instruments');
console.log('GF-002 financing Mode 0 regression tests passed');
