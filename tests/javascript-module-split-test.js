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
  './js/boot-recovery.js','./js/runtime.js','./js/data.js','./js/workforce.js','./js/supply.js','./js/competitor.js','./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js','./js/competitor-terminal-compat.js',
  './js/market.js','./js/finance.js','./js/engine.js','./js/save-v9.js','./js/expansion.js','./js/competitor-media.js','./js/completion.js','./js/parity.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/competitor-dashboard-ui.js',
  './js/player-crisis-ui.js','./js/player-engine-bridge.js','./js/strategy-balance.js','./js/progression-balance.js','./js/app.js','./js/difficulty-scenario-balance.js','./js/player-crisis.js','./js/player-crisis-actions.js','./js/player-crisis-restructuring.js','./js/player-crisis-creditor.js','./js/player-debt-service.js','./js/player-turnaround-plan.js','./js/player-crisis-creditor-ui.js','./js/player-turnaround-plan-ui.js','./js/player-turnaround-plan-report.js','./js/release-diagnostics-ui.js','./js/playtest-report-ui.js','./js/d-ui-shell.js','./js/runtime-recovery-ui.js'
];
const scripts = extractScripts(readIndex()).filter(script => script.src);
const bySrc = new Map(scripts.map(script => [script.src, script]));
const run = (context, src, code = bySrc.get(src)?.code) => vm.runInContext(code, context, { filename: src });
const prefix = finalSrc => expected.slice(0, expected.indexOf(finalSrc) + 1);
const freshWith = srcs => { const context = createBrowserContext(); for (const src of srcs) run(context, src); return context; };
const before = (left, right) => assert(expected.indexOf(left) !== -1 && expected.indexOf(left) < expected.indexOf(right), `${left} must precede ${right}`);

assert(JSON.stringify(scripts.map(script => script.src)) === JSON.stringify(expected), `script order mismatch: ${scripts.map(script => script.src).join(', ')}`);
assert(expected[0] === './js/boot-recovery.js', 'boot recovery must be the first external script');
assert(expected[1] === './js/runtime.js', 'runtime.js must immediately follow boot recovery');
before('./js/player-crisis-ui.js','./js/player-engine-bridge.js');
before('./js/player-engine-bridge.js','./js/app.js');
before('./js/strategy-balance.js','./js/progression-balance.js');
before('./js/progression-balance.js','./js/app.js');
before('./js/app.js','./js/difficulty-scenario-balance.js');
before('./js/player-crisis.js','./js/player-crisis-actions.js');
before('./js/player-crisis-actions.js','./js/player-crisis-restructuring.js');
before('./js/player-crisis-restructuring.js','./js/player-crisis-creditor.js');
before('./js/player-crisis-creditor.js','./js/player-debt-service.js');
before('./js/player-debt-service.js','./js/player-turnaround-plan.js');
before('./js/player-turnaround-plan-report.js','./js/release-diagnostics-ui.js');
before('./js/release-diagnostics-ui.js','./js/playtest-report-ui.js');
before('./js/playtest-report-ui.js','./js/d-ui-shell.js');
before('./js/d-ui-shell.js','./js/runtime-recovery-ui.js');
assert(expected.at(-1) === './js/runtime-recovery-ui.js', 'runtime recovery must remain the final external UI module');
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
const boot = vm.runInContext("globalThis[Symbol.for('capitalismTycoon.bootRecovery')]", ctx);
assert(boot?.__installed === true, 'boot recovery symbol registry missing');
assert(boot.SAVE_KEY === 'capitalism_tycoon_web_v1', 'boot recovery save key drifted');
assert(typeof boot.bridge === 'function' && typeof boot.download === 'function', 'boot recovery contract missing');
assert(modules && typeof modules === 'object', 'registry missing');
assert(Object.prototype.propertyIsEnumerable.call(ctx, '__capitalismTycoonModules') === false, 'registry must be non-enumerable');
assert(ctx.loadCalls === 1, `TycoonEngine.load expected once, got ${ctx.loadCalls}`);
assert(ctx.renderEvents === 1, `initial render expected once, got ${ctx.renderEvents}`);
assert(listenerRegistrations >= 6, 'expected UI event listeners');

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
  playerEngineBridge:['bindEngine','getEngine','__installed'],
  strategyBalance:['VERSION','DEMAND_CALIBRATIONS','apply','__installed'],
  progressionBalance:['REQUIRED_IPO_REPORT_WEEKS','REPORT_HISTORY_REASON','reportCount','missingReasons','__installed'],
  difficultyScenarioBalance:['VERSION','STANDARD_TARGET_WEEK','HISTORY_LIMIT','WARNING_WEEKS','DIFFICULTY_PROFILES','SCENARIO_PROFILES','difficultyProfile','scenarioProfile','gradeForWeek','scoreForWeek','ensure','reconcileOpeningFinance','evaluate','snapshot','validate','__installed'],
  playerCrisisRestructuring:['HISTORY_LIMIT','DISPOSITION_TYPES','COST_ACTION_TYPES','ELIGIBLE_STATUSES','ensure','options','costOptions','validate','__installed'],
  playerCrisisCreditor:['NEGOTIATION_TYPES','ELIGIBLE_STATUSES','HISTORY_LIMIT','COOLDOWN_WEEKS','DEFERRAL_WEEKS','EXTENSION_WEEKS','FAILURE_CREDIT_PENALTY','ensure','activeLoans','approvalChance','options','findCandidate','hashRoll','validate','__installed'],
  playerDebtService:['ordinaryRate','negotiatedRate','weeklyRate','weeklyInterest','inWeeklyContext','shadowWithoutNegotiatedDiscounts','__installed'],
  playerTurnaroundPlan:['STATUSES','ELIGIBLE_STATUSES','HISTORY_LIMIT','TERM_WEEKS','ensure','start','cancel','evaluate','snapshot','metrics','validate','__installed'],
  playerCrisisCreditorUI:['renderSection','enhance','bindEngine','handleClick','findCandidate','LABELS','__installed'],
  playerTurnaroundPlanUI:['renderSection','standalone','enhance','bindEngine','handleClick','startPreview','latestHistory','STATUS_LABELS','__installed'],
  playerTurnaroundPlanReport:['REPORT_KINDS','KIND_LABELS','capture','buildReport','message','applyReport','renderSummarySection','enhanceSummary','connect','__installed'],
  releaseDiagnosticsUI:['VERSION','SAVE_KEY','SAVE_VERSION','SAFE_ENTRY','diagnosticSnapshot','renderKey','renderCard','latestLaunchUrl','diagnosticText','copyText','settingsVisible','enhance','handleClick','install','__installed'],
  playtestReportUI:['SCHEMA_VERSION','KIND','MAX_ACTIONS','safeToken','utf8Bytes','checksum','record','activeTab','saveFingerprint','viewport','buildReport','filename','download','enhance','handleClick','handleChange','handleSubmit','install','__installed'],
  dUIShell:['PRIMARY_NAV','DOCK_NAV','ALL_NAV','money','reportSeries','sparkline','currentKpis','mapEntities','missionRows','selectedDetail','renderMapWorkspace','enhance','handleClick','install','__installed'],
  runtimeRecoveryUI:['ROOT_ID','SAVE_KEY','buildRecord','readSave','supportPayload','backupFilename','downloadBackup','renderPanel','show','close','capture','handleClick','install','__installed']
};
for (const [name, keys] of Object.entries(requiredExports)) {
  assert(modules[name], `${name} module missing`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(modules[name], key), `${name}.${key} missing`);
}
assert(modules.engine.SAVE_VERSION === 9, `expected save version 9, got ${modules.engine.SAVE_VERSION}`);
for (const marker of ['__competitorMediaInstalled','__competitorParityCompatibilityInstalled','__strategyBalanceInstalled','__progressionBalanceInstalled','__difficultyScenarioBalanceInstalled','__playerCrisisInstalled','__playerCrisisActionsInstalled','__playerCrisisRestructuringInstalled','__playerCrisisCreditorInstalled','__playerDebtServiceInstalled','__playerTurnaroundPlanInstalled','__playerTurnaroundPlanReportInstalled']) assert(modules.engine.TycoonEngine.prototype[marker] === true, `${marker} missing`);
assert(modules.playerEngineBridge.getEngine() instanceof modules.engine.TycoonEngine, 'engine bridge did not capture the app engine');
assert(typeof modules.competitor.dashboard.buildDashboard === 'function', 'competitor dashboard builder missing');
assert(modules.competitor.dashboard.__marketStatusNormalized === true, 'competitor dashboard status normalizer missing');
assert(typeof modules.competitor.dashboardUI.render === 'function', 'competitor dashboard UI rendering missing');
assert(typeof modules.playerCrisisUI.handleClick === 'function', 'player crisis UI action wiring missing');
assert(typeof modules.playerCrisisCreditorUI.handleClick === 'function', 'creditor negotiation UI action wiring missing');
assert(typeof modules.playerTurnaroundPlanUI.handleClick === 'function', 'turnaround plan UI action wiring missing');
assert(typeof modules.playerTurnaroundPlanReport.renderSummarySection === 'function', 'turnaround weekly summary rendering missing');
assert(typeof modules.releaseDiagnosticsUI.latestLaunchUrl === 'function', 'release diagnostics restart wiring missing');
assert(typeof modules.playtestReportUI.buildReport === 'function', 'playtest report build wiring missing');
assert(typeof modules.dUIShell.renderMapWorkspace === 'function', 'D UI map workspace wiring missing');
assert(typeof modules.runtimeRecoveryUI.capture === 'function', 'runtime recovery capture wiring missing');
assert(modules.strategyBalance.VERSION === 1, 'strategy balance version must remain 1');
assert(modules.progressionBalance.REQUIRED_IPO_REPORT_WEEKS === 52, 'IPO report history gate must remain 52 weeks');
assert(modules.difficultyScenarioBalance.STANDARD_TARGET_WEEK === 208, 'standard scenario target must remain 208 weeks');
const afterGlobals = Object.getOwnPropertyNames(ctx).filter(key => !beforeGlobals.has(key) && key !== 'loadCalls' && key !== 'renderEvents');
assert(JSON.stringify(afterGlobals) === JSON.stringify(['__capitalismTycoonModules']), `unexpected globals: ${afterGlobals.join(', ')}`);

expectThrow(() => run(createBrowserContext(), './js/data.js'), /runtime\.js/);
const runtimeOnly = freshWith(['./js/runtime.js']);
expectThrow(() => run(runtimeOnly, './js/competitor.js'), /data\.js/);
expectThrow(() => run(runtimeOnly, './js/market.js'), /data module/);
expectThrow(() => run(runtimeOnly, './js/engine.js'), /data module/);
for (const src of ['./js/strategy-balance.js','./js/progression-balance.js','./js/difficulty-scenario-balance.js','./js/release-diagnostics-ui.js','./js/playtest-report-ui.js','./js/d-ui-shell.js','./js/runtime-recovery-ui.js']) expectThrow(() => run(runtimeOnly, src), /engine\.js/);
const dataReady = freshWith(['./js/runtime.js','./js/data.js']);
for (const src of ['./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) expectThrow(() => run(dataReady, src), /competitor\.js/);
const competitorReady = freshWith(prefix('./js/competitor.js'));
for (const src of ['./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) expectThrow(() => run(competitorReady, src), /competitor-projects\.js/);
const projectsReady = freshWith(prefix('./js/competitor-projects.js'));
for (const src of ['./js/competitor-credit.js','./js/competitor-distress.js']) expectThrow(() => run(projectsReady, src), /competitor-entry\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-entry.js')), './js/competitor-distress.js'), /competitor-credit\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-credit.js')), './js/competitor-terminal-compat.js'), /competitor-distress\.js/);
for (const src of ['./js/save-v9.js','./js/competitor-media.js','./js/player-crisis-ui.js']) expectThrow(() => run(runtimeOnly, src), /engine\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-dashboard-ui.js')), './js/player-engine-bridge.js'), /player-crisis-ui\.js/);
expectThrow(() => run(freshWith(prefix('./js/save-v9.js')), './js/competitor-media.js'), /expansion\.js/);
expectThrow(() => run(freshWith(prefix('./js/completion.js')), './js/competitor-parity.js'), /parity\.js/);
expectThrow(() => run(freshWith(prefix('./js/parity.js')), './js/competitor-dashboard.js'), /competitor-parity\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-parity.js')), './js/competitor-dashboard-status.js'), /competitor-dashboard\.js/);
expectThrow(() => run(freshWith(prefix('./js/competitor-dashboard.js')), './js/competitor-dashboard-ui.js'), /competitor-dashboard-status\.js/);
expectThrow(() => run(freshWith(prefix('./js/progression-balance.js')), './js/difficulty-scenario-balance.js'), /app\.js must install completion and parity/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-ui.js')), './js/player-crisis.js'), /app\.js must install completion and parity/);
expectThrow(() => run(freshWith(prefix('./js/app.js')), './js/player-crisis-actions.js'), /player-crisis\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis.js')), './js/player-crisis-restructuring.js'), /player-crisis-actions\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-actions.js')), './js/player-crisis-creditor.js'), /player-crisis-restructuring\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-restructuring.js')), './js/player-debt-service.js'), /player-crisis-creditor\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-creditor.js')), './js/player-turnaround-plan.js'), /player-debt-service\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-restructuring.js')), './js/player-crisis-creditor-ui.js'), /player-crisis-creditor\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-turnaround-plan.js')), './js/player-turnaround-plan-ui.js'), /player-crisis-creditor-ui\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-crisis-creditor-ui.js')), './js/player-turnaround-plan-report.js'), /player-turnaround-plan-ui\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-turnaround-plan-report.js')), './js/playtest-report-ui.js'), /release-diagnostics-ui\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-turnaround-plan-report.js')), './js/d-ui-shell.js'), /player-engine-bridge\.js|release-diagnostics-ui\.js|engine\.js/);
expectThrow(() => run(freshWith(prefix('./js/player-turnaround-plan-report.js')), './js/runtime-recovery-ui.js'), /release-diagnostics-ui\.js/);

const duplicateRegistration = /already (?:installed|registered|normalized)|D UI shell is already registered/;
for (const src of [
  './js/boot-recovery.js','./js/save-v9.js','./js/competitor-media.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/competitor-dashboard-ui.js',
  './js/player-crisis-ui.js','./js/player-engine-bridge.js','./js/strategy-balance.js','./js/progression-balance.js','./js/difficulty-scenario-balance.js','./js/player-crisis.js','./js/player-crisis-actions.js','./js/player-crisis-restructuring.js','./js/player-crisis-creditor.js','./js/player-debt-service.js','./js/player-turnaround-plan.js','./js/player-crisis-creditor-ui.js','./js/player-turnaround-plan-ui.js','./js/player-turnaround-plan-report.js','./js/release-diagnostics-ui.js','./js/playtest-report-ui.js','./js/d-ui-shell.js','./js/runtime-recovery-ui.js','./js/competitor-terminal-compat.js','./js/competitor-distress.js','./js/data.js'
]) expectThrow(() => run(ctx, src), duplicateRegistration);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
