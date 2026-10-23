'use strict';
// Switching a ramen store's supplier from the supply screen pays a contract fee. The UI action must run inside
// engine.runTransaction like every other money action; called bare, the fee left the current week's cash
// snapshot stale and the next week failed its accounting close (P2-CLOSE-WEEKLY-CASH difference=15000).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { loadGame } = require('./harness');

const app = fs.readFileSync('js/app.js', 'utf8');
assert.match(app, /case 'supply-select-supplier':engine\.runTransaction\(\(\)=>supplyModule\.selectSupplier\(engine\.g,id,el\.value,financeModule\)\);/,
  'the supply screen changes supplier inside engine.runTransaction');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000; };
}
const loaded = loadGame({ headless: true, random: lcg(1301) });
const engine = new loaded.engineModule.TycoonEngine();
engine.configure({ playerName: 'Founder', companyName: 'Supply Co', difficulty: 'normal' });
const g = engine.g, { supply, finance } = loaded.modules;
const tenant = g.tenants.find(t => !t.occupiedBy && t.businessID === 'ramen');
assert.ok(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: 'Supply test', operatingHours: 3 }));
const store = g.stores[g.stores.length - 1];
for (let week = 0; week < 4; week++) assert.equal(engine.advanceWeek(false), true);
assert.equal(store.status, 'open');

const cash = g.companyCash;
assert.equal(engine.runTransaction(() => supply.selectSupplier(g, store.id, 'reliable_national', finance)), true);
assert.equal(cash - g.companyCash, 15000, 'the reliable_national contract fee is paid');
for (let week = 0; week < 3; week++) assert.equal(engine.advanceWeek(false), true, `week ${g.week} closes after the supplier change`);
for (const snap of g.finance.weeklySnapshots) assert.ok(Math.abs(snap.cashDifference) <= 0.05, `week ${snap.week} cash difference ${snap.cashDifference}`);
console.log('PASS supply select supplier week close');
