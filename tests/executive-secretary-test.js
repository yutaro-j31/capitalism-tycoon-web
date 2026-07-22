const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'js/executive-secretary.js'), 'utf8');
const context = { globalThis: { __capitalismTycoonModules: {} } };
context.globalThis.globalThis = context.globalThis;
vm.runInNewContext(code, context);
const mod = context.globalThis.__capitalismTycoonModules.executiveSecretary;
function state() { return { week:10, companyCash:800000, companyDebt:9000000, lastReport:{expenses:700000, profit:-300000, sales:500000}, stores:[{id:'s1', name:'渋谷店', status:'open', lastProfit:-50000, inventory:0, weeklyDemand:20}], finance:{loans:[{id:'l1', status:'active', nextPaymentWeek:12, interestRate:.14, outstandingPrincipal:9000000}]}, overtimeRisk:.8, employeeSatisfaction:35, keyPersonnel:[{id:'p1', retentionRisk:.7}], competitorEventLog:['第10週：競合反撃'], productVentures:[{id:'pv1', status:'completed'}], publicCompany:false, competitorOwnedRatio:0, crisis:{active:true} }; }
const a = mod.generateTasks(state(), { companyValue: 10000000, ipoReady: true });
const b = mod.generateTasks(state(), { companyValue: 10000000, ipoReady: true });
assert.deepEqual(a, b, 'same state must produce the same tasks in the same order');
const before = JSON.stringify(state()); mod.generateTasks(state(), { companyValue: 10000000, ipoReady: true }); assert.equal(JSON.stringify(state()), before, 'task generation must be pure for save JSON');
assert.equal(a[0].priority, 'critical', 'critical tasks must sort above opportunities');
assert.ok(a.length <= 5, 'task list is capped at five');
assert.equal(new Set(a.map(x => `${x.id}:${x.targetTab}`)).size, a.length, 'duplicate tasks are removed');
assert.ok(a.some(x => x.id === 'finance_cash_runway'), 'cash shortage task is generated');
assert.ok(a.some(x => x.id === 'finance_debt_due'), 'loan deadline task is generated');
assert.ok(mod.generateTasks({...state(), companyCash:5000000, crisis:null, finance:{loans:[]}, overtimeRisk:0, employeeSatisfaction:90, keyPersonnel:[], lastReport:{expenses:100000, profit:100000}}, {companyValue:100000000}).some(x => x.id === 'supply_stockout'), 'inventory/supply task is generated');
assert.ok(mod.generateTasks({...state(), companyCash:5000000, crisis:null, finance:{loans:[]}, stores:[], lastReport:{expenses:100000, profit:100000}}, {companyValue:100000000}).some(x => x.id === 'workforce_fatigue'), 'workforce fatigue task is generated');
assert.ok(mod.generateTasks({...state(), companyCash:20000000, crisis:null, stores:[], lastReport:{expenses:1, profit:1}, finance:{loans:[]}, overtimeRisk:0, employeeSatisfaction:80}, {companyValue:100000000, ipoReady:true}).some(x=>x.id==='growth_ipo_ready'), 'growth opportunity task is generated');
assert.ok(a.some(x => x.id === 'crisis_active'), 'management crisis task is generated');
for (const t of a) { assert.match(t.targetTab, /^(bank|report|business|office|rivals|strategy|map)$/); assert.ok(t.focus, 'focus target selector exists'); }
console.log('executive secretary model tests passed');
