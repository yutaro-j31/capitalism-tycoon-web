const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'js/executive-secretary.js'), 'utf8');
const context = { globalThis: { __capitalismTycoonModules: {} } };
context.globalThis.globalThis = context.globalThis;
// the stock state is decided in one place, supply.storeStockStatus (UI3-10d): load the real supply module next to the secretary
context.globalThis.__capitalismTycoonModules.economicOperation = { ceilYen: value => Math.ceil(Number(value)) };
vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js/supply.js'), 'utf8'), context);
vm.runInNewContext(code, context);
const mod = context.globalThis.__capitalismTycoonModules.executiveSecretary;
function state() { return { week:10, companyCash:800000, companyDebt:9000000, lastReport:{expenses:700000, profit:-300000, sales:500000}, stores:[{id:'s1', name:'渋谷店', businessID:'ramen', status:'open', lastProfit:-50000}], supplyResultsByStoreID:{ s1:{ stockoutLostDemand:12, fulfilledUnits:100 } }, inventoryByStoreID:{}, finance:{loans:[{id:'l1', status:'active', nextPaymentWeek:12, interestRate:.14, outstandingPrincipal:9000000}]}, overtimeRisk:.8, employeeSatisfaction:35, keyPersonnel:[{id:'p1', retentionRisk:.7}], competitorEventLog:['第10週：競合反撃'], productVentures:[{id:'pv1', status:'completed'}], publicCompany:false, competitorOwnedRatio:0, crisis:{active:true} }; }
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
// UI3-10d: the stock-out row comes from the store's last week result, not from fields stores do not have
{
  const quiet = {...state(), companyCash:5000000, crisis:null, finance:{loans:[]}, overtimeRisk:0, employeeSatisfaction:90, keyPersonnel:[], lastReport:{expenses:100000, profit:100000}};
  const ids = g => mod.generateTasks(g, {companyValue:100000000}).map(x => x.id);
  const withResult = (result, extra = {}) => ({...quiet, supplyResultsByStoreID:{ s1:result }, ...extra});
  assert.ok(ids(withResult({stockoutLostDemand:12, fulfilledUnits:100})).includes('supply_stockout'), 'lost demand last week: the row is shown');
  assert.ok(!ids(withResult({stockoutLostDemand:0, fulfilledUnits:100})).includes('supply_stockout'), 'an open store without a stock-out has no stock-out row');
  assert.ok(!ids({...quiet, supplyResultsByStoreID:{}}).includes('supply_stockout'), 'no result yet (the week has not closed): no row');
  assert.ok(!ids({...quiet, supplyResultsByStoreID:{ s1:{ stockoutLostDemand:0, fulfilledUnits:100 } }, stores:[{...quiet.stores[0], inventory:0, weeklyDemand:20}]}).includes('supply_stockout'), 'the fields stores do not have are not read (inventory 0 alone shows nothing)');
  assert.ok(!ids(withResult({stockoutLostDemand:12, fulfilledUnits:100}, {stores:[{...quiet.stores[0], businessID:'conveni'}]})).includes('supply_stockout'), 'a business the supply module does not cover has no stock-out row');
  assert.ok(!ids(withResult({stockoutLostDemand:12, fulfilledUnits:100}, {stores:[{...quiet.stores[0], status:'preparing'}]})).includes('supply_stockout'), 'a store that is not open has no stock-out row');
  // overstock: more than six weeks of materials on hand at last week's fulfilled volume
  const lots = quantity => ({ s1:{ materials:{ ramen_noodles:{ lots:[{ status:'available', quantity }] } } } });
  assert.ok(ids({...withResult({stockoutLostDemand:0, fulfilledUnits:100}), inventoryByStoreID:lots(5000)}).includes('supply_overstock'), 'far more stock than a week sells: overstock row');
  assert.ok(!ids({...withResult({stockoutLostDemand:0, fulfilledUnits:100}), inventoryByStoreID:lots(300)}).includes('supply_overstock'), 'a normal stock level: no overstock row');
  assert.ok(!ids({...quiet, supplyResultsByStoreID:{}, inventoryByStoreID:lots(5000)}).includes('supply_overstock'), 'no result yet: no overstock row');
  // the week after a stock-out week shows the row; a week without one clears it (the result is what the engine records each week)
  const week = lost => ids(withResult({stockoutLostDemand:lost, fulfilledUnits:100}));
  assert.deepEqual([week(0).includes('supply_stockout'), week(8).includes('supply_stockout'), week(0).includes('supply_stockout')], [false, true, false], 'the row follows last week\'s result');
  // reading changes nothing
  const snapshot = JSON.stringify(withResult({stockoutLostDemand:12, fulfilledUnits:100}));
  const copy = JSON.parse(snapshot); ids(copy); assert.equal(JSON.stringify(copy), snapshot, 'task generation does not write the game');
}
assert.ok(mod.generateTasks({...state(), companyCash:20000000, crisis:null, stores:[], lastReport:{expenses:1, profit:1}, finance:{loans:[]}, overtimeRisk:0, employeeSatisfaction:80}, {companyValue:100000000, ipoReady:true}).some(x=>x.id==='growth_ipo_ready'), 'growth opportunity task is generated');
assert.ok(a.some(x => x.id === 'crisis_active'), 'management crisis task is generated');
for (const t of a) { assert.match(t.targetTab, /^(bank|report|business|office|rivals|strategy|map)$/); assert.ok(t.focus, 'focus target selector exists'); }
console.log('executive secretary model tests passed');
const { loadGame } = require('./harness');
const fullCtx = loadGame();
const fullModules = fullCtx.modules;
function acceptedDealState(weeksRemaining = 4) {
  const g = fullModules.engine.createInitialState({ configured: true });
  Object.assign(g,{week:20,companyCash:200000000,companyDebt:0,companyCredit:90,publicCompany:true,stockPrice:1000,sharesOut:1000000,founderShares:700000,reports:[{week:19,expenses:1000000,profit:3000000,sales:6000000}],stores:[]});
  g.lastReport=g.reports[0]; g.finance=fullModules.finance.defaultFinanceState(g);
  g.acquisitionTargets=[{id:'a1',name:'A承認',valuation:50000000,activeDealID:'d-a'},{id:'a2',name:'B承認',valuation:50000000,activeDealID:'d-b'}];
  g.maDealRooms=[{id:'d-a',targetID:'a1',status:'accepted',diligenceConfidence:.94,acceptedTerms:{method:'friendly',finalPrice:60000000,acceptedWeek:19,closingDeadlineWeek:g.week+weeksRemaining,offerRound:1},history:[]},{id:'d-b',targetID:'a2',status:'accepted',diligenceConfidence:.94,acceptedTerms:{method:'friendly',finalPrice:60000000,acceptedWeek:19,closingDeadlineWeek:g.week+weeksRemaining,offerRound:1},history:[]}];
  return g;
}
function taskHelpers(g,borrowRate=.05){return{companyValue:500000000,borrowRate,creditLimit:400000000,maPortfolio:fullModules.maPortfolioSummary.build(g)};}
function attachPlan(g,deal){deal.acquisitionFinancingPlan=fullModules.maAcquisitionFinancing.buildPlan(g,deal,{presetID:'cash-heavy'},{companyValue:500000000,borrowRate:.05,creditLimit:400000000});assert.equal(fullModules.maAcquisitionFinancing.validatePlan(g,deal,deal.acquisitionFinancingPlan,{companyValue:500000000,borrowRate:.05,creditLimit:400000000}).valid,true);}
function approveDeal(g,id){const e=new fullModules.engine.TycoonEngine();e.g=g;e.save=()=>true;e.emit=()=>{};e.notify=()=>{};e.fail=()=>false;assert.equal(e.approveMAClosing(id),true);}
let eg=acceptedDealState();let tasks=fullModules.executiveSecretary.generateTasks(eg,taskHelpers(eg));let maTasks=tasks.filter(t=>/^ma_financing_/.test(t.id));assert.equal(maTasks.length,2);assert.ok(maTasks.some(t=>t.focus==='[data-ma-deal-room="d-a"] [data-ma-financing]'));assert.ok(maTasks.some(t=>t.focus==='[data-ma-deal-room="d-b"] [data-ma-financing]'));
for(const deal of eg.maDealRooms)attachPlan(eg,deal);tasks=fullModules.executiveSecretary.generateTasks(eg,taskHelpers(eg));maTasks=tasks.filter(t=>/^ma_board_/.test(t.id));assert.equal(maTasks.length,2);assert.equal(maTasks[0].priority,'high');
eg=acceptedDealState(1);for(const deal of eg.maDealRooms)attachPlan(eg,deal);tasks=fullModules.executiveSecretary.generateTasks(eg,taskHelpers(eg));assert.ok(tasks.filter(t=>/^ma_board_/.test(t.id)).every(t=>t.priority==='critical'));
eg=acceptedDealState();for(const deal of eg.maDealRooms)attachPlan(eg,deal);approveDeal(eg,'d-a');tasks=fullModules.executiveSecretary.generateTasks(eg,taskHelpers(eg,eg.maDealRooms[0].boardApproval.approvedBorrowRate));assert.ok(tasks.some(t=>t.id==='ma_accepted_d-a'&&t.focus==='[data-ma-deal-room="d-a"] [data-action="ma-close-deal"]'));
eg=acceptedDealState();attachPlan(eg,eg.maDealRooms[0]);eg.maDealRooms[0].acquisitionFinancingPlan={...eg.maDealRooms[0].acquisitionFinancingPlan,planKey:'stale-plan-key'};tasks=fullModules.executiveSecretary.generateTasks(eg,taskHelpers(eg));assert.ok(tasks.some(t=>t.id==='ma_financing_invalid_d-a'&&t.priority==='critical'));assert.ok(!tasks.some(t=>t.priority==='warning'));

// UI3-10d, with the real engine: a store that sells normally never shows a stock-out row; once its stock is gone, the week's result records the
// lost demand and the row appears (and the shared status says the same)
{
  const engine = new fullModules.engine.TycoonEngine();
  engine.g = fullModules.engine.createInitialState({ configured: true });
  engine.save = () => true; engine.emit = () => {}; engine.notify = () => {}; engine.fail = () => false;
  const g = engine.g;
  const tenant = g.tenants.find(item => !item.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '検査店', operatingHours: 3 });
  const storeID = g.stores[0].id;
  const supplyRows = () => JSON.stringify(fullModules.executiveSecretary.generateTasks(g, { engine, companyValue: engine.companyValue() }).map(task => task.id).filter(id => id.startsWith('supply_')));   // JSON: the arrays come from another realm
  assert.equal(supplyRows(), '[]', 'a store that is still being prepared has no stock row');
  for (let i = 0; i < 6; i += 1) engine.advanceWeek();
  assert.equal(g.stores[0].status, 'open');
  assert.equal(g.supplyResultsByStoreID[storeID].stockoutLostDemand, 0, 'a normal week loses no demand');
  assert.equal(supplyRows(), '[]', 'an open store that sells normally has no stock-out row (it used to have one for any open store)');
  for (const material of Object.values(g.inventoryByStoreID[storeID].materials)) { material.lots = []; material.quantity = 0; }
  g.supplySettingsByStoreID[storeID].emergencyProcurementEnabled = false; g.purchaseOrders = [];
  engine.advanceWeek();
  assert.ok(g.supplyResultsByStoreID[storeID].stockoutLostDemand > 0, 'with no stock the week loses demand');
  assert.equal(supplyRows(), '["supply_stockout"]', 'the week after a stock-out week shows the row');
  const status = fullModules.supply.storeStockStatus(g, storeID);
  assert.equal(status.stockout, true); assert.ok(status.lostDemand > 0);
}
