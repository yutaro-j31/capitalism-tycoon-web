const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, readIndex, extractScripts, createBrowserContext } = require('./harness');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const expected = ['./js/runtime.js','./js/data.js','./js/workforce.js','./js/supply.js','./js/competitor.js','./js/competitor-projects.js','./js/competitor-entry.js','./js/competitor-credit.js','./js/competitor-distress.js','./js/market.js','./js/finance.js','./js/engine.js','./js/save-v9.js','./js/expansion.js','./js/competitor-media.js','./js/completion.js','./js/parity.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/app.js'];
const scripts = extractScripts(readIndex()).filter(s => s.src);
assert(JSON.stringify(scripts.map(s => s.src)) === JSON.stringify(expected), `script order mismatch: ${scripts.map(s => s.src).join(', ')}`);
assert(scripts[0].src === './js/runtime.js', 'runtime.js must be first');
assert(scripts[scripts.length - 1].src === './js/app.js', 'app.js must be last');
for (const s of scripts) {
  assert(fs.existsSync(s.file), `${s.src} missing`);
  const buf = fs.readFileSync(s.file);
  assert(buf.length > 0, `${s.src} is empty`);
  assert(!(buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf), `${s.src} has BOM`);
  const text = buf.toString('utf8');
  assert(!/\r/.test(text), `${s.src} must use LF`);
  assert(!/[\u202A-\u202E\u2066-\u2069]/.test(text), `${s.src} has invisible bidi control characters`);
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
for (const s of scripts) {
  let code = s.code;
  if (s.src === './js/app.js') {
    code = code.replace('const engine = TycoonEngine.load();', 'const engine = (loadCalls++, TycoonEngine.load());');
    code = code.replace('function render() {', 'function render() {renderEvents++;');
  }
  vm.runInContext(code, ctx, { filename: s.src });
}
const modules = ctx.__capitalismTycoonModules;
assert(modules && typeof modules === 'object', 'registry missing');
assert(Object.prototype.propertyIsEnumerable.call(ctx, '__capitalismTycoonModules') === false, 'registry must be non-enumerable');
assert(ctx.loadCalls === 1, `TycoonEngine.load expected once, got ${ctx.loadCalls}`);
assert(ctx.renderEvents === 1, `initial render expected once, got ${ctx.renderEvents}`);
assert(listenerRegistrations >= 4, 'expected UI event listeners to be registered');
assert(modules.engine && modules.engine.TycoonEngine, 'TycoonEngine export missing');
for (const [name, keys] of Object.entries({
  data:['MASTER','PRODUCT_BLUEPRINTS','LUXURY_OFFERS','PERSONAL_INVESTMENT_OFFERS','OVERSEAS_COUNTRIES','SPORTS_TEAMS','MISSION_DEFS'],
  workforce:['ROLES','recompute','validate','storeAdjustment'],
  supply:['MATERIALS','SUPPLIERS','createOrder','applyConstraint','autoOrder'],
  competitor:['STRATEGIES','ensure','processWeek','validate','MAX_PROJECTS','PROJECT_ACTION_TYPES','ENTRY_LEAD_WEEKS','evaluateEntryCandidates','scheduleMarketEntry','MAX_CREDIT_HISTORY','CREDIT_STATUSES','calculateCreditLimit','reviewCompanyCredit','MAX_LIFECYCLE_HISTORY','LIFECYCLE_STATUSES','distressScore','startTurnaroundPlan','declareBankruptcy','sanitizeNewspapers','newspaperEventText','ensureCounterStates','installParityCompatibility','dashboard','__parityCompatibilityRegistered','__distressInstalled'],
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
assert(modules.engine.TycoonEngine.prototype.__competitorParityCompatibilityInstalled === true, 'competitor parity compatibility missing');
assert(typeof modules.competitor.dashboard.buildDashboard === 'function', 'competitor dashboard builder missing');
assert(modules.competitor.dashboard.__marketStatusNormalized === true, 'competitor dashboard status normalizer missing');
const afterGlobals = Object.getOwnPropertyNames(ctx).filter(k => !beforeGlobals.has(k) && k !== 'loadCalls' && k !== 'renderEvents');
assert(JSON.stringify(afterGlobals) === JSON.stringify(['__capitalismTycoonModules']), `unexpected globals: ${afterGlobals.join(', ')}`);

const noRuntime = createBrowserContext();
assert.throws = (fn, re) => { try { fn(); } catch (e) { assert(re.test(String(e.message)), `error message mismatch: ${e.message}`); return; } throw new Error('expected throw'); };
assert.throws(() => vm.runInContext(scripts[1].code, noRuntime), /runtime\.js/);
const missingData = createBrowserContext();
vm.runInContext(scripts[0].code, missingData);
assert.throws(() => vm.runInContext(scripts[4].code, missingData), /data\.js/);
assert.throws(() => vm.runInContext(scripts[9].code, missingData), /data module/);
assert.throws(() => vm.runInContext(scripts[11].code, missingData), /data module/);
const missingCompetitor = createBrowserContext();
vm.runInContext(scripts[0].code, missingCompetitor);
vm.runInContext(scripts[1].code, missingCompetitor);
for (const index of [5,6,7,8]) assert.throws(() => vm.runInContext(scripts[index].code, missingCompetitor), /competitor\.js/);
const missingProjects = createBrowserContext();
vm.runInContext(scripts[0].code, missingProjects);
vm.runInContext(scripts[1].code, missingProjects);
vm.runInContext(scripts[4].code, missingProjects);
for (const index of [6,7,8]) assert.throws(() => vm.runInContext(scripts[index].code, missingProjects), /competitor-projects\.js/);
const missingEntry = createBrowserContext();
vm.runInContext(scripts[0].code, missingEntry);
vm.runInContext(scripts[1].code, missingEntry);
vm.runInContext(scripts[4].code, missingEntry);
vm.runInContext(scripts[5].code, missingEntry);
for (const index of [7,8]) assert.throws(() => vm.runInContext(scripts[index].code, missingEntry), /competitor-entry\.js/);
const missingCredit = createBrowserContext();
vm.runInContext(scripts[0].code, missingCredit);
vm.runInContext(scripts[1].code, missingCredit);
vm.runInContext(scripts[4].code, missingCredit);
vm.runInContext(scripts[5].code, missingCredit);
vm.runInContext(scripts[6].code, missingCredit);
assert.throws(() => vm.runInContext(scripts[8].code, missingCredit), /competitor-credit\.js/);
const missingEngine = createBrowserContext();
vm.runInContext(scripts[0].code, missingEngine);
assert.throws(() => vm.runInContext(scripts[12].code, missingEngine), /engine\.js/);
assert.throws(() => vm.runInContext(scripts[14].code, missingEngine), /engine\.js/);
const missingExpansion = createBrowserContext();
for (let index = 0; index <= 12; index += 1) vm.runInContext(scripts[index].code, missingExpansion);
assert.throws(() => vm.runInContext(scripts[14].code, missingExpansion), /expansion\.js/);
const missingParity = createBrowserContext();
for (let index = 0; index <= 15; index += 1) vm.runInContext(scripts[index].code, missingParity);
assert.throws(() => vm.runInContext(scripts[17].code, missingParity), /parity\.js/);
const missingParityCompatibility = createBrowserContext();
for (let index = 0; index <= 16; index += 1) vm.runInContext(scripts[index].code, missingParityCompatibility);
assert.throws(() => vm.runInContext(scripts[18].code, missingParityCompatibility), /competitor-parity\.js/);
const missingDashboard = createBrowserContext();
for (let index = 0; index <= 17; index += 1) vm.runInContext(scripts[index].code, missingDashboard);
assert.throws(() => vm.runInContext(scripts[19].code, missingDashboard), /competitor-dashboard\.js/);
assert.throws(() => vm.runInContext(scripts[12].code, ctx), /already installed/);
assert.throws(() => vm.runInContext(scripts[14].code, ctx), /already installed/);
assert.throws(() => vm.runInContext(scripts[17].code, ctx), /already installed/);
assert.throws(() => vm.runInContext(scripts[18].code, ctx), /already registered/);
assert.throws(() => vm.runInContext(scripts[19].code, ctx), /already normalized/);
assert.throws(() => vm.runInContext(scripts[8].code, ctx), /already installed/);
assert.throws(() => vm.runInContext(scripts[1].code, ctx), /already registered/);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
