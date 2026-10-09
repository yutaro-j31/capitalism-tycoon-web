'use strict';
// Diagnostic only, deliberately excluded from canonical runner until a fix is approved.
// Reproduces the user-facing M&A subsidiary disposal installed method under save() === false.
const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

const { engineModule, modules, ctx } = loadGame({ random: () => 0.5, isolatedLegacyIndex: true, headless: true });
const game = new engineModule.TycoonEngine();
game.g.configured = true;
game.g.companyCash = 1_000_000_000;
game.g.finance = modules.finance.defaultFinanceState(game.g);
game.g.departments.investment = { name: '投資部', established: true };
game.g.acquisitionTargets = [{
  id: 'audit-sale-target', name: 'Audit Sale Subsidiary', domain: 'SaaS',
  valuation: 100_000_000, sales: 80_000_000, operatingProfit: 8_000_000,
  growth: 0.1, risk: 0.1, synergy: 0.1, friendly: true, expiresWeek: 99
}];

// Fixture setup precedes fault injection: this is NOT a test of acquireTarget.
assert.equal(game.acquireTarget('audit-sale-target', 'friendly'), true, 'precondition: acquire subsidiary');
assert.equal(modules.finance.validate(game.g).ok, true, 'precondition: valid acquired subsidiary');
const id = game.g.maSubsidiaries[0].id;
assert.equal(game.save(), true, 'precondition: committed sale baseline');
const before = JSON.stringify(game.g);
const mirrorBefore = ctx.__localStorageData.get(engineModule.SAVE_KEY);
assert.ok(mirrorBefore, 'baseline durable mirror must exist');

const saved = game.save;
let saveHits = 0, result, error;
game.save = () => { saveHits++; return false; };
try { result = game.sellMASubsidiary(id); } catch (caught) { error = caught; }
finally { game.save = saved; }
const after = JSON.stringify(game.g);
const mirrorAfter = ctx.__localStorageData.get(engineModule.SAVE_KEY);
const oldState = JSON.parse(before), newState = JSON.parse(after);
const summary = {
  saveHits, result, exception: error?.stack || null,
  cashDelta: newState.companyCash - oldState.companyCash,
  subsidiaryCount: [oldState.maSubsidiaries.length, newState.maSubsidiaries.length],
  goodwillStatus: [
    oldState.goodwillRecords.find(x => x.name === 'Audit Sale Subsidiary')?.status || null,
    newState.goodwillRecords.find(x => x.name === 'Audit Sale Subsidiary')?.status || null
  ],
  totalMAGain: [oldState.totalMAGain, newState.totalMAGain],
  financeTxnCount: [oldState.finance.transactions.length, newState.finance.transactions.length],
  rngChanged: JSON.stringify(oldState.simulationRng) !== JSON.stringify(newState.simulationRng),
  mirrorUnchanged: mirrorAfter === mirrorBefore,
  liveUnchanged: after === before
};
console.log('M&A subsidiary sale save-false diagnostics:', JSON.stringify(summary));
assert.ok(saveHits > 0, 'fault must reach installed sale save()');
assert.equal(error, undefined, 'save false should be handled as a failed operation');
assert.equal(result, false, 'failed save must not be reported as a completed subsidiary disposal');
assert.equal(after, before, 'failed sale must restore entire live state, including RNG, goodwill and journal');
assert.equal(mirrorAfter, mirrorBefore, 'failed sale must preserve last committed mirror');
console.log('M&A subsidiary sale save-false atomicity PASS');
