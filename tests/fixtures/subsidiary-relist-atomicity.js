'use strict';
// P3-4 W-SUB-RELIST: a subsidiary listed through the production prepared IPO (the W-SUB-IPO fixture), taken private
// with the installed tender offer and squeeze-out, then given two installed `platform` integration-synergy investments
// and advanced with installed weeks until it is eligible to relist (26 weeks private, two PMI rounds, profitable,
// growth at least 20%). The relisting with one installed strategy is the command under test.
const assert = require('node:assert/strict');
const { boot, advance, snapshot, economic } = require('./subsidiary-quarter-close');
const ipo = require('./subsidiary-ipo-atomicity');

// The installed relisting strategies.
const STRATEGIES = Object.freeze(['control', 'balanced', 'growth']);
let readyState = null;
async function stateReadyToRelist() {
  if (readyState) return readyState;
  const s = await ipo.fixture('balanced'), game = s.game, id = s.subsidiaryID;
  assert.equal(ipo.command(s), true, 'production prepared IPO');
  assert.equal(game.launchListedSubsidiaryTenderOffer(id), true, 'production tender offer');
  assert.equal(game.squeezeOutListedSubsidiary(id), true, 'production squeeze-out');
  const sub = () => game.g.subsidiaries.find(x => x.id === id);
  const ready = () => STRATEGIES.every(strategy => game.subsidiaryRelistingPreview(id, strategy).canExecute);
  while (!ready() && game.g.week < 80) {
    if (sub().integrationSynergyRounds < 2 && game.subsidiaryIntegrationSynergyPreview(id, 'platform')?.canExecute) {
      assert.equal(game.investSubsidiaryIntegrationSynergy(id, 'platform'), true, 'production integration synergy');
    }
    advance(game);
  }
  assert.equal(ready(), true, 'eligible to relist');
  assert.equal(sub().integrationSynergyRounds, 2);
  return (readyState = JSON.stringify(game.g));
}
async function fixture(variant = 'balanced') {
  assert.ok(STRATEGIES.includes(variant), 'known relisting variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(await stateReadyToRelist()));
  const sub = game.g.subsidiaries.find(x => x.delistingReason === 'squeezeOut' && !x.publicCompany);
  assert.ok(sub && game.subsidiaryRelistingPreview(sub.id, variant).canExecute, 'private subsidiary ready to relist');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, subsidiaryID: sub.id };
}
const command = ctx => ctx.game.relistSubsidiary(ctx.subsidiaryID, ctx.variant);
module.exports = { fixture, command, snapshot, economic, STRATEGIES };
