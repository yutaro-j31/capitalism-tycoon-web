const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, createBrowserContext } = require('./harness');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
assert.throws = (fn, re) => { try { fn(); } catch (error) { assert(re.test(String(error.message)), `error message mismatch: ${error.message}`); return; } throw new Error('expected throw'); };
const expected = ['./js/runtime.js','./js/data.js','./js/workforce.js','./js/supply.js','./js/competitor.js','./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js','./js/competitor-terminal-compat.js','./js/market.js','./js/finance.js','./js/engine.js','./js/save-v9.js','./js/expansion.js','./js/competitor-media.js','./js/completion.js','./js/parity.js','./js/app.js'];
const scripts = extractScripts(readIndex()).filter(script => script.src);
const bySrc = new Map(scripts.map(script => [script.src, script]));
const run = (ctx, src) => {
  const script = bySrc.get(src);
  assert(script, `${src} missing from index`);
  return vm.runInContext(script.code, ctx, { filename: src });
};
assert(JSON.stringify(scripts.map(script => script.src)) === JSON.stringify(expected), `script order mismatch: ${scripts.map(script => script.src).join(', ')}`);
assert(scripts[0].src === './js/runtime.js', 'runtime.js must be first');
assert(scripts[scripts.length - 1].src === './js/app.js', 'app.js must be last');
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
  let source = script.code;
  if (script.src === './js/app.js') {
    source = source.replace('const engine = TycoonEngine.load();', 'const engine = (loadCalls++, TycoonEngine.load());');
    source = source.replace('function render() {', 'function render() {renderEvents++;');
  }
  vm.runInContext(source, ctx, { filename: script.src });
}
const modules = ctx.__capitalismTycoonModules;
assert(modules && typeof modules === 'object', 'registry missing');
assert(Object.prototype.propertyIsEnumerable.call(ctx, '__capitalismTycoonModules') === false, 'registry must be non-enumerable');
assert(ctx.loadCalls === 1, `TycoonEngine.load expected once, got ${ctx.loadCalls}`);
assert(ctx.renderEvents === 1, `initial render expected once, got ${ctx.renderEvents}`);
assert(listenerRegistrations >= 4, 'expected UI event listeners to be registered');
for (const [name, keys] of Object.entries({
  data:['MASTER','PRODUCT_BLUEPRINTS','LUXURY_OFFERS','PERSONAL_INVESTMENT_OFFERS','OVERSEAS_COUNTRIES','SPORTS_TEAMS','MISSION_DEFS'],
  workforce:['ROLES','recompute','validate','storeAdjustment'],
  supply:['MATERIALS','SUPPLIERS','createOrder','applyConstraint','autoOrder'],
  competitor:['STRATEGIES','ensure','processWeek','validate','MAX_PROJECTS','PROJECT_ACTION_TYPES','ENTRY_LEAD_WEEKS','evaluateEntryCandidates','scheduleMarketEntry','MAX_CREDIT_HISTORY','CREDIT_STATUSES','calculateCreditLimit','reviewCompanyCredit','MAX_LIFECYCLE_HISTORY','LIFECYCLE_STATUSES','distressScore','startTurnaroundPlan','declareBankruptcy','preserveCompetitorEvents','archiveLegacyCompetitor','syncProjectFailureReasons','sanitizeNewspapers','newspaperEventText','__distressInstalled','__terminalCompatInstalled'],
  market:['calculateMarkets','effectiveCapacity','competitorOffers','SEGMENTS'],
  finance:['ensureFinance','event','recordWeekly','buildStatements','validate'],
  engine:['TycoonEngine','SAVE_VERSION','migrateSave','migrateV8ToV9','yen','compactYen','pct','finite','__saveV9Installed'],
  expansion:['installExpansion','FOUNDER_TRAITS','FOUNDER_HOME_PRODUCTS','SUPPLIER_OFFERS','VERTICAL_INTEGRATION_OFFERS','RD_PROJECTS','PERSONAL_REAL_ESTATE_OFFERS','SUCCESSOR_CANDIDATES'],
  completion:['installCompletion','MEDIA_ACTIONS','TRANSPORT_REBUILD_ACTIONS','ENDING_DEFS'],
  parity:['installParity','KEY_PERSON_ROLES']
})) {
  assert(modules[name], `${name} module missing`);
  for (const key of keys) assert(Object.prototype.hasOwnProperty.call(modules[name], key), `${name}.${key} missing`);
}
assert(modules.engine.SAVE_VERSION === 9, `expected save version 9, got ${modules.engine.SAVE_VERSION}`);
assert(modules.engine.TycoonEngine.prototype.__competitorMediaInstalled === true, 'competitor media patch missing');
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
run(missingProjects, './js/runtime.js');
run(missingProjects, './js/data.js');
run(missingProjects, './js/competitor.js');
for (const src of ['./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js']) assert.throws(() => run(missingProjects, src), /competitor-projects\.js/);
const missingEntry = createBrowserContext();
for (const src of ['./js/runtime.js','./js/data.js','./js/competitor.js','./js/competitor-projects.js']) run(missingEntry, src);
for (const src of ['./js/competitor-credit.js','./js/competitor-distress.js']) assert.throws(() => run(missingEntry, src), /competitor-entry\.js/);
const missingCredit = createBrowserContext();
for (const src of ['./js/runtime.js','./js/data.js','./js/competitor.js','./js/competitor-projects.js','./js/competitor-entry.js']) run(missingCredit, src);
assert.throws(() => run(missingCredit, './js/competitor-distress.js'), /competitor-credit\.js/);
const missingDistress = createBrowserContext();
for (const src of ['./js/runtime.js','./js/data.js','./js/competitor.js','./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js']) run(missingDistress, src);
assert.throws(() => run(missingDistress, './js/competitor-terminal-compat.js'), /competitor-distress\.js/);
const missingEngine = createBrowserContext();
run(missingEngine, './js/runtime.js');
assert.throws(() => run(missingEngine, './js/save-v9.js'), /engine\.js/);
assert.throws(() => run(missingEngine, './js/competitor-media.js'), /engine\.js/);
const missingExpansion = createBrowserContext();
for (const src of expected.slice(0, expected.indexOf('./js/expansion.js'))) run(missingExpansion, src);
assert.throws(() => run(missingExpansion, './js/competitor-media.js'), /expansion\.js/);
assert.throws(() => run(ctx, './js/competitor-terminal-compat.js'), /already installed/);
assert.throws(() => run(ctx, './js/save-v9.js'), /already installed/);
assert.throws(() => run(ctx, './js/competitor-media.js'), /already installed/);
assert.throws(() => run(ctx, './js/competitor-distress.js'), /already installed/);
assert.throws(() => run(ctx, './js/data.js'), /already registered/);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
