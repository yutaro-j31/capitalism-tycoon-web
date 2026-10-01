'use strict';

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const SEED = 0x3f001608;
const CANDIDATE_ID = 'repeatable-candidate';
const COST = 20_000_000;

function candidate() {
  return { id:CANDIDATE_ID, name:'反復研究候補', sector:'software', requiredCapital:COST, attractiveness:.9, regulatoryRisk:.1 };
}

function prepare() {
  const loaded = loadGame();
  const engine = loaded.ctx.__ct_engine;
  engine.configure({ playerName:'Gate F Founder', companyName:'Gate F Co', difficulty:'normal', scenario:'free', simulationSeed:SEED });
  engine.g.companyCash = 500_000_000;
  engine.g.finance = loaded.modules.finance.defaultFinanceState(engine.g);
  engine.g.newBusinessAnalysis = { candidates:[candidate()] };
  return { loaded, engine };
}

function finishResearch(loaded, engine, project) {
  for (let elapsed = 0; elapsed <= project.durationWeeks; elapsed += 1) {
    engine.g.week = project.startWeek + elapsed;
    loaded.modules.newBusinessResearchProjects.progress(engine.g);
  }
  assert.notEqual(project.status, 'researching');
}

const firstRun = prepare();
const { loaded, engine } = firstRun;
const initialDraws = engine.g.simulationRng.draws;
const initialCash = engine.g.companyCash;
const initialPersonal = engine.g.personalCash;
assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), true);
const firstProject = engine.g.newBusinessResearch.projects[0];
assert.equal(firstProject.id, `research-${firstProject.startWeek}-${CANDIDATE_ID}`);
assert.equal(engine.g.simulationRng.draws, initialDraws, 'project ID allocation consumes no simulation RNG');
assert.equal(engine.g.companyCash, initialCash - COST);
assert.equal(engine.g.personalCash, initialPersonal);

finishResearch(loaded, engine, firstProject);
engine.g.week += 7;
const secondStartWeek = engine.g.week;
const restartDraws = engine.g.simulationRng.draws;
assert.equal(engine.startNewBusinessResearch(CANDIDATE_ID), true);
const secondProject = engine.g.newBusinessResearch.projects[0];
assert.equal(secondProject.id, `research-${secondStartWeek}-${CANDIDATE_ID}`);
assert.notEqual(secondProject.id, firstProject.id);
assert.equal(engine.g.simulationRng.draws, restartDraws);

const researchRows = engine.g.finance.transactions.filter(row => row.sourceType === 'newBusinessResearch');
assert.equal(researchRows.length, 2);
assert.equal(new Set(researchRows.map(row => row.sourceID)).size, 2);
assert.equal(new Set(researchRows.map(row => row.operationID)).size, 2);
assert.equal(new Set(researchRows.map(row => row.idempotencyKey)).size, 2);
for (const row of researchRows) {
  assert.equal(row.category, 'researchAndDevelopment');
  assert.equal(row.cashEffect, -COST);
  assert.equal(row.profitEffect, -COST);
  assert.equal(row.assetEffect, 0);
}
assert.equal(loaded.modules.finance.validate(engine.g).ok, true);

const deterministic = prepare();
assert.equal(deterministic.engine.startNewBusinessResearch(CANDIDATE_ID), true);
assert.equal(deterministic.engine.g.newBusinessResearch.projects[0].id, firstProject.id, 'same persisted inputs produce the same ID');

const collisionState = {
  week:44,
  newBusinessResearch:{ projects:[
    { id:`research-44-${CANDIDATE_ID}`, candidateId:CANDIDATE_ID, startWeek:44, status:'failed' },
    { id:`research-44-${CANDIDATE_ID}-2`, candidateId:CANDIDATE_ID, startWeek:44, status:'failed' }
  ] }
};
assert.equal(loaded.modules.newBusinessResearchProjects.nextProjectId(collisionState.newBusinessResearch.projects, 44, CANDIDATE_ID), `research-44-${CANDIDATE_ID}-3`);

assert.equal(engine.save(), true);
const saved = loaded.ctx.__localStorageData.get(loaded.engineModule.SAVE_KEY);
const roundTrip = loadGame({ localStorageInitial:{ [loaded.engineModule.SAVE_KEY]:saved } });
assert.deepEqual(
  JSON.parse(JSON.stringify(roundTrip.ctx.__ct_engine.g.newBusinessResearch.projects.map(project => ({ id:project.id, startWeek:project.startWeek })))),
  JSON.parse(JSON.stringify(engine.g.newBusinessResearch.projects.map(project => ({ id:project.id, startWeek:project.startWeek }))))
);

const legacyId = 'research-new-business-legacy';
const olderReady = { id:legacyId, candidateId:'legacy', name:'旧案件', sector:'service', startWeek:3, status:'ready', invested:40_000_000, outcomeScore:.7 };
const newerResearching = { id:legacyId, candidateId:'legacy', name:'新案件', sector:'service', startWeek:11, status:'researching', invested:40_000_000, outcomeScore:.7 };
const legacy = prepare();
legacy.engine.g.week = 30;
legacy.engine.g.newBusinessResearch = { projects:[newerResearching, olderReady], history:[], lastProgressWeek:null };
legacy.engine.g.newBusinesses = [{ id:`business-${legacyId}`, marker:'preserve-launch' }];
legacy.engine.g.maSubsidiaries = [{ id:`spinout-${legacyId}`, marker:'preserve-spinout' }];
const legacyIdsBefore = legacy.engine.g.newBusinessResearch.projects.map(project => project.id);
assert.equal(legacy.engine.commercializeNewBusiness(legacyId, 'launch'), true, 'ID-only fallback selects ready legacy duplicate');
assert.equal(olderReady.status, 'commercialized');
assert.equal(newerResearching.status, 'researching');
assert.deepEqual(legacy.engine.g.newBusinessResearch.projects.map(project => project.id), legacyIdsBefore, 'legacy project IDs are never rewritten');
assert.equal(legacy.engine.g.newBusinesses[0].id, `${`business-${legacyId}`}-w30`);
assert.equal(legacy.engine.g.newBusinesses[1].id, `business-${legacyId}`);

olderReady.status = 'ready';
delete olderReady.commercializedWeek;
delete olderReady.commercializationMode;
legacy.engine.g.week = 31;
assert.equal(legacy.engine.commercializeNewBusiness({ id:legacyId, startWeek:11 }, 'abandon'), false, 'explicit non-ready target never falls through to another duplicate');
assert.equal(olderReady.status, 'ready');
assert.equal(newerResearching.status, 'researching');
newerResearching.status = 'ready';
assert.equal(legacy.engine.commercializeNewBusiness({ id:legacyId, startWeek:11 }, 'spinout'), true);
assert.equal(newerResearching.status, 'commercialized');
assert.equal(olderReady.status, 'ready', 'only the explicitly selected duplicate changes');
assert.equal(legacy.engine.g.maSubsidiaries[0].id, `${`spinout-${legacyId}`}-w31`);
assert.equal(legacy.engine.g.maSubsidiaries[1].id, `spinout-${legacyId}`);

assert.equal(legacy.engine.save(), true);
const legacySaved = legacy.loaded.ctx.__localStorageData.get(legacy.loaded.engineModule.SAVE_KEY);
const legacyReloaded = loadGame({ localStorageInitial:{ [legacy.loaded.engineModule.SAVE_KEY]:legacySaved } });
assert.deepEqual(Array.from(legacyReloaded.ctx.__ct_engine.g.newBusinessResearch.projects, project => project.id), legacyIdsBefore);

const rollback = prepare();
rollback.engine.g.week = 50;
rollback.engine.g.newBusinessResearch = { projects:[{ id:'research-rollback', candidateId:'rollback', name:'rollback', startWeek:8, status:'ready', invested:COST, outcomeScore:.8 }], history:[] };
rollback.engine.g.maSubsidiaries = new Proxy([], { get(target, property, receiver) { if (property === 'unshift') return () => { throw new Error('forced derived-ID failure'); }; return Reflect.get(target, property, receiver); } });
const rollbackBefore = JSON.stringify({ project:rollback.engine.g.newBusinessResearch, subsidiaries:rollback.engine.g.maSubsidiaries, cash:rollback.engine.g.companyCash, finance:rollback.engine.g.finance, rng:rollback.engine.g.simulationRng });
assert.throws(() => rollback.engine.commercializeNewBusiness({ id:'research-rollback', startWeek:8 }, 'spinout'), /forced derived-ID failure/);
assert.equal(JSON.stringify({ project:rollback.engine.g.newBusinessResearch, subsidiaries:rollback.engine.g.maSubsidiaries, cash:rollback.engine.g.companyCash, finance:rollback.engine.g.finance, rng:rollback.engine.g.simulationRng }), rollbackBefore);

assert.equal(loaded.engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.g.saveVersion, 9);
console.log('new business project identity tests passed');
