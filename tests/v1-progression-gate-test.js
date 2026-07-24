const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

let seed = 0x61a2026;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
};

function stateIntegrityIssues(root) {
  const errors = [];
  const visited = new WeakSet();
  const nonNegativeKeys = /^(?:qty|sharesOut|founderShares|treasuryBuybackShares|storeCount|totalCapacity|capacityPerStore|outstandingPrincipal|remainingWeeks)$/;
  function visit(value, location) {
    if (!value || typeof value !== 'object') return;
    if (visited.has(value)) return;
    visited.add(value);
    for (const [key, child] of Object.entries(value)) {
      const childPath = Array.isArray(value) ? `${location}[${key}]` : `${location}.${key}`;
      if (typeof child === 'number') {
        if (!Number.isFinite(child)) errors.push(`${childPath}: non-finite ${child}`);
        if (nonNegativeKeys.test(key) && child < 0) errors.push(`${childPath}: negative constrained quantity ${child}`);
      } else if (child && typeof child === 'object') visit(child, childPath);
    }
  }
  visit(root, 'g');
  try { JSON.stringify(root); } catch (error) { errors.push(`g: JSON serialization failed: ${error.message}`); }
  return errors;
}

const { ctx, engineModule, modules } = loadGame({ random });
const { finance } = modules;
const game = new engineModule.TycoonEngine();

game.configure({
  playerName: '進行監査者',
  companyName: 'V1ゲート商事',
  difficulty: 'normal',
  scenario: 'standard'
});
assert.equal(game.g.configured, true, 'initial setup must complete');
assert.equal(game.g.saveVersion, 9, 'progression gate must use save version 9');
assert.equal(engineModule.SAVE_KEY, 'capitalism_tycoon_web_v1');

// This is a capitalized release-audit scenario. It shortens waiting time without
// bypassing the production action methods or their unlock conditions.
game.g.companyCash = 2_000_000_000;
game.g.finance = finance.defaultFinanceState(game.g);

function availableTenant(businessID) {
  return game.g.tenants.find(row => row.businessID === businessID && !row.occupiedBy);
}

for (const [businessID, name] of [
  ['ramen', 'V1一号ラーメン'],
  ['cafe', 'V1二号カフェ'],
  ['conveni', 'V1三号コンビニ']
]) {
  const tenant = availableTenant(businessID);
  assert.ok(tenant, `${businessID} tenant must exist`);
  assert.equal(game.openStore({ tenantID: tenant.id, businessID, name, operatingHours: 3 }), true, `${businessID} store must open`);
}
assert.equal(game.g.stores.length, 3, 'three stores are required for the IPO route');
assert.equal(new Set(game.g.stores.map(row => row.businessID)).size, 3, 'multi-business route must contain three businesses');

for (let i = 0; i < 4; i += 1) assert.notEqual(game.advanceWeek(false), false, `week ${i + 1} must advance`);
assert.ok(game.g.stores.every(row => row.status === 'open'), 'all initial stores must reach open status');

const office = game.g.rentalOffices.find(row => row.grade === 'C') || game.g.rentalOffices[0];
assert.ok(office, 'head-office candidate must exist');
assert.equal(game.contractOffice(office.id), true, 'head office must be contractible');
assert.equal(game.establishDepartment('accounting'), true, 'accounting department must unlock');
assert.equal(game.establishDepartment('investment'), true, 'investment department must unlock at three stores');

const startup = game.g.startups.find(row => row.alive && !row.subsidiary);
assert.ok(startup, 'startup candidate must exist');
const ticket = Math.max(startup.minTicket, 200_000_000);
assert.equal(game.investStartup(startup.id, ticket, 'company'), true, 'first company VC investment must succeed');
assert.equal(game.investStartup(startup.id, ticket, 'company'), true, 'follow-on company VC investment must succeed');
assert.ok(startup.ownedCompany >= 0.5, 'company ownership must reach subsidiary threshold');
assert.equal(game.makeSubsidiary(startup.id), true, 'startup must convert to consolidated subsidiary');
assert.equal(game.g.subsidiaries.length, 1, 'one VC subsidiary must exist');

const maTarget = {
  id: 'v1-gate-ma-target',
  name: 'V1統合ロジスティクス',
  domain: '物流',
  valuation: 100_000_000,
  sales: 90_000_000,
  operatingProfit: 9_000_000,
  growth: 0.08,
  risk: 0.1,
  synergy: 0.12,
  friendly: true,
  expiresWeek: game.g.week + 20
};
game.g.acquisitionTargets = [maTarget];
game.normalize();
assert.equal(game.openMADealRoom(maTarget.id), true, 'M&A deal room must open through production action');
const deal = game.g.maDealRooms.find(row => row.targetID === maTarget.id);
assert.ok(deal, 'deal room state must exist');
assert.equal(game.startMADueDiligence(deal.id, 'financial'), true, 'financial due diligence must start');
assert.notEqual(game.advanceWeek(false), false, 'first DD week must advance');
assert.equal(deal.status, 'diligence', 'initial financial DD must not complete in one week');
assert.notEqual(game.advanceWeek(false), false, 'second DD week must advance');
assert.equal(deal.status, 'ready', 'financial DD must complete after two weeks');
const offerPrice = Math.min(maTarget.valuation * 2.5, Math.max(deal.sellerAsk * 1.45, deal.valuationBridge.recommendedMaximumPrice * 1.3));
assert.equal(game.submitMAOffer(deal.id, { method: 'friendly', offerPrice }), true, 'friendly deal-room offer must be submitted');
assert.notEqual(game.advanceWeek(false), false, 'seller response week must advance');
let negotiationGuard = 0;
while (deal.status === 'countered' && negotiationGuard < 3) {
  assert.equal(game.acceptMACounterOffer(deal.id), true, 'counter offer must be accepted through production action');
  assert.notEqual(game.advanceWeek(false), false, 'counter response week must advance');
  negotiationGuard += 1;
}
assert.equal(deal.status, 'accepted', `deal must reach accepted before closing, got ${deal.status}`);
const beforeApproval = {
  companyCash: game.g.companyCash,
  financeTransactions: game.g.finance.transactions.length,
  goodwillRecords: game.g.goodwillRecords.length,
  maSubsidiaries: game.g.maSubsidiaries.length,
  totalAcquisitions: game.g.totalAcquisitions,
  week: game.g.week
};
assert.equal(game.closeMADeal(deal.id), false, 'unapproved accepted deal must not close');
assert.deepEqual({
  companyCash: game.g.companyCash,
  financeTransactions: game.g.finance.transactions.length,
  goodwillRecords: game.g.goodwillRecords.length,
  maSubsidiaries: game.g.maSubsidiaries.length,
  totalAcquisitions: game.g.totalAcquisitions,
  week: game.g.week
}, beforeApproval, 'unapproved close attempt must not mutate acquisition accounting state');
assert.equal(game.approveMAClosing(deal.id), false, 'cash acquisition without financing plan must not receive board approval');
const financingBefore = { companyCash:game.g.companyCash, companyDebt:game.g.companyDebt, sharesOut:game.g.sharesOut, financeTransactions:game.g.finance.transactions.length, week:game.g.week };
const financingPresets = game.maAcquisitionFinancingPresets(deal.id);
const selectedPreset = financingPresets.find(row => row.presetID === 'balanced' && row.available) || financingPresets.find(row => row.available);
assert.ok(selectedPreset, 'at least one deterministic financing preset must be available');
assert.equal(game.selectMAAcquisitionFinancing(deal.id, { presetID:selectedPreset.presetID }), true, 'accepted cash deal must select a financing package');
assert.deepEqual({ companyCash:game.g.companyCash, companyDebt:game.g.companyDebt, sharesOut:game.g.sharesOut, financeTransactions:game.g.finance.transactions.length, week:game.g.week }, financingBefore, 'selecting financing must not execute accounting');
assert.equal(game.approveMAClosing(deal.id), true, 'accepted deal with valid financing must receive board approval');
assert.equal(game.closeMADeal(deal.id), true, 'approved deal must close through final contract action');
assert.equal(game.g.maSubsidiaries.length, 1, 'one M&A subsidiary must exist');
assert.equal(game.g.totalAcquisitions, 1, 'M&A counter must increment');
const acquiredMA = game.g.maSubsidiaries[0];
assert.equal(acquiredMA.pmiStatus, 'planning', 'deal-room acquisition must enter PMI planning');
assert.equal(acquiredMA.identifiableNetAssetsBookValue + acquiredMA.goodwillBookValue, acquiredMA.acquisitionPrice, 'identifiable assets plus goodwill must equal acquisition price');
assert.equal(finance.validate(game.g).ok, true, 'M&A deal-room accounting must validate');

// Hiring negotiation is intentionally excluded from this deterministic release
// gate; the board action itself remains exercised through its production API.
game.g.executives.CEO = { role: 'CEO', name: '監査CEO', skill: 80, salary: 4_000_000 };
game.g.executives.CFO = { role: 'CFO', name: '監査CFO', skill: 80, salary: 3_000_000 };
assert.equal(game.establishBoard(), true, 'board must be establishable with CEO and CFO');

const reportStartWeek = Math.max(1, game.g.week - 51);
game.g.reports = Array.from({ length: 52 }, (_, index) => ({
  week: reportStartWeek + index,
  sales: 5_000_000,
  expenses: 3_000_000,
  profit: 2_000_000
}));
game.g.lastReport = game.g.reports[game.g.reports.length - 1];
assert.deepEqual(game.ipoMissingReasons(), [], 'capitalized audit route must satisfy every IPO condition');
const capitalSurplusBeforeIPO = game.g.finance.balances.capitalSurplus;
assert.equal(game.executeIPO('東証グロース', 100_000), true, 'parent company IPO must succeed');
assert.equal(game.g.publicCompany, true, 'company must be public after IPO');
assert.ok(game.g.market.some(row => row.id === game.g.ticker), 'player stock must be added to the market');
assert.ok(game.g.subsidiaries.length + game.g.maSubsidiaries.length >= 2, 'conglomerate route must retain both subsidiary types');
const ipoTransaction = game.g.finance.transactions.find(row => row.sourceType === 'parentCompanyIPO');
assert.ok(ipoTransaction, 'parent IPO equity financing transaction must exist');
assert.ok(ipoTransaction.cashEffect > 0 && ipoTransaction.equityEffect > 0, 'parent IPO transaction must increase cash and equity');
assert.ok(game.g.finance.balances.capitalSurplus > capitalSurplusBeforeIPO, 'parent IPO proceeds must increase capital surplus');

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
for (const action of ['open-store', 'contract-office', 'establish-department', 'make-subsidiary', 'ma-open-deal', 'ma-start-dd', 'ma-submit-offer', 'ma-financing-select', 'ma-financing-clear', 'ma-financing-custom-submit', 'ma-board-approve', 'ma-board-revoke', 'ma-close-deal', 'start-ma-pmi', 'establish-board', 'execute-ipo']) {
  assert.ok(appSource.includes(`'${action}'`) || appSource.includes(`"${action}"`), `UI action ${action} must remain reachable`);
}

const validation = finance.validate(game.g);
assert.equal(validation.ok, true, validation.errors.join('\n'));
assert.deepEqual(stateIntegrityIssues(game.g), [], 'completed progression state must remain finite and serializable');

assert.equal(game.save(), true, 'completed route must save');
assert.ok(ctx.__localStorageData.has(engineModule.SAVE_KEY), 'main save key must be written');
const reloaded = engineModule.TycoonEngine.load();
assert.equal(reloaded.g.publicCompany, true, 'IPO state must survive reload');
assert.equal(reloaded.g.stores.length, 3, 'stores must survive reload');
assert.equal(reloaded.g.subsidiaries.length, 1, 'VC subsidiary must survive reload');
assert.equal(reloaded.g.maSubsidiaries.length, 1, 'M&A subsidiary must survive reload');
assert.equal(reloaded.g.boardEstablished, true, 'board state must survive reload');
assert.deepEqual(reloaded.ipoMissingReasons(), [], 'reloaded public-company route must remain internally complete');
assert.equal(reloaded.g.finance.transactions.filter(row => row.sourceType === 'parentCompanyIPO').length, 1, 'parent IPO financing must remain idempotent after reload');
const reloadValidation = finance.validate(reloaded.g);
assert.equal(reloadValidation.ok, true, reloadValidation.errors.join('\n'));
assert.deepEqual(stateIntegrityIssues(reloaded.g), [], 'reloaded progression state must remain finite and serializable');

console.log('provisional v1 progression gate passed');
