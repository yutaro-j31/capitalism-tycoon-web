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

const scripts = extractScripts(readIndex()).filter(script => script.src);
const expected = scripts.map(script => script.src);
const bySrc = new Map(scripts.map(script => [script.src, script]));
const run = (context, src, code = bySrc.get(src)?.code) => vm.runInContext(code, context, { filename: src });
const before = (left, right) => assert(expected.indexOf(left) >= 0 && expected.indexOf(left) < expected.indexOf(right), `${left} must precede ${right}`);

const allModules=fs.readdirSync(path.join(ROOT,'js')).filter(name=>name.endsWith('.js')).map(name=>`./js/${name}`);
assert(expected.length===new Set(expected).size,'script references must not be duplicated');
assert(allModules.length===expected.length&&allModules.every(src=>expected.includes(src)),'every JavaScript module must be connected exactly once');
assert(expected[0] === './js/boot-diagnostics.js', 'boot diagnostics must be first');
assert(expected[1] === './js/boot-recovery.js', 'boot recovery must immediately follow diagnostics');
assert(expected.at(-1) === './js/iphone-playtest-fixes.js', 'iPhone playtest fixes must remain final');
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
assert(modules.realEstate?.VERSION === 3, 'real estate module version missing');
for (const key of ['ensure','ensureProperty','processWeek','processLoans','processMarketWeek','eventDefinition','marketProfile','valuationParts','collateralCapacity','rentable']) assert(typeof modules.realEstate[key] === 'function', `realEstate.${key} missing`);
assert(Object.keys(modules.realEstate.REGIONS||{}).length>=5,'regional market definitions missing');
assert(Object.keys(modules.realEstate.PROPERTY_TYPES||{}).length>=7,'property type definitions missing');
const activeEngine = modules.playerEngineBridge?.getEngine?.();
assert(activeEngine instanceof modules.engine.TycoonEngine, 'engine bridge did not capture app engine');
for (const key of ['enablePropertyRental','disablePropertyRental','getPropertyInvestmentMetrics','getPropertyMarketProfile','setPropertyMarketSegment','borrowAgainstProperty','repayPropertyLoan','sellPropertyInvestment']) assert(typeof activeEngine[key] === 'function', `engine.${key} missing`);

const runtimeOnly = createBrowserContext();
run(runtimeOnly, './js/runtime.js');
expectThrow(() => run(runtimeOnly, './js/real-estate.js'), /engine\.js/);
expectThrow(() => run(ctx, './js/real-estate.js'), /already registered/);

fs.writeFileSync(path.join(ROOT, 'tests', 'fixtures', 'module-load-order.json'), JSON.stringify({ scripts: expected }, null, 2) + '\n');
console.log('javascript module split checks passed');
