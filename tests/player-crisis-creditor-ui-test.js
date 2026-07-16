const assert = require('node:assert');
const { loadGame } = require('./harness');

let seed = 0x6a4b0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { ctx, modules } = loadGame({ random });
const { engine, finance, playerCrisis, playerCrisisCreditorUI } = modules;
assert.ok(playerCrisisCreditorUI?.__installed);
assert.equal(typeof playerCrisisCreditorUI.renderSection, 'function');
assert.equal(typeof playerCrisisCreditorUI.findCandidate, 'function');

const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
game.g.week = 8;
game.g.companyDebt = 2_000_000;
game.g.companyCash = -1_000_000;
finance.ensureFinance(game.g).loans.push({ loanID: 'ui-loan', name: '<b>危険</b>', principal: 2_000_000, outstandingPrincipal: 2_000_000, interestRate: 0.08, termWeeks: 52, remainingWeeks: 52, repaymentMethod: 'manual', weeklyPrincipalPayment: 0, nextPaymentWeek: null, status: 'active' });
game.g.playerCrisis.lastEvaluationWeek = 0;
playerCrisis.evaluate(game.g);
assert.notEqual(game.g.playerCrisis.status, 'stable');

playerCrisisCreditorUI.bindEngine(game);
const before = JSON.stringify(game.g);
const html = playerCrisisCreditorUI.renderSection(game);
assert.equal(JSON.stringify(game.g), before, 'render must be read-only');
assert.ok(html.includes('債権者との条件変更交渉'));
assert.ok(html.includes('承認見込み'));
assert.ok(html.includes('&lt;b&gt;危険&lt;/b&gt;'));
assert.ok(!html.includes('<b>危険</b>'));
assert.ok(html.includes('data-player-crisis-creditor-action="negotiate"'));

const candidate = playerCrisisCreditorUI.findCandidate('principalDeferral', 'ui-loan');
assert.ok(candidate);
const event = { target: { closest: () => ({ disabled: false, dataset: { creditorType: 'principalDeferral', creditorLoanId: 'ui-loan' } }) }, preventDefault(){}, stopPropagation(){} };
let text = '';
ctx.confirm = message => { text = String(message); return false; };
assert.equal(playerCrisisCreditorUI.handleClick(event), false);
assert.equal(JSON.stringify(game.g), before);
assert.ok(text.includes('承認見込み'));
assert.ok(text.includes('会社信用'));

console.log('player crisis creditor UI tests passed');
