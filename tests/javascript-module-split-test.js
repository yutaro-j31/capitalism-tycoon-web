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
  './js/market.js','./js/finance.js','./js/engine.js','./js/real-estate.js','./js/save-v9.js','./js/ma-integration.js','./js/ma-deal-room.js','./js/expansion.js','./js/competitor-media.js','./js/completion.js','./js/parity.js','./js/executive-secretary.js','./js/competitor-parity.js','./js/competitor-dashboard.js','./js/competitor-dashboard-status.js','./js/competitor-dashboard-ui.js',
  './js/player-crisis-ui.js','./js/player-engine-bridge.js','./js/internal-venture-business.js','./js/ma-portfolio-summary.js','./js/ma-exit-readiness.js','./js/ma-portfolio-summary-ui.js','./js/ma-acquisition-financing.js','./js/ma-board-approval.js','./js/strategy-balance.js','./js/progression-balance.js','./js/founding-tutorial.js','./js/app.js','./js/difficulty-scenario-balance.js','./js/player-crisis.js','./js/player-crisis-actions.js','./js/player-crisis-restructuring.js','./js/player-crisis-creditor.js','./js/player-debt-service.js','./js/player-turnaround-plan.js','./js/player-crisis-creditor-ui.js','./js/player-turnaround-plan-ui.js','./js/player-turnaround-plan-report.js','./js/release-diagnostics-ui.js','./js/playtest-report-ui.js','./js/d-ui-shell.js','./js/d-ui-context-tabs.js','./js/runtime-recovery-ui.js','./js/shareholder-returns.js','./js/capital-allocation-score.js','./js/capital-allocation-policy.js'
];
const scripts = extractScripts(readIndex()).filter(script => script.src);
const bySrc = new Map(scripts.map(script => [script.src, script]));
const run = (context, src, code = bySrc.get(src)?.code) => vm.runInContext(code, context, { filename: src });
const before = (left, right) => assert(expected.indexOf(left) >= 0 && expected.indexOf(left) < expected.indexOf(right), `${left} must precede ${right}`);

assert(JSON.stringify(scripts.map(script => script.src)) === JSON.stringify(expected), `script order mismatch: ${scripts.map(script => script.src).join(', ')}`);
assert(expected[0] === './js/boot-recovery.js', 'boot recovery must be first');
assert(expected.at(-1) === './js/capital-allocation-policy.js', 'capital allocation policy must remain final');
before('./js/engine.js','./js/real-estate.js');
before('./js/real-estate.js','./js/save-v9.js');
before('./js/completion.js','./js/parity.js');
before('./js/player-crisis-ui.js','./js/player-engine-bridge.js');
before('./js/founding-tutorial.js','./js/app.js');
before('./js/app.js','./js/difficulty-scenario-balance.js');

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
ctx.loadCalls = 0;
ctx.renderEvents = 0;
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
assert(ctx.loadCalls === 1, `TycoonEngine.load expected once, got ${ctx.loadCalls}`);
assert(ctx.renderEvents === 1, `initial render expected once, got ${ctx.renderEvents}`);
assert(modules.engine?.SAVE_VERSION === 9, 'save version contract drifted');
assert(modules.realEstate?.VERSION === 2, 'real estate module version missing');
for (const key of ['ensure','processWeek','processLoans','valuationParts','collateralCapacity','rentable']) assert(typeof modules.realEstate[key] === 'function', `realEstate.${key} missing`);
const activeEngine = modules.playerEngineBridge?.getEngine?.();
assert(activeEngine instanceof modules.engine.TycoonEngine, 'engine bridge did not capture app engine');
for (const key of ['enablePropertyRental','disablePropertyRental','getPropertyInvestmentMetrics','borrowAgainstProperty','repayPropertyLoan','sellPropertyInvestment']) assert(typeof activeEngine[key] === 'function', `engine.${key} missing`);

const runtimeOnly = createBrowserContext();
run(runtimeOnly, './js/runtime.js');
expectThrow(() => run(runtimeOnly, './js/real-estate.js'), /engine\.js/);
expectThrow(() => run(ctx, './js/real-estate.js'), /already registered/);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
