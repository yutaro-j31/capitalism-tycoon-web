const assert = require('node:assert');
const { loadGame, findStateIssues } = require('./harness');

let seed = 0x6a2d0001;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 0x100000000;
};

const { ctx, modules } = loadGame({ random });
const { engine, finance, playerCrisis, playerCrisisUI, playerCrisisRestructuring } = modules;

assert.ok(playerCrisisUI?.__installed, 'player crisis UI must be registered');
assert.ok(playerCrisisRestructuring?.__installed, 'player crisis restructuring must be registered');
assert.equal(typeof playerCrisisUI.findDispositionCandidate, 'function');
assert.equal(engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(engine.SAVE_VERSION, 9);

function forceCrisis(game, targetCash = -1_000_000) {
  game.g.week = 4;
  const delta = targetCash - game.g.companyCash;
  game.g.companyCash = targetCash;
  finance.event(game.g, 'otherOperating', Math.abs(delta), {
    cashEffect: delta,
    profitEffect: delta,
    sourceType: 'crisisRestructuringUITestLoss',
    sourceID: `crisis-ui-test-${game.g.week}`,
    operationID: `crisis-ui-test-${game.g.week}`,
    description: '危機再建UIテスト用損失'
  });
  game.g.playerCrisis.lastEvaluationWeek = 0;
  playerCrisis.evaluate(game.g);
  assert.equal(game.g.playerCrisis.status, 'distressed');
}

const game = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
const tenant = game.g.tenants.find(row => row.businessID === 'ramen' && !row.occupiedBy);
assert.ok(tenant, 'ramen tenant required');
assert.equal(game.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '<img src=x onerror=alert(1)>危機店舗', operatingHours: 3 }), true);
const store = game.g.stores[0];
store.status = 'open';
store.lastProfit = -350_000;
forceCrisis(game);

const beforeRender = JSON.stringify(game.g);
const html = playerCrisisUI.render(game.g, game);
assert.equal(JSON.stringify(game.g), beforeRender, 'restructuring UI render must be read-only after normalization');
assert.ok(html.includes('事業整理候補'));
assert.ok(html.includes('資金不足'));
assert.ok(html.includes('data-player-crisis-action="dispose-asset"'));
assert.ok(html.includes(`data-disposition-id="${store.id}"`));
assert.ok(html.includes('data-disposition-type="store"'));
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;危機店舗'));
assert.ok(!html.includes('<img src=x'), 'candidate names must be escaped');
for (const forbidden of ['NaN', 'Infinity', 'undefined', '[object Object]']) assert.ok(!html.includes(forbidden), `render output contains ${forbidden}`);

playerCrisisUI.bindEngine(game);
const candidate = playerCrisisUI.findDispositionCandidate('store', store.id);
assert.ok(candidate);
assert.equal(candidate.id, store.id);
assert.equal(candidate.expectedCash, game.business('ramen').storeCost * 0.15);

const event = {
  target: {
    closest: selector => selector === '[data-player-crisis-action]' ? {
      dataset: {
        playerCrisisAction: 'dispose-asset',
        dispositionType: 'store',
        dispositionId: store.id
      }
    } : null
  },
  preventDefault(){ this.prevented = true; },
  stopPropagation(){ this.stopped = true; }
};

let confirmationText = '';
ctx.confirm = message => { confirmationText = String(message); return false; };
const beforeCancel = JSON.stringify(game.g);
assert.equal(playerCrisisUI.handleClick(event), false, 'cancelled disposition must not execute');
assert.equal(JSON.stringify(game.g), beforeCancel);
assert.ok(confirmationText.includes('想定回収額'));
assert.ok(confirmationText.includes('元に戻せません'));
assert.equal(event.prevented, true);
assert.equal(event.stopped, true);

ctx.confirm = message => { confirmationText = String(message); return true; };
const cashBefore = game.g.companyCash;
assert.equal(playerCrisisUI.handleClick(event), true);
assert.equal(game.g.stores.some(row => row.id === store.id), false);
assert.equal(game.g.companyCash - cashBefore, candidate.expectedCash);
assert.equal(game.g.playerCrisisRestructuring.history.at(-1).targetID, store.id);
assert.equal(game.g.playerCrisisRestructuring.history.at(-1).type, 'store');
assert.ok(confirmationText.includes('店舗閉鎖'));
assert.equal(finance.validate(game.g).ok, true, finance.validate(game.g).errors.join(' / '));
assert.deepEqual(findStateIssues(game.g), []);

const missingEvent = {
  target: { closest: () => ({ dataset: { playerCrisisAction: 'dispose-asset', dispositionType: 'store', dispositionId: 'missing' } }) },
  preventDefault(){}, stopPropagation(){}
};
assert.equal(playerCrisisUI.handleClick(missingEvent), false, 'missing candidate must not execute');
assert.equal(playerCrisisUI.findDispositionCandidate('store', store.id), null, 'disposed candidates must disappear');

const stable = new engine.TycoonEngine(engine.createInitialState({ configured: true }));
assert.equal(playerCrisisUI.render(stable.g, stable), '', 'stable company must not expose restructuring UI');

console.log('player crisis restructuring UI tests passed');
