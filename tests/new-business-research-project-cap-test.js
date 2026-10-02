'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const CANDIDATE_ID = 'gf3-005-candidate';
const COST = 12_000_000;

function candidate() {
  return { id:CANDIDATE_ID, name:'Protected lifecycle research', sector:'software', requiredCapital:COST, attractiveness:.8, regulatoryRisk:.1 };
}

function project(index, status = 'researching', overrides = {}) {
  return { id:`legacy-${index}`, candidateId:`legacy-candidate-${index}`, name:`Legacy ${index}`, status, startWeek:index + 1, durationWeeks:20, progress:.2, invested:1_000_000, ...overrides };
}

function prepare(protectedCount) {
  const loaded = loadGame();
  const engine = loaded.ctx.__ct_engine;
  engine.configure({ playerName:'GF3-005 Founder', companyName:'GF3-005 Co', difficulty:'normal', scenario:'free', simulationSeed:0x35005 });
  engine.g.companyCash = 500_000_000;
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  engine.g.newBusinessAnalysis = { candidates:[candidate()] };
  engine.g.newBusinessResearch = { projects:Array.from({ length:protectedCount }, (_, index) => project(index, index % 2 ? 'ready' : 'researching')), history:[], lastProgressWeek:null };
  return { loaded, engine, mod:loaded.modules.newBusinessResearchProjects };
}

function researchRows(state) {
  return state.finance.transactions.filter(row => row.sourceType === 'newBusinessResearch');
}

// A: eleven protected projects admit exactly one successful, normally-accounted start.
{
  const { engine, mod } = prepare(11);
  const before = { cash:engine.g.companyCash, personalCash:engine.g.personalCash, rows:researchRows(engine.g).length, draws:engine.g.simulationRng.draws };
  assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), true);
  assert.equal(mod.protectedProjectCount(engine.g), 12);
  assert.equal(engine.g.companyCash, before.cash - COST);
  assert.equal(engine.g.personalCash, before.personalCash);
  assert.equal(researchRows(engine.g).length, before.rows + 1);
  assert.equal(engine.g.simulationRng.draws, before.draws);
}

// B/F: a full protected set rejects before any cash, ledger, project, ID, or RNG mutation.
{
  const { engine, mod } = prepare(12);
  const baseId = `research-${engine.g.week}-${CANDIDATE_ID}`;
  engine.g.newBusinessResearch.projects[0].id = baseId;
  engine.g.newBusinessResearch.projects[1].id = `${baseId}-2`;
  assert.equal(mod.nextProjectId(engine.g.newBusinessResearch.projects, engine.g.week, CANDIDATE_ID), `${baseId}-3`);
  const before = JSON.stringify({
    companyCash:engine.g.companyCash,
    personalCash:engine.g.personalCash,
    finance:engine.g.finance,
    projects:engine.g.newBusinessResearch.projects,
    simulationRng:engine.g.simulationRng
  });
  assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), false);
  assert.equal(JSON.stringify({
    companyCash:engine.g.companyCash,
    personalCash:engine.g.personalCash,
    finance:engine.g.finance,
    projects:engine.g.newBusinessResearch.projects,
    simulationRng:engine.g.simulationRng
  }), before);
  assert.equal(mod.nextProjectId(engine.g.newBusinessResearch.projects, engine.g.week, CANDIDATE_ID), `${baseId}-3`);
}

// C/E: over-cap legacy protected and unknown statuses survive normalize and save/reload.
{
  const { loaded, engine, mod } = prepare(13);
  engine.g.newBusinessResearch.projects[12].status = 'legacy-paused-unknown';
  const ids = engine.g.newBusinessResearch.projects.map(row => row.id);
  engine.normalize();
  assert.deepEqual(engine.g.newBusinessResearch.projects.map(row => row.id), ids);
  assert.equal(mod.protectedProjectCount(engine.g), 13);
  assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), false);
  assert.equal(engine.save(), true);
  const payload = loaded.ctx.__localStorageData.get(loaded.engineModule.SAVE_KEY);
  const reloaded = loadGame({ localStorageInitial:{ [loaded.engineModule.SAVE_KEY]:payload } });
  assert.equal(JSON.stringify(reloaded.ctx.__ct_engine.g.newBusinessResearch.projects.map(row => row.id)), JSON.stringify(ids));
  assert.equal(reloaded.ctx.__ct_engine.startNewBusinessResearch(CANDIDATE_ID), false);
}

// D/I: only terminal statuses are pruned; oldest-first selection is input-order independent.
{
  const { engine, mod } = prepare(11);
  const terminal = [
    project(100, 'failed', { id:'terminal-newest', startWeek:30 }),
    project(101, 'commercialized', { id:'terminal-oldest-b', startWeek:10 }),
    project(102, 'abandoned', { id:'terminal-middle', startWeek:20 }),
    project(103, 'failed', { id:'terminal-oldest-a', startWeek:10 }),
    project(104, 'failed', { id:'terminal-newer', startWeek:25 })
  ];
  const protectedIds = engine.g.newBusinessResearch.projects.map(row => row.id);
  const left = mod.pruneTerminalProjects([...engine.g.newBusinessResearch.projects, ...terminal]).map(row => row.id).sort();
  const right = mod.pruneTerminalProjects([...terminal].reverse().concat(engine.g.newBusinessResearch.projects)).map(row => row.id).sort();
  assert.deepEqual(left, right);
  assert(left.includes('terminal-newest'));
  assert(!left.includes('terminal-oldest-a'));
  engine.g.newBusinessResearch.projects.push(...terminal);
  assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), true);
  assert(protectedIds.every(id => engine.g.newBusinessResearch.projects.some(row => row.id === id)));
  assert.equal(engine.g.newBusinessResearch.projects.filter(mod.isTerminalProject).length, 0);
}

// G: the twelfth protected project persists, and remains a capacity gate after reload.
{
  const { loaded, engine } = prepare(11);
  assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), true);
  assert.equal(engine.save(), true);
  const payload = loaded.ctx.__localStorageData.get(loaded.engineModule.SAVE_KEY);
  const reloaded = loadGame({ localStorageInitial:{ [loaded.engineModule.SAVE_KEY]:payload } });
  assert.equal(reloaded.modules.newBusinessResearchProjects.protectedProjectCount(reloaded.ctx.__ct_engine.g), 12);
  assert.equal(reloaded.ctx.__ct_engine.startNewBusinessResearch(CANDIDATE_ID), false);
}

// H: a post-ledger failure remains atomic under the authoritative transaction path.
{
  const { loaded, engine } = prepare(11);
  const originalEvent = loaded.modules.finance.event;
  const before = JSON.stringify(engine.g);
  loaded.modules.finance.event = function failingFinanceEvent(...args) {
    originalEvent(...args);
    throw new Error('forced GF3-005 finance failure');
  };
  assert.throws(() => engine.startNewBusinessResearch(CANDIDATE_ID), /forced GF3-005 finance failure/);
  assert.equal(JSON.stringify(engine.g), before);
  loaded.modules.finance.event = originalEvent;
}

console.log('new business research project cap tests passed');
