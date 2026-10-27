'use strict';
// P3-4 W-GROUP-DISPOSAL (merge): two wholly owned private subsidiaries spun out of internal ventures with the installed
// spinOffInternalVenture (the W-INTERNAL-VENTURE spin-off fixture). Merging them through the installed
// group-restructuring merge is the command under test; the variants pass the pair in either order.
const assert = require('node:assert/strict');
const { boot, snapshot, economic } = require('./subsidiary-quarter-close');
const spinoff = require('./internal-venture-spinoff-atomicity');

const VARIANTS = Object.freeze({ forward: false, reverse: true });
let spunState = null;
async function stateWithTwoSubsidiaries() {
  if (spunState) return spunState;
  const s = await spinoff.fixture('first');
  for (const venture of s.game.g.internalVentures) assert.equal(s.game.spinOffInternalVenture(venture.id), true, 'production spin-off');
  return (spunState = JSON.stringify(s.game.g));
}
async function fixture(variant = 'forward') {
  assert.ok(Object.hasOwn(VARIANTS, variant), 'known merge variant');
  const ctx = boot(); await ctx.backend.hydrate();
  const game = new ctx.engineModule.TycoonEngine(JSON.parse(await stateWithTwoSubsidiaries()));
  const pair = game.g.subsidiaries.filter(s => s.source === 'internalVenture').map(s => s.id);
  assert.equal(pair.length, 2, 'two spun-off subsidiaries');
  if (VARIANTS[variant]) pair.reverse();
  assert.equal(game.groupRestructuringMergePreview(...pair).canExecute, true, 'merge available');
  assert.equal(ctx.modules.finance.validate(snapshot(game)).ok, true, 'reloaded accounting valid');
  assert.equal(game.save(), true); await ctx.backend.flush();
  return { ...ctx, game, variant, pair };
}
const command = ctx => ctx.game.executeGroupRestructuringMerge(...ctx.pair);
module.exports = { fixture, command, snapshot, economic, VARIANTS };
