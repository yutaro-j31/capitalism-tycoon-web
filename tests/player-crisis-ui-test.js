const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a2b0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};
const { ctx, modules } = loadGame({ random });
const { engine, finance, playerCrisis, playerCrisisActions, playerCrisisUI } = modules;

assert.ok(playerCrisisUI?.__installed, 'player crisis UI must be registered');
assert.equal(typeof playerCrisisUI.render, 'function');
assert.equal(typeof playerCrisisUI.enhance, 'function');
assert.equal(typeof playerCrisisUI.handleClick, 'function');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function makeCrisisGame({ cash = -1_000_000, personalCash = 10_000_000, propertyValue = 0 } = {}) {
  const state = engine.createInitialState({ configured: true });
  state.week = 4;
  state.companyCash = cash;
  state.personalCash = personalCash;
  state.companyCredit = 80;
  if (propertyValue > 0) {
    const property = state.properties[0];
    property.owner = 'company';
    property.purchasePrice = propertyValue;
    property.price = propertyValue;
    property.value = propertyValue;
  }
  state.finance = finance.defaultFinanceState(state);
  playerCrisis.evaluate(state);
  playerCrisisActions.ensure(state);
  return new engine.TycoonEngine(state);
}

const stable = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
playerCrisisUI.bindEngine(stable);
assert.equal(playerCrisisUI.render(stable.g, stable), '', 'stable companies must not show the crisis panel');

const founderGame = makeCrisisGame();
assert.equal(founderGame.g.playerCrisis.status, 'distressed');
founderGame.g.playerCrisis.reason = '<img src=x onerror=alert(1)>';
const beforeRender = JSON.stringify(founderGame.g);
const html = playerCrisisUI.render(founderGame.g, founderGame);
assert.equal(JSON.stringify(founderGame.g), beforeRender, 'rendering a normalized state must be read-only');
assert.ok(html.includes('資金繰り危機対応'));
assert.ok(html.includes('創業者資金を注入'));
assert.ok(html.includes('緊急ブリッジローン'));
assert.ok(html.includes('data-player-crisis-action="founder-capital"'));
assert.ok(html.includes('data-player-crisis-action="emergency-bridge"'));
assert.ok(html.includes('スポンサー出資'));
assert.ok(html.includes('data-player-crisis-action="sponsor-injection"'));
assert.ok(html.includes('-100.0万円'), 'actual negative company cash must be displayed');
assert.ok(!html.includes('<img src=x'), 'crisis reason must be escaped');
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
for (const forbidden of ['NaN', 'Infinity', 'undefined', '[object Object]']) assert.ok(!html.includes(forbidden), `render output contains ${forbidden}`);

const screen = ctx.document.getElementById('screen');
screen.innerHTML = '<section id="existing-content">既存画面</section>';
playerCrisisUI.bindEngine(founderGame);
assert.ok(screen.innerHTML.startsWith('<!--player-crisis-ui:start-->'), 'bindEngine must install the crisis panel marker');
assert.ok(screen.innerHTML.includes('資金繰り危機対応'), 'bindEngine must install the crisis panel content');
assert.ok(screen.innerHTML.includes('existing-content'), 'bindEngine must preserve the existing screen content');
assert.equal(screen.dataset.playerCrisisUi, '1');
assert.equal(playerCrisisUI.enhance(), false, 'enhancement must be idempotent');
assert.equal((screen.innerHTML.match(/player-crisis-ui:start/g) || []).length, 1);

const founderInput = ctx.document.getElementById('player-crisis-founder-amount');
founderInput.value = '2000000';
const companyBefore = founderGame.g.companyCash;
const personalBefore = founderGame.g.personalCash;
const founderEvent = {
  target: { closest: selector => selector === '[data-player-crisis-action]' ? { dataset: { playerCrisisAction: 'founder-capital' } } : null },
  preventDefault(){ this.prevented = true; },
  stopPropagation(){ this.stopped = true; }
};
assert.equal(playerCrisisUI.handleClick(founderEvent), true);
assert.equal(founderEvent.prevented, true);
assert.equal(founderEvent.stopped, true);
assert.equal(founderGame.g.companyCash, companyBefore + 2_000_000);
assert.equal(founderGame.g.personalCash, personalBefore - 2_000_000);
assert.equal(founderGame.g.playerCrisisActions.history.at(-1).type, 'founderCapital');
assert.equal(finance.validate(founderGame.g).ok, true, finance.validate(founderGame.g).errors.join(' / '));

const bridgeGame = makeCrisisGame({ propertyValue: 100_000_000 });
playerCrisisUI.bindEngine(bridgeGame);
const bridgeOptions = bridgeGame.crisisLiquidityOptions();
assert.equal(bridgeOptions.canRequestBridge, true);
const debtBefore = bridgeGame.g.companyDebt;
const bridgeEvent = {
  target: { closest: () => ({ dataset: { playerCrisisAction: 'emergency-bridge' } }) },
  preventDefault(){}, stopPropagation(){}
};
assert.equal(playerCrisisUI.handleClick(bridgeEvent), true);
assert.ok(bridgeGame.g.companyDebt > debtBefore);
assert.equal(bridgeGame.g.playerCrisisActions.history.at(-1).type, 'emergencyBridge');
assert.equal(finance.validate(bridgeGame.g).ok, true, finance.validate(bridgeGame.g).errors.join(' / '));
const cooldownHtml = playerCrisisUI.render(bridgeGame.g, bridgeGame);
assert.ok(cooldownHtml.includes('再申請まで13週'));
assert.ok(/data-player-crisis-action="emergency-bridge" disabled/.test(cooldownHtml));

const sponsorGame = makeCrisisGame({ propertyValue: 100_000_000 });
playerCrisisUI.bindEngine(sponsorGame);
const sponsorOptions = sponsorGame.crisisLiquidityOptions();
assert.equal(sponsorOptions.canRequestSponsor, true);
const sponsorSharesBefore = sponsorGame.g.sharesOut;
const sponsorEvent = {
  target: { closest: () => ({ dataset: { playerCrisisAction: 'sponsor-injection' } }) },
  preventDefault(){}, stopPropagation(){}
};
assert.equal(playerCrisisUI.handleClick(sponsorEvent), true, 'harness confirm() stub always returns true');
assert.ok(sponsorGame.g.sharesOut > sponsorSharesBefore, '新株発行が実行される');
assert.equal(sponsorGame.g.playerCrisisActions.history.at(-1).type, 'sponsorInjection');
assert.equal(finance.validate(sponsorGame.g).ok, true, finance.validate(sponsorGame.g).errors.join(' / '));
const sponsorCooldownHtml = playerCrisisUI.render(sponsorGame.g, sponsorGame);
assert.ok(/data-player-crisis-action="sponsor-injection" disabled/.test(sponsorCooldownHtml), 'クールダウン中はボタンが無効化される');

bridgeGame.g.playerCrisis.status = 'stable';
bridgeGame.g.playerCrisis.lastEvaluationWeek = bridgeGame.g.week;
playerCrisisUI.bindEngine(bridgeGame);
assert.equal(playerCrisisUI.enhance(), false, 'bindEngine must remove the existing panel before another enhancement pass');
assert.ok(!screen.innerHTML.includes('player-crisis-ui:start'));
assert.equal(screen.dataset.playerCrisisUi, '0');

const unknownEvent = { target: { closest: () => ({ dataset: { playerCrisisAction: 'unknown' } }) }, preventDefault(){}, stopPropagation(){} };
assert.equal(playerCrisisUI.handleClick(unknownEvent), false);
assert.deepEqual(findStateIssues(founderGame.g), []);
assert.deepEqual(findStateIssues(bridgeGame.g), []);
assert.deepEqual(findStateIssues(sponsorGame.g), []);

console.log('player crisis UI tests passed');
