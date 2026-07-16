const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, createBrowserContext } = require('./harness');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert.throws = (fn, re) => {
  try { fn(); }
  catch (error) {
    assert(re.test(String(error.message)), `error message mismatch: ${error.message}`);
    return;
  }
  throw new Error('expected throw');
};

const expected = [
  './js/runtime.js','./js/data.js','./js/workforce.js','./js/supply.js','./js/competitor.js',
  './js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js','./js/competitor-terminal-compat.js',
  './js/market.js','./js/finance.js','./js/engine.js','./js/save-v9.js','./js/expansion.js','./js/competitor-media.js',
  './js/completion.js','./js/parity.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/competitor-dashboard-ui.js',
  './js/player-crisis-ui.js','./js/app.js','./js/player-crisis.js','./js/player-crisis-actions.js','./js/player-crisis-restructuring.js'
];
const scripts = extractScripts(readIndex()).filter(script => script.src);
const bySrc = new Map(scripts.map(script => [script.src, script]));
const run = (context, src) => vm.runInContext(bySrc.get(src).code, context, { filename: src });
const runThrough = (context, finalSrc) => {
  for (const script of scripts) {
    run(context, script.src);
    if (script.src === finalSrc) return;
  }
  throw new Error(`script not found: ${finalSrc}`);
};

assert(JSON.stringify(scripts.map(script => script.src)) === JSON.stringify(expected), `script order mismatch: ${scripts.map(script => script.src).join(', ')}`);
assert(scripts[0].src === './js/runtime.js', 'runtime.js must be first');
assert(scripts.at(-5).src === './js/player-crisis-ui.js', 'player-crisis-ui.js must capture the engine before app composition');
assert(scripts.at(-4).src === './js/app.js', 'app.js must compose engine immediately before player crisis modules');
assert(scripts.at(-3).src === './js/player-crisis.js', 'player-crisis.js must wrap the final composed engine');
assert(scripts.at(-2).src === './js/player-crisis-actions.js', 'player-crisis-actions.js must extend the crisis lifecycle');
assert(scripts.at(-1).src === './js/player-crisis-restructuring.js', 'player-crisis-restructuring.js must load after crisis actions');

for (const script of scripts) {
  assert(fs.existsSync(script.file), `${script.src} missing`);
  const buffer = fs.readFileSync(script.file);
  assert(buffer.length > 0, `${script.src} is empty`);
  assert(!(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf), `${script.src} has BOM`);
  const text = buffer.toString('utf8');
  assert(!/\r/.test(text), `${script.src} must use LF`);
  assert(!/[\u202A-\u202E\u2066-\u2069]/.test(text), `${script.src} has invisible bidi control characters`);
}
assert(!/https?:\/\/[^"']+\.js/i.test(readIndex()), 'external CDN JavaScript reference detected');

const ctx = createBrowserContext();
const beforeGlobals = new Set(Object.getOwnPropertyNames(ctx));
ctx.loadCalls = 0;
ctx.renderEvents = 0;
let listenerRegistrations = 0;
const app = ctx.document.getElementById('app');
const modal = ctx.document.getElementById('modal-root');
const originalAppAdd = app.addEventListener.bind(app);
app.addEventListener = function(type, fn) { listenerRegistrations++; return originalAppAdd(type, fn); };
const originalModalAdd = modal.addEventListener.bind(modal);
modal.addEventListener = function(type, fn) { listenerRegistrations++; return originalModalAdd(type, fn); };
for (const script of scripts) {
  let code = script.code;
  if (script.src === './js/app.js') {
    code = code.replace('const engine = TycoonEngine.load();', 'const engine = (loadCalls++, TycoonEngine.load());');
    code = code.replace('function render() {', 'function render() {renderEvents++;');
  }
  vm.runInContext(code, ctx, { filename: script.src });
}

const modules = ctx.__capitalismTycoonModules;
assert(modules && typeof modules === 'object', 'registry missing');
assert(Object.prototype.propertyIsEnumerable.call(ctx, '__capitalismTycoonModules') === false, 'registry must be non-enumerable');
assert(ctx.loadCalls === 1, `TycoonEngine.load expected once, got ${ctx.loadCalls}`);
assert(ctx.renderEvents === 1, `initial render expected once, got ${ctx.renderEvents}`);
assert(listenerRegistrations >= 5, 'expected UI event listeners to be registered');
assert(modules.engine && modules.engine.TycoonEngine, 'TycoonEngine export missing');

for (const [name, keys] of Object.entries({
  data:['MASTER','PRODUCT_BLUEPRINTS','LUXURY_OFFERS','PERSONAL_INVESTMENT_OFFERS','OVERSEAS_COUNTRIES','SPORTS_TEAMS','MISSION_DEFS'],
  workforce:['ROLES','recompute','validate','storeAdjustment'],
  supply:['MATERIALS','SUPPLIERS','createOrder','applyConstraint','autoOrder'],
  competitor:['STRATEGIES','ensure','processWeek','validate','MAX_PROJECTS','PROJECT_ACTION_TYPES','ENTRY_LEAD_WEEKS','evaluateEntryCandidates','scheduleMarketEntry','MAX_CREDIT_HISTORY','CREDIT_STATUSES','calculateCreditLimit','reviewCompanyCredit','MAX_LIFECYCLE_HISTORY','LIFECYCLE_STATUSES','distressScore','startTurnaroundPlan','declareBankruptcy','sanitizeNewspapers','newspaperEventText','ensureCounterStates','installParityCompatibility','dashboard','dashboardUI','TERMINAL_STATUSES','preserveCompetitorEvents','applyTerminalCompatibility','__terminalCompatInstalled','__parityCompatibilityRegistered','__distressInstalled'],
  market:['calculateMarkets','effectiveCapacity','competitorOffers','SEGMENTS'],
  finance:['ensureFinance','event','recordWeekly','buildStatements','validate'],
  engine:['TycoonEngine','SAVE_VERSION','migrateSave','migrateV8ToV9','yen','compactYen','pct','finite','__saveV9Installed'],
  expansion:['installExpansion','FOUNDER_TRAITS','FOUNDER_HOME_PRODUCTS','SUPPLIER_OFFERS','VERTICAL_INTEGRATION_OFFERS','RD_PROJECTS','PERSONAL_REAL_ESTATE_OFFERS','SUCCESSOR_CANDIDATES'],
  completion:['installCompletion','MEDIA_ACTIONS','TRANSPORT_REBUILD_ACTIONS','ENDING_DEFS'],
  parity:['installParity','KEY_PERSON_ROLES'],
  playerCrisis:['STATUSES','HISTORY_LIMIT','LEGACY_GAME_OVER_REASON','INSOLVENCY_REASON','graceForDifficulty','reserveThreshold','ensure','evaluate','snapshot','validate','__installed'],
  playerCrisisActions:['ACTION_TYPES','HISTORY_LIMIT','EMERGENCY_LOAN_COOLDOWN_WEEKS','MIN_EMERGENCY_LOAN','TARGET_EMERGENCY_LOAN','ensure','options','validate','__installed'],
  playerCrisisUI:['render','enhance','bindEngine','handleClick','install','stripPanel','STATUS_LABELS','REASON_LABELS','__installed'],
  playerCrisisRestructuring:['HISTORY_LIMIT','DISPOSITION_TYPES','ELIGIBLE_STATUSES','ensure','options','validate','__installed']
})) {
  assert(modules[name], `${name} module missing`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(modules[name], key), `${name}.${key} missing`);
}

assert(modules.engine.SAVE_VERSION === 9, `expected save version 9, got ${modules.engine.SAVE_VERSION}`);
assert(modules.engine.TycoonEngine.prototype.__competitorMediaInstalled === true, 'competitor media patch missing');
assert(modules.engine.TycoonEngine.prototype.__competitorParityCompatibilityInstalled === true, 'competitor parity compatibility missing');
assert(modules.engine.TycoonEngine.prototype.__playerCrisisInstalled === true, 'player crisis patch missing');
assert(modules.engine.TycoonEngine.prototype.__playerCrisisActionsInstalled === true, 'player crisis actions patch missing');
assert(modules.engine.TycoonEngine.prototype.__playerCrisisRestructuringInstalled === true, 'player crisis restructuring patch missing');
assert(typeof modules.competitor.dashboard.buildDashboard === 'function', 'competitor dashboard builder missing');
assert(modules.competitor.dashboard.__marketStatusNormalized === true, 'competitor dashboard status normalizer missing');
assert(typeof modules.competitor.dashboardUI.render === 'function', 'competitor dashboard UI renderer missing');
assert(typeof modules.competitor.dashboardUI.enhance === 'function', 'competitor dashboard UI app integration missing');
assert(typeof modules.playerCrisisUI.render === 'function', 'player crisis UI renderer missing');
assert(typeof modules.playerCrisisUI.handleClick === 'function', 'player crisis UI action wiring missing');
const afterGlobals = Object.getOwnPropertyNames(ctx).filter(key => !beforeGlobals.has(key) && key !== 'loadCalls' && key !== 'renderEvents');
assert(JSON.stringify(afterGlobals) === JSON.stringify(['__capitalismTycoonModules']), `unexpected globals: ${afterGlobals.join(', ')}`);

const noRuntime = createBrowserContext();
assert.throws(() => run(noRuntime, './js/data.js'), /runtime\.js/);
const missingData = createBrowserContext();
run(missingData, './js/runtime.js');
assert.throws(() => run(missingData, './js/competitor.js'), /data\.js/);
assert.throws(() => run(missingData, './js/market.js'), /data module/);
assert.throws(() => run(missingData, './js/engine.js'), /data module/);

const missingCompetitor = createBrowserContext();
run(missingCompetitor, './js/runtime.js');
run(missingCompetitor, './js/data.js');
for (const src of ['./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) assert.throws(() => run(missingCompetitor, src), /competitor\.js/);
const missingProjects = createBrowserContext();
runThrough(missingProjects, './js/competitor.js');
for (const src of ['./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) assert.throws(() => run(missingProjects, src), /competitor-projects\.js/);
const missingEntry = createBrowserContext();
runThrough(missingEntry, './js/competitor-projects.js');
for (const src of ['./js/competitor-credit.js','./js/competitor-distress.js']) assert.throws(() => run(missingEntry, src), /competitor-entry\.js/);
const missingCredit = createBrowserContext();
runThrough(missingCredit, './js/competitor-entry.js');
assert.throws(() => run(missingCredit, './js/competitor-distress.js'), /competitor-credit\.js/);
const missingDistress = createBrowserContext();
runThrough(missingDistress, './js/competitor-credit.js');
assert.throws(() => run(missingDistress, './js/competitor-terminal-compat.js'), /competitor-distress\.js/);

const missingEngine = createBrowserContext();
run(missingEngine, './js/runtime.js');
for (const src of ['./js/save-v9.js','./js/competitor-media.js','./js/player-crisis-ui.js']) assert.throws(() => run(missingEngine, src), /engine\.js/);
const missingExpansion = createBrowserContext();
runThrough(missingExpansion, './js/save-v9.js');
assert.throws(() => run(missingExpansion, './js/competitor-media.js'), /expansion\.js/);
const missingParity = createBrowserContext();
runThrough(missingParity, './js/completion.js');
assert.throws(() => run(missingParity, './js/competitor-parity.js'), /parity\.js/);
const missingParityCompatibility = createBrowserContext();
runThrough(missingParityCompatibility, './js/parity.js');
assert.throws(() => run(missingParityCompatibility, './js/competitor-dashboard.js'), /competitor-parity\.js/);
const missingDashboard = createBrowserContext();
runThrough(missingDashboard, './js/competitor-parity.js');
assert.throws(() => run(missingDashboard, './js/competitor-dashboard-status.js'), /competitor-dashboard\.js/);
const missingDashboardStatus = createBrowserContext();
runThrough(missingDashboardStatus, './js/competitor-dashboard.js');
assert.throws(() => run(missingDashboardStatus, './js/competitor-dashboard-ui.js'), /competitor-dashboard-status\.js/);

const missingAppComposition = createBrowserContext();
runThrough(missingAppComposition, './js/player-crisis-ui.js');
assert.throws(() => run(missingAppComposition, './js/player-crisis.js'), /app\.js must install completion and parity/);
const missingPlayerCrisis = createBrowserContext();
runThrough(missingPlayerCrisis, './js/app.js');
assert.throws(() => run(missingPlayerCrisis, './js/player-crisis-actions.js'), /player-crisis\.js/);
const missingPlayerCrisisActions = createBrowserContext();
runThrough(missingPlayerCrisisActions, './js/player-crisis.js');
assert.throws(() => run(missingPlayerCrisisActions, './js/player-crisis-restructuring.js'), /player-crisis-actions\.js/);

for (const [src, re] of [
  ['./js/save-v9.js',/already installed/],
  ['./js/competitor-media.js',/already installed/],
  ['./js/competitor-parity.js',/already registered/],
  ['./js/competitor-dashboard.js',/already normalized/],
  ['./js/competitor-dashboard-status.js',/already registered/],
  ['./js/competitor-dashboard-ui.js',/already registered/],
  ['./js/player-crisis-ui.js',/already registered/],
  ['./js/player-crisis.js',/already registered/],
  ['./js/player-crisis-actions.js',/already registered/],
  ['./js/player-crisis-restructuring.js',/already registered/],
  ['./js/competitor-terminal-compat.js',/already installed/],
  ['./js/competitor-distress.js',/already installed/],
  ['./js/data.js',/already registered/]
]) assert.throws(() => run(ctx, src), re);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
