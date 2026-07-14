const fs = require('node:fs'); const path = require('node:path');
const { loadGame, findStateIssues } = require('./harness');
const { engineModule } = loadGame(); const { TycoonEngine } = engineModule;

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
assert(JSON.stringify(snapshot(reloaded.g)) === JSON.stringify(snapshot(e.g)), 'save round trip snapshot mismatch');
const legacyRaw = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-minimal-v1.json'), 'utf8');
const legacy = new TycoonEngine(JSON.parse(legacyRaw));
legacy.normalize();
assert(Array.isArray(legacy.g.reports) && Array.isArray(legacy.g.news), 'legacy fixture did not load required arrays');
JSON.stringify(legacy.g);
console.log(JSON.stringify({ configure: configureMetrics, advanceWeekOneCall: advanceWeekMetrics, finalWeek: e.g.week, maxHistoryLength: maxHistory, gameOver: e.g.gameOver, gameOverReason: e.g.gameOverReason }, null, 2));
