'use strict';
// P3-4 W-COMMERCIAL-SPINOUT: three new-business research projects generated, started and researched to `ready` with the
// installed writers (generateNewBusinessCandidates -> startNewBusinessResearch -> installed weeks, week 13). Deciding a
// project's commercialization (commercializeNewBusiness) is the command under test, in each installed mode. The only
// hand-set input is a cash buffer, with the matching opening finance state.
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');

const VARIANTS = Object.freeze({ spinout: { mode: 'spinout', index: 0 }, launch: { mode: 'launch', index: 1 }, abandon: { mode: 'abandon', index: 2 } });
let readyState = null;
function researchedState() {
  if (readyState) return readyState;
  const ctx = boot(), game = new ctx.engineModule.TycoonEngine();
  game.configure({ playerName: 'T', companyName: 'Lab', difficulty: 'normal', scenario: 'free', simulationSeed: 971 });
  game.g.companyCash = 3_000_000_000; game.g.finance = ctx.modules.finance.defaultFinanceState(game.g);
  assert.equal(game.generateNewBusinessCandidates(), true, 'production candidate analysis');
  const candidates = game.g.newBusinessAnalysis.candidates.slice(0, 3);
  assert.equal(candidates.length, 3);
  for (const c of candidates) assert.equal(game.startNewBusinessResearch(c.id), true, 'production research start');
  while (game.g.newBusinessResearch.projects.some(p => p.status !== 'ready') && game.g.week < 60) advance(game);
  assert.ok(game.g.newBusinessResearch.projects.length === 3 && game.g.newBusinessResearch.projects.every(p => p.status === 'ready'), 'all projects ready');
  return (readyState = JSON.stringify(game.g));
}
async function fixture(variant = 'spinout') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known commercialization variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(researchedState()));
  const project = game.g.newBusinessResearch.projects[VARIANTS[variant].index];
  assert.equal(project.status, 'ready');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, mode: VARIANTS[variant].mode, projectID: project.id, identity: { id: project.id, startWeek: project.startWeek } };
}
const command = ctx => ctx.game.commercializeNewBusiness(ctx.identity, ctx.mode);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
