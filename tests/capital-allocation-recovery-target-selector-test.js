'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadGame } = require('./harness');

function install(load) {
  for (const file of [
    'player-debt-service.js','treasury-prepayment.js','shareholder-returns.js',
    'capital-allocation-score.js','capital-allocation-policy.js','capital-allocation-forecast.js',
    'capital-allocation-actions.js','capital-allocation-decision-memo.js','capital-allocation-stress-test.js',
    'capital-allocation-resilience-memo.js','capital-allocation-recovery-funding.js',
    'capital-allocation-recovery-funding-options.js','capital-allocation-recovery-funding-readiness.js',
    'capital-allocation-recovery-funding-reconciliation.js'
  ]) {
    const key = file.replace('.js','').replace(/-([a-z])/g,(_,char)=>char.toUpperCase());
    if (!load.modules[key]) vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'), load.ctx, { filename:file });
  }
  return load;
}

function publicGame(modules) {
  const { engine, finance } = modules;
  const state = engine.createInitialState({ configured:true });
  Object.assign(state, {
    week:27, publicCompany:true, selectedTab:'market', companyCash:10_000_000,
    companyDebt:300_000_000, companyCredit:100, sharesOut:1_000_000,
    founderShares:600_000, stockPrice:100, ticker:'CPTY'
  });
  state.market = state.market.filter(row => !['CPTY','EXT'].includes(row.id));
  state.market.push(
    { id:'CPTY', name:state.companyName, sector:'コングロマリット', price:100, previous:100, dividendYield:0, volatility:0, trend:0, marketCap:100_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'test', listingMarket:'東証グロース', priceHistory:[{week:27,price:100}] },
    { id:'EXT', name:'外部上場株', sector:'IT', price:10_000, previous:10_000, dividendYield:0, volatility:0, trend:0, marketCap:10_000_000_000, per:20, pbr:2, issuedShares:1_000_000, dividendPerShare:0, shareholders:{}, description:'asset', listingMarket:'東証プライム', priceHistory:[{week:27,price:10_000}] }
  );
  state.companyStocks = { EXT:{ qty:10_000, avg:8_000 } };
  Object.assign(state.properties[0], { owner:'company', value:1_000_000_000, price:1_000_000_000, purchasePrice:600_000_000, bookValue:600_000_000 });
  state.finance = finance.defaultFinanceState(state);
  state.finance.capitalAllocationPolicy = { id:'balanced', lastChangedWeek:-999, lastEvaluatedWeek:-1, executionScore:50, history:[] };
  finance.event(state,'revenue',100_000_000,{ week:27, cashEffect:0, profitEffect:100_000_000, receivableAmount:100_000_000, sourceType:'targetSelectorFixture', sourceID:'baseline', idempotencyKey:'target-selector-revenue', description:'売掛売上' });
  state.finance.loans = [{ id:'test-loan', loanID:'test-loan', status:'active', principal:300_000_000, outstandingPrincipal:300_000_000, interestRate:.1, maturityWeek:104 }];
  finance.rebuildSnapshotForWeek(state,27);
  return new engine.TycoonEngine(state);
}

const load = install(loadGame());
const { modules } = load;
const mod = modules.capitalAllocationRecoveryFundingReconciliation;
const optionsMod = modules.capitalAllocationRecoveryFundingOptions;
const readinessMod = modules.capitalAllocationRecoveryFundingReadiness;
const game = publicGame(modules);
assert.ok(mod?.__installed);
assert.deepEqual(Array.from(mod.TARGET_SCORES), [50,60,70,80]);
assert.equal(mod.normalizeTarget(50), 50);
assert.equal(mod.normalizeTarget(65), 70);
assert.equal(game.capitalAllocationRecoveryFundingTarget(), 70);

const before = JSON.stringify(game.g);
const defaultHtml = mod.render(game);
assert.equal((defaultHtml.match(/data-capital-allocation-funding-target=/g) || []).length, 4);
assert.match(defaultHtml, /data-capital-allocation-funding-target="70" aria-pressed="true"/);
assert.equal((defaultHtml.match(/data-capital-allocation-funding-pin="70"/g) || []).length, 4);
assert.match(defaultHtml, /Phase 8D-27 · 目標70点/);
assert.match(defaultHtml, /総調達/);
assert.match(defaultHtml, /資産売却/);
assert.match(defaultHtml, /借入/);
assert.match(optionsMod.render(game), /Phase 8D-16 · 70点/);
assert.match(readinessMod.render(game), /<span>目標スコア<\/span><strong>70点<\/strong>/);

assert.equal(game.setCapitalAllocationRecoveryFundingTarget(50), true);
assert.equal(game.capitalAllocationRecoveryFundingTarget(), 50);
assert.equal(JSON.stringify(game.g), before, 'target selection must remain outside the save state');
const target50Html = mod.render(game);
assert.match(target50Html, /data-capital-allocation-funding-target="50" aria-pressed="true"/);
assert.equal((target50Html.match(/data-capital-allocation-funding-pin="50"/g) || []).length, 4);
assert.match(target50Html, /Phase 8D-27 · 目標50点/);
assert.ok((target50Html.match(/総調達/g) || []).length >= 1, 'reachable plans must display total funding');
assert.ok((target50Html.match(/資産売却/g) || []).length >= 1, 'reachable plans must display asset funding');
assert.ok((target50Html.match(/借入/g) || []).length >= 1, 'reachable plans must display borrowing');
const options50Html = optionsMod.render(game);
const readiness50Html = readinessMod.render(game);
assert.match(options50Html, /Phase 8D-16 · 50点/);
assert.match(options50Html, /<strong>目標：<\/strong>50点/);
assert.match(readiness50Html, /Phase 8D-18 · 50点/);
assert.match(readiness50Html, /<span>目標スコア<\/span><strong>50点<\/strong>/);

const ready = mod.candidates(game,50).find(row => row.ready);
assert.ok(ready, 'fixture must expose a ready 50-point recovery option');
const pinned = mod.pin(game,50,ready.optionId);
assert.ok(pinned);
assert.equal(pinned.targetScore, 50);
assert.equal(mod.targetFor(game), 50);
assert.equal(game.setCapitalAllocationRecoveryFundingTarget(80), false, 'a pinned plan must lock its target');
assert.equal(mod.targetFor(game), 50);
assert.equal(JSON.stringify(game.g), before, 'pinning and rejected target changes must not mutate the save');
const pinnedHtml = mod.render(game);
assert.match(pinnedHtml, /<span>目標スコア<\/span><strong>50点<\/strong>/);
assert.equal((pinnedHtml.match(/data-capital-allocation-funding-target=/g) || []).length, 0);

assert.equal(mod.clear(game), true);
assert.equal(game.setCapitalAllocationRecoveryFundingTarget(80), true);
assert.equal(mod.targetFor(game), 80);
const target80Html = mod.render(game);
assert.match(target80Html, /data-capital-allocation-funding-target="80" aria-pressed="true"/);
assert.equal((target80Html.match(/data-capital-allocation-funding-pin="80"/g) || []).length, 4);
assert.match(optionsMod.render(game), /Phase 8D-16 · 80点/);
assert.match(readinessMod.render(game), /Phase 8D-18 · 80点/);
assert.equal(JSON.stringify(game.g), before, 'clearing and target reselection must remain transient');
assert.equal(modules.engine.SAVE_KEY, 'capitalism_tycoon_web_v1');
assert.equal(modules.engine.SAVE_VERSION, 9);
console.log('recovery funding target selector, synchronized planning cards, funding breakdown, and transient state tests passed');
