const fs = require('node:fs'); const path = require('node:path');
const { loadGame, findStateIssues } = require('./harness');
const { engineModule } = loadGame({isolatedLegacyIndex:true}); const { TycoonEngine } = engineModule;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function snapshot(g) {
  return {
    week: g.week,
    companyCash: g.companyCash,
    personalCash: g.personalCash,
    stores: g.stores.length,
    businesses: g.businesses.map(b => ({ id: b.id, brand: b.brand, quality: b.quality, efficiency: b.efficiency, price: b.price })),
    companyStocks: g.companyStocks,
    personalStocks: g.personalStocks,
    personalInvestments: g.personalInvestments,
    subsidiaries: g.subsidiaries,
    maSubsidiaries: g.maSubsidiaries,
    news: g.news,
    history: g.history,
    reports: g.reports,
    gameOver: g.gameOver,
    gameOverReason: g.gameOverReason,
  };
}


function assertTransactionExceptionSafety(methodName) {
  const engine = new TycoonEngine();
  let saves = 0, weekEmits = 0, renders = 0;
  const baseSave = engine.save.bind(engine), baseEmit = engine.emit.bind(engine);
  engine.save = function(...args) { saves++; return baseSave(...args); };
  engine.emit = function(type = 'change', detail = {}) { if (type === 'week') weekEmits++; return baseEmit(type, detail); };
  engine.addEventListener('change', () => renders++);
  engine.addEventListener('week', () => renders++);
  engine.configure({ playerName:'Tester', companyName:`Exception ${methodName}`, difficulty:'normal', scenario:'free' });
  saves = weekEmits = renders = 0;
  const original = engine[methodName];
  const marker = new Error(`${methodName} forced failure`);
  engine[methodName] = function() { throw marker; };
  try {
    engine.advanceWeek(false);
    throw new Error(`${methodName} exception was not thrown`);
  } catch (error) {
    assert(error === marker, `${methodName} did not rethrow original error`);
  } finally {
    engine[methodName] = original;
  }
  assert(engine._transactionDepth === 0, `${methodName} left transaction depth ${engine._transactionDepth}`);
  assert(engine.inTransaction() === false, `${methodName} left inTransaction true`);
  assert(saves === 0, `${methodName} failed operation saved ${saves} times`);
  assert(weekEmits === 0, `${methodName} failed operation emitted week ${weekEmits} times`);
  assert(renders === 0, `${methodName} failed operation rendered ${renders} times`);
  saves = weekEmits = renders = 0;
  const beforeRecoveryWeek = engine.g.week;
  assert(engine.advanceWeek(false) === true, `${methodName} recovery advance failed`);
  assert(engine.g.week === beforeRecoveryWeek + 1, `${methodName} recovery week increment mismatch`);
  assert(engine._transactionDepth === 0, `${methodName} recovery left transaction depth ${engine._transactionDepth}`);
  assert(engine.inTransaction() === false, `${methodName} recovery left inTransaction true`);
  assert(saves === 1, `${methodName} recovery save expected 1, got ${saves}`);
  assert(weekEmits === 1, `${methodName} recovery week emit expected 1, got ${weekEmits}`);
  assert(renders === 1, `${methodName} recovery render expected 1, got ${renders}`);
}

assertTransactionExceptionSafety('updateSupplyChainWeekly');
assertTransactionExceptionSafety('updateCompletionWeekly');
assertTransactionExceptionSafety('updateParityWeekly');

const e = new TycoonEngine();
let renderCount = 0, saveCount = 0, emitCount = 0, weekEmitCount = 0;
const baseSave = e.save.bind(e), baseEmit = e.emit.bind(e);
e.save = function(...a){ saveCount++; return baseSave(...a); };
e.emit = function(type='change', detail={}){ emitCount++; if (type === 'week') weekEmitCount++; return baseEmit(type, detail); };
e.addEventListener('change', () => renderCount++);
e.addEventListener('week', () => renderCount++);
e.configure({ playerName:'Tester', companyName:'Baseline Co', difficulty:'normal', scenario:'free' });
const configureMetrics = { saveCount, emitCount, renderCount };
assert(saveCount === 1, `configure save expected 1, got ${saveCount}`);
assert(renderCount === 1, `configure render expected 1, got ${renderCount}`);
assert(e.g.currentCompanySerial === 1 && e.g.serialCompanyCount === 1, 'completion configure defaults missing');
assert(e.g.founderTraitID === 'tech', 'expansion configure defaults missing');
assert(Array.isArray(e.g.keyPersonnel), 'parity configure defaults missing');

saveCount = emitCount = weekEmitCount = renderCount = 0;
const firstWeek = e.g.week;
const historyBefore = e.g.history.length;
const reportsBefore = e.g.reports.length;
e.advanceWeek(false);
assert(e.g.week === firstWeek + 1, `week increment expected ${firstWeek+1}, got ${e.g.week}`);
assert(saveCount === 1, `advanceWeek save expected 1, got ${saveCount}`);
assert(weekEmitCount === 1, `advanceWeek week emit expected 1, got ${weekEmitCount}`);
assert(renderCount === 1, `advanceWeek render expected 1, got ${renderCount}`);
assert(e.g.history.length - historyBefore <= 1, `history grew more than once: ${e.g.history.length-historyBefore}`);
assert(e.g.reports.length - reportsBefore === 1, `weekly report expected exactly 1, got ${e.g.reports.length-reportsBefore}`);
assert(e.g.lastExpansionUpdateWeek === e.g.week, 'expansion weekly did not run once for current week');
assert(e.g.lastCompletionUpdateWeek === e.g.week, 'completion weekly did not run once for current week');
assert(e.g.lastParityUpdateWeek === e.g.week, 'parity weekly did not run once for current week');
const newsKeys = e.g.news.map(n => n.replace(/^第\d+週：/, ''));
assert(new Set(newsKeys).size === newsKeys.length, 'duplicate same-cause news entries detected after one week');
const advanceWeekMetrics = { saveCount, emitCount, weekEmitCount, renderCount };

let maxHistory = e.g.history.length;
for (let i=1; i<52 && !e.g.gameOver; i++) {
  const w = e.g.week; const h = e.g.history.length; const r = e.g.reports.length;
  e.advanceWeek(false);
  assert(e.g.week === w + 1, `week increment expected ${w+1}, got ${e.g.week}`);
  assert(e.g.history.length - h <= 1, `week ${e.g.week}: history grew more than once`);
  assert(e.g.reports.length - r === 1, `week ${e.g.week}: weekly report duplicated or missing`);
  const issues = findStateIssues(e.g); if (issues.length) throw new Error(`week ${e.g.week}: ${issues.slice(0,10).join('\n')}`);
  JSON.stringify(e.g); maxHistory = Math.max(maxHistory, e.g.history.length); if (e.g.history.length > 1000) throw new Error('history grew unexpectedly');
}
const saveText = JSON.stringify(e.g);
const reloaded = new TycoonEngine(JSON.parse(saveText));
assert(reloaded.g.week === e.g.week, 'save round trip week mismatch');
assert(reloaded.g.companyCash === e.g.companyCash, 'save round trip companyCash mismatch');
assert(reloaded.g.history.length === e.g.history.length, 'save round trip history length mismatch');
assert(reloaded.g.reports.length === e.g.reports.length, 'save round trip reports length mismatch');
const legacyRaw = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-minimal-v1.json'), 'utf8');
const legacy = new TycoonEngine(JSON.parse(legacyRaw));
legacy.normalize();
assert(Array.isArray(legacy.g.reports) && Array.isArray(legacy.g.news), 'legacy fixture did not load required arrays');
JSON.stringify(legacy.g);

// Regression: a new company can open the affordable Fukuoka ramen and cafe
// tenants in week 1, then advance exactly one week without freezing or throwing.
const twoStore = new TycoonEngine();
twoStore.configure({ playerName:'悠太郎', companyName:'YTR', difficulty:'normal', scenario:'free', founderPrefID:'fukuoka', founderTraitID:'merchant' });
const ramenTenant = twoStore.g.tenants.find(t => t.prefID === 'fukuoka' && t.businessID === 'ramen' && !t.occupiedBy);
const cafeTenant = twoStore.g.tenants.find(t => t.prefID === 'fukuoka' && t.businessID === 'cafe' && !t.occupiedBy);
assert(ramenTenant && cafeTenant, 'Fukuoka opening tenants are missing');
assert(twoStore.openStore({ tenantID:ramenTenant.id, businessID:'ramen', name:'YTR 福岡ラーメン' }) === true, 'first store opening failed');
assert(twoStore.openStore({ tenantID:cafeTenant.id, businessID:'cafe', name:'YTR 福岡カフェ' }) === true, 'second store opening failed');
assert(twoStore.g.stores.length === 2, `expected two stores, got ${twoStore.g.stores.length}`);
assert(twoStore.g.week === 1, `opening stores must not advance time, got week ${twoStore.g.week}`);
const twoStoreCash = twoStore.g.companyCash;
const twoStoreResult = twoStore.advanceWeek(true);
assert(twoStoreResult === true, 'advanceWeek returned false after two openings');
assert(twoStore.g.week === 2, `two-store first advance expected week 2, got ${twoStore.g.week}`);
assert(twoStore.g.lastWeeklySummary && twoStore.g.lastWeeklySummary.week === 2, 'two-store weekly summary was not produced');
assert(Number.isFinite(twoStore.g.companyCash), 'two-store company cash became non-finite');
assert(twoStore.g.companyCash <= twoStoreCash + 5_000_000, 'two-store first week cash changed implausibly');
assert(findStateIssues(twoStore.g).length === 0, `two-store state issues: ${findStateIssues(twoStore.g).slice(0,10).join('\n')}`);

console.log(JSON.stringify({ configure: configureMetrics, advanceWeekOneCall: advanceWeekMetrics, finalWeek: e.g.week, maxHistoryLength: maxHistory, gameOver: e.g.gameOver, gameOverReason: e.g.gameOverReason, twoStoreWeek: twoStore.g.week, twoStoreCash: twoStore.g.companyCash }, null, 2));