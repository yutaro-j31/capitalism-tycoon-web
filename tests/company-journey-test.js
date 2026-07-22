const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'js/company-journey.js'), 'utf8');
const context = { globalThis: { __capitalismTycoonModules: {} } };
context.globalThis.globalThis = context.globalThis;
vm.runInNewContext(code, context);
const mod = context.globalThis.__capitalismTycoonModules.companyJourney;

function baseState() {
  return { configured:false, week:1, stores:[], businesses:[], productVentures:[], lastReport:{revenue:0, profit:0}, totalRevenue:0, lifetimeRevenue:0, publicCompany:false, marketCap:0, companyValue:0, overseasStoreCount:0, overseasBusinesses:[], internationalOperations:[] };
}

const initial = mod.evaluate(baseState());
assert.equal(initial.completed, 0);
assert.equal(initial.total, 10);
assert.equal(initial.percent, 0);
assert.equal(initial.next.id, 'founded');

const founded = {...baseState(), configured:true};
assert.equal(mod.evaluate(founded).next.id, 'firstBusiness');

const operating = {...founded, week:2, stores:[{id:'s1',status:'open'}], lastReport:{revenue:500000,profit:120000}, totalRevenue:500000};
const firstRun = mod.evaluate(operating);
const secondRun = mod.evaluate(JSON.parse(JSON.stringify(operating)));
assert.deepEqual(firstRun, secondRun, 'same state must produce the same roadmap and order');
assert.equal(firstRun.completed, 5);
assert.equal(firstRun.next.id, 'fiveStores');

const before = JSON.stringify(operating);
mod.evaluate(operating);
mod.render(operating);
assert.equal(JSON.stringify(operating), before, 'roadmap evaluation and rendering must not mutate save state');

const scaled = {...operating, stores:Array.from({length:5},(_,index)=>({id:`s${index}`,status:'open'})), totalRevenue:120000000, publicCompany:true, marketCap:12000000000, overseasStoreCount:1};
const complete = mod.evaluate(scaled);
assert.equal(complete.complete, true);
assert.equal(complete.completed, complete.total);
assert.equal(complete.next, null);

const html = mod.render(operating);
assert.match(html, /data-company-journey="1"/);
assert.match(html, /5\/10達成/);
assert.match(html, /5店舗へ拡大/);
assert.match(html, /data-company-journey-jump="1"/);
assert.match(html, /data-tab="map"/);
assert.doesNotMatch(html, /localStorage|saveVersion|Math\.random/);

for (const item of firstRun.items) {
  assert.match(item.tab, /^(home|business|report|map|office|market|strategy)$/);
  assert.ok(item.focus, `focus selector is required for ${item.id}`);
}

console.log('company journey roadmap tests passed');
