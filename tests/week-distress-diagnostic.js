const fs = require('node:fs');
const path = require('node:path');
const { loadGame, findStateIssues } = require('./harness');
const mode = process.argv[2];
const assert = (ok, message) => { if (!ok) throw new Error(message); };

function game() {
  const loaded = loadGame();
  return { ...loaded, TycoonEngine: loaded.engineModule.TycoonEngine };
}

function exceptionRecovery(methodName) {
  const { TycoonEngine } = game();
  const engine = new TycoonEngine();
  engine.configure({ playerName:'Tester', companyName:`Exception ${methodName}`, difficulty:'normal', scenario:'free' });
  const original = engine[methodName];
  const marker = new Error(`${methodName} forced failure`);
  engine[methodName] = function() { throw marker; };
  try {
    engine.advanceWeek(false);
    throw new Error(`${methodName} exception was not thrown`);
  } catch (error) {
    assert(error === marker, `${methodName} did not rethrow original error: ${error?.stack || error}`);
  } finally {
    engine[methodName] = original;
  }
  assert(engine._transactionDepth === 0, `${methodName} left transaction depth`);
  assert(engine.inTransaction() === false, `${methodName} left inTransaction true`);
  const before = engine.g.week;
  assert(engine.advanceWeek(false) === true, `${methodName} recovery advance failed`);
  assert(engine.g.week === before + 1, `${methodName} recovery week increment mismatch`);
}

function configuredEngine() {
  const { TycoonEngine } = game();
  const engine = new TycoonEngine();
  engine.configure({ playerName:'Tester', companyName:'Baseline Co', difficulty:'normal', scenario:'free' });
  return engine;
}

const cases = {
  supply() { exceptionRecovery('updateSupplyChainWeekly'); },
  completion() { exceptionRecovery('updateCompletionWeekly'); },
  parity() { exceptionRecovery('updateParityWeekly'); },
  first() {
    const engine = configuredEngine();
    const before = engine.g.week;
    assert(engine.advanceWeek(false) === true, 'first advance failed');
    assert(engine.g.week === before + 1, 'first week increment mismatch');
    const issues = findStateIssues(engine.g);
    assert(issues.length === 0, issues.slice(0, 20).join('\n'));
  },
  long() {
    const engine = configuredEngine();
    for (let index = 0; index < 52 && !engine.g.gameOver; index += 1) {
      const before = engine.g.week;
      assert(engine.advanceWeek(false) === true, `advance failed at ${before}`);
      assert(engine.g.week === before + 1, `week mismatch at ${before}`);
      const issues = findStateIssues(engine.g);
      assert(issues.length === 0, `week ${engine.g.week}: ${issues.slice(0, 20).join('\n')}`);
    }
    globalThis.__weekDiagnosticSave = JSON.stringify(engine.g);
  },
  roundtrip() {
    const { TycoonEngine } = game();
    const engine = configuredEngine();
    for (let index = 0; index < 8 && !engine.g.gameOver; index += 1) engine.advanceWeek(false);
    const reloaded = new TycoonEngine(JSON.parse(JSON.stringify(engine.g)));
    assert(reloaded.g.week === engine.g.week, 'roundtrip week mismatch');
    assert(reloaded.g.companyCash === engine.g.companyCash, 'roundtrip cash mismatch');
    assert(reloaded.g.reports.length === engine.g.reports.length, 'roundtrip report mismatch');
  },
  legacy() {
    const { TycoonEngine } = game();
    const raw = fs.readFileSync(path.join(__dirname, 'fixtures', 'legacy-minimal-v1.json'), 'utf8');
    const engine = new TycoonEngine(JSON.parse(raw));
    engine.normalize();
    assert(Array.isArray(engine.g.reports) && Array.isArray(engine.g.news), 'legacy arrays missing');
    JSON.stringify(engine.g);
  },
  distressValidator() {
    const { modules } = game();
    const state = modules.engine.createInitialState({ configured:true });
    state.skipWeeklyValidation = true;
    const engine = new modules.engine.TycoonEngine(state);
    engine.advanceWeek(false);
    modules.competitor.validateDistress(engine.g);
  },
  fullValidator() {
    const { modules } = game();
    const state = modules.engine.createInitialState({ configured:true });
    state.skipWeeklyValidation = true;
    const engine = new modules.engine.TycoonEngine(state);
    engine.advanceWeek(false);
    modules.competitor.validate(engine.g);
  }
};

if (!cases[mode]) throw new Error(`unknown week diagnostic mode: ${mode}`);
cases[mode]();
console.log(`week diagnostic passed: ${mode}`);
