const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, createBrowserContext } = require('./harness');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function expectThrow(fn, re) {
  try { fn(); }
  catch (error) { assert(re.test(String(error.message)), `error message mismatch: ${error.message}`); return; }
  throw new Error('expected throw');
}

const expected = [
  './js/runtime.js','./js/data.js','./js/workforce.js','./js/supply.js','./js/competitor.js','./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js','./js/competitor-terminal-compat.js',
  './js/market.js','./js/finance.js','./js/engine.js','./js/save-v9.js','./js/expansion.js','./js/competitor-media.js','./js/completion.js','./js/parity.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/competitor-dashboard-ui.js',
  './js/player-crisis-ui.js','./js/app.js','./js/player-crisis.js','./js/player-crisis-actions.js','./js/player-crisis-restructuring.js','./js/player-crisis-creditor.js'
];
const scripts = extractScripts(readIndex()).filter(script => script.src);
const bySrc = new Map(scripts.map(script => [script.src, script]));
const run = (context, src, code = bySrc.get(src)?.code) => vm.runInContext(code, context, { filename: src });
const prefix = finalSrc => expected.slice(0, expected.indexOf(finalSrc) + 1);
const freshWith = srcs => { const context = createBrowserContext(); for (const src of srcs) run(context, src); return context; };

assert(JSON.stringify(scripts.map(script => script.src)) === JSON.stringify(expected), `script order mismatch: ${scripts.map(script => script.src).join(', ')}`);
assert(expected[0] === './js/runtime.js', 'runtime.js must be first');
assert(expected.at(-6) === './js/player-crisis-ui.js', 'player-crisis-ui.js must precede app.js');
assert(expected.at(-5) === './js/app.js', 'app.js must compose the engine before crisis modules');
assert(expected.at(-4) === './js/player-crisis.js', 'player-crisis.js must precede crisis actions');
assert(expected.at(-3) === './js/player-crisis-actions.js', 'player-crisis-actions.js must precede restructuring');
assert(expected.at(-2) === './js/player-crisis-restructuring.js', 'restructuring must precede creditor negotiation');
assert(expected.at(-1) === './js/player-crisis-creditor.js', 'creditor negotiation must be the final crisis extension');
for (const script of scripts) {
  assert(fs.existsSync(script.file), `${script.src} missing`);
  const buffer = fs.readFileSync(script.file);
  assert(buffer.length > 0, `${script.src} is empty`);
  assert(!(buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf), `${script.src} has BOM`);
  const text = buffer.toString('utf8');
  assert(!/\r/.test(text), `${script.src} must use LF`);
  assert(!/[\u202A-\u202E\u2066-\u2069]/.test(text), `${script.src} has bidi controls`);
}
assert(!/https?:\/\/[^"']+\.js/i.test(readIndex()), 'external CDN JavaScript reference detected');

const ctx = createBrowserContext();
const beforeGlobals = new Set(Object.getOwnPropertyNames(ctx));
ctx.loadCalls = 0;
ctx.renderEvents = 0;
let listenerRegistrations = 0;
for (const id of ['app','modal-root']) {
  const node = ctx.document.getElementById(id);
  const baseAdd = node.addEventListener.bind(node);
  node.addEventListener = function(type, fn) { listenerRegistrations++; return baseAdd(type, fn); };
}
for (const script of scripts) {
  let code = script.code;
  if (script.src === './js/app.js') {
    code = code.replace('const engine = TycoonEngine.load();', 'const engine = (loadCalls++, TycoonEngine.load());');
    code = code.replace('function render() {', 'function render() {renderEvents++;');
  }
  run(ctx, script.src, code);
}
const modules = ctx.__capitalismTycoonModules;
assert(modules && typeof modules === 'object', 'registry missing');
assert(Object.prototype.propertyIsEnumerable.call(ctx, '__capitalismTycoonModules') === false, 'registry must be non-enumerable');
assert(ctx.loadCalls === 1, `TycoonEngine.load expected once, got ${ctx.loadCalls}`);
assert(ctx.renderEvents === 1, `initial render expected once, got ${ctx.renderEvents}`);
assert(listenerRegistrations >= 5, 'expected UI event listeners');

const requiredExports = {
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
  playerCrisisRestructuring:['HISTORY_LIMIT','DISPOSITION_TYPES','COST_ACTION_TYPES','ELIGIBLE_STATUSES','ensure','options','costOptions','validate','__installed'],
  playerCrisisCreditor:['NEGOTIATION_TYPES','ELIGIBLE_STATUSES','HISTORY_LIMIT','COOLDOWN_WEEKS','DEFERRAL_WEEKS','EXTENSION_WEEKS','FAILURE_CREDIT_PENALTY','ensure','activeLoans','approvalChance','options','findCandidate','hashRoll','validate','__installed']
};
for (const [name, keys] of Object.entries(requiredExports)) {
  assert(modules[name], `${name} module missing`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(modules[name], key), `${name}.${key} missing`);
}
assert(modules.engine.SAVE_VERSION === 9, `expected save version 9, got ${modules.engine.SAVE_VERSION}`);
for (const marker of ['__competitorMediaInstalled','__competitorParityCompatibilityInstalled','__playerCrisisInstalled','__playerCrisisActionsInstalled','__playerCrisisRestructuringInstalled','__playerCrisisCreditorInstalled']) assert(modules.engine.TycoonEngine.prototype[marker] === true, `${marker} missing`);
assert(typeof modules.competitor.dashboard.buildDashboard === 'function', 'competitor dashboard builder missing');
assert(modules.competitor.dashboard.__marketStatusNormalized === true, 'competitor dashboard status normalizer missing');
assert(typeof modules.competitor.dashboardUI.render === 'function', 'competitor dashboard UI renderer missing');
assert(typeof modules.playerCrisisUI.handleClick === 'function', 'player crisis UI action wiring missing');
const afterGlobals = Object.getOwnPropertyNames(ctx).filter(key => !beforeGlobals.has(key) && key !== 'loadCalls' && key !== 'renderEvents');
assert(JSON.stringify(afterGlobals) === JSON.stringify(['__capitalismTycoonModules']), `unexpected globals: ${afterGlobals.join(', ')}`);

expectThrow(() => run(createBrowserContext(), './js/data.js'), /runtime\.js/);
const runtimeOnly = freshWith(['./js/runtime.js']);
expectThrow(() => run(runtimeOnly, './js/competitor.js'), /data\.js/);
expectThrow(() => run(runtimeOnly, './js/market.js'), /data module/);
expectThrow(() => run(runtimeOnly, './js/engine.js'), /data module/);
const dataReady = freshWith(['./js/runtime.js','./js/data.js']);
for (const src of ['./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) expectThrow(() => run(dataReady, src), /competitor\.js/);
const competitorReady = freshWith(prefix('./js/competitor.js'));
for (const src of ['./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) expectThrow(() => run(competitorReady, src), /competitor-projects\.js/);
const projectsReady = freshWith(prefix('./js/competitor-projects.js'));
for (const src of ['./js/competitor-credit.js','./js/competitor-distress.js']) expectThrow(() => run(projectsReady, src), /competitor-entry\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-entry.js')), './js/competitor-distress.js'), /competitor-credit\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-credit.js')), './js/competitor-terminal-compat.js'), /competitor-distress\.js/);
for (const src of ['./js/save-v9.js','./js/competitor-media.js','./js/player-crisis-ui.js']) expectThrow(() => run(runtimeOnly, src), /engine\.js/);
expectThrow(() => run(freshWith(prefix('./js/save-v9.js')), './js/competitor-media.js'), /expansion\.js/);
expectThrow(() => run(freshWith(prefix('./js/completion.js')), './js/competitor-parity.js'), /parity\.js/);
expectThrow(() => run(freshWith(prefix('./js/parity.js')), './js/competitor-dashboard.js'), /competitor-parity\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-parity.js')), './js/competitor-dashboard-status.js'), /competitor-dashboard\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-dashboard.js')), './js/competitor-dashboard-ui.js'), /competitor-dashboard-status\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-ui.js')), './js/player-crisis.js'), /app\.js must install completion and parity/);
expectThrow(() => run(freshWith(prefix('./js/app.js')), './js/player-crisis-actions.js'), /player-crisis\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis.js')), './js/player-crisis-restructuring.js'), /player-crisis-actions\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-actions.js')), './js/player-crisis-creditor.js'), /player-crisis-restructuring\.js/);

const duplicateRegistration = /already (?:installed|registered|normalized)/;
for (const src of [
  './js/save-v9.js','./js/competitor-media.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/competitor-dashboard-ui.js',
  './js/player-crisis-ui.js','./js/player-crisis.js','./js/player-crisis-actions.js','./js/player-crisis-restructuring.js','./js/player-crisis-creditor.js','./js/competitor-terminal-compat.js','./js/competitor-distress.js','./js/data.js'
]) expectThrow(() => run(ctx, src), duplicateRegistration);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
