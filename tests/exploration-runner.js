'use strict';

const { once } = require('node:events');
const crypto = require('node:crypto');
const { loadGame } = require('./harness');

const MAX_WEEKS = 1000;
const SEGMENT_WEEKS = 100;

function statefulRandom(initialSeed) {
  let state = initialSeed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  random.getState = () => state;
  random.setState = value => { state = value >>> 0; };
  return random;
}

const STYLE_LOGIC = Object.freeze({
  prudent: { tenant: 'cheapest', hours: 3, price: 1, reserve: 4_000_000, debt: false, diversify: false },
  leveraged_growth: { tenant: 'traffic', hours: 4, price: 1, reserve: 500_000, debt: true, diversify: false },
  discount_share: { tenant: 'traffic', hours: 4, price: 0.82, reserve: 2_000_000, debt: false, diversify: false },
  premium_quality: { tenant: 'cheapest', hours: 2, price: 1.35, reserve: 5_000_000, debt: false, quality: true, diversify: false },
  diversified_group: { tenant: 'cheapest', hours: 3, price: 1, reserve: 5_000_000, debt: false, diversify: true },
  novice: { tenant: 'first', hours: 4, price: 0.95, reserve: 0, debt: false, diversify: false },
  passive: { tenant: 'cheapest', hours: 3, price: 1, reserve: 0, debt: false, diversify: false },
  turnaround: { tenant: 'traffic', hours: 4, price: 0.92, reserve: 500_000, debt: true, diversify: false },
  boundary_explorer: { tenant: 'traffic', hours: 1, price: 0.5, reserve: 0, debt: true, boundary: true, diversify: false }
});

function canonicalState(state) {
  const copy = JSON.parse(JSON.stringify(state));
  // Exclude timestamps, view selection/summary caches, and regenerated time-limited offer listings.
  for (const key of ['lastSaveDate', 'selectedTab', 'selectedPref', 'selectedBusiness', 'lastWeeklySummary', 'luxuryAuctionListings']) delete copy[key];
  return copy;
}

function canonicalHash(state) {
  const stable = value => Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]))
      : value;
  return crypto.createHash('sha256').update(JSON.stringify(stable(canonicalState(state)))).digest('hex');
}

function terminalSummary(game, definition, maxRSS, randomState, weeksPlayed, engineFailure = null) {
  const report = game.g.lastReport || {};
  const runtime = game.g.explorationRuntime || {};
  const employees = (game.g.workforceTeams || []).filter(team => team.status !== 'closed').reduce((sum, team) => sum + Number(team.headcount || 0), 0) + Object.keys(game.g.executives || {}).length;
  return {
    ...definition,
    status: engineFailure ? 'engine-failure' : game.g.gameOver ? 'bankrupt' : weeksPlayed === MAX_WEEKS ? 'completed' : 'stopped',
    engineFailure, gameOver: Boolean(game.g.gameOver), gameOverReason: String(game.g.gameOverReason || ''),
    weeksPlayed, finalGameWeek: game.g.week,
    cash: Math.round(game.g.companyCash), debt: Math.round(game.g.companyDebt), stores: game.g.stores.length,
    businessIDs: [...new Set(game.g.stores.map(store => store.businessID))],
    employees, sales: Math.round(Number(report.sales || 0)), profit: Math.round(Number(report.profit || 0)),
    companyValue: Math.round(game.companyValue()), ipo: Boolean(game.g.publicCompany),
    crisisStatus: String(game.g.playerCrisis?.status || 'stable'), prngState: randomState >>> 0,
    canonicalStateHash: canonicalHash(game.g), reports: game.g.reports.length, maxRSSBytes: maxRSS,
    ipoWeek: game.g.publicCompany ? Number(game.g.difficultyScenarioProgress?.completedWeek || runtime.ipoWeek || 0) || null : null,
    crisisWeek: runtime.crisisWeek ?? null, turnaroundStartWeek: runtime.turnaroundStartWeek ?? null,
    crisisExitWeek: runtime.crisisExitWeek ?? null, turnaroundSucceeded: runtime.crisisWeek != null && runtime.crisisExitWeek != null,
    actionCounts: runtime.actionCounts || {}, runnerErrors: runtime.errors || [], preBankruptcyHistory: (runtime.history || []).slice(-26)
  };
}

function outcomeSignature(result) {
  const keys = ['status','gameOver','gameOverReason','weeksPlayed','finalGameWeek','cash','debt','stores','employees','sales','profit','companyValue','ipo','crisisStatus','prngState','canonicalStateHash'];
  return Object.fromEntries(keys.map(key => [key, result[key]]));
}

function sortedTenants(game, mode) {
  const rows = game.g.tenants.filter(row => !row.occupiedBy);
  if (mode === 'first') return rows;
  return rows.sort(mode === 'traffic' ? (a, b) => b.traffic - a.traffic || a.deposit - b.deposit : (a, b) => a.deposit - b.deposit || b.traffic - a.traffic);
}

function runtime(game) {
  const value = game.g.explorationRuntime ||= { history: [], selectedActions: [], actionCounts: {}, crisisWeek: null, turnaroundStartWeek: null, crisisExitWeek: null };
  return value;
}
function action(game, type, detail = {}) {
  const value = runtime(game);
  value.selectedActions.push({ type, ...detail });
  value.actionCounts[type] = (value.actionCounts[type] || 0) + 1;
}
function attempt(game, type, work, detail = {}) {
  const snapshot = JSON.stringify(game.g);
  try { if (!work()) return false; action(game, type, detail); return true; }
  catch (error) { game.g = JSON.parse(snapshot); const value=runtime(game);(value.errors ||= []).push({week:game.g.week,type,error:error?.message||String(error)});return false; }
}
function availableCredit(game) { return Math.max(0, game.companyCreditLimit() - game.g.companyDebt); }
function borrowToward(game, targetCash, label = 'borrow') {
  const amount = Math.min(availableCredit(game), Math.max(0, Math.ceil((targetCash - game.g.companyCash) / 100_000) * 100_000));
  if (amount < 100_000 || !game.borrow(amount, 'company')) return false;
  action(game, label, { amount: Math.round(amount) }); return true;
}
function openNextStore(game, definition, { businessID = definition.businessID, tenantMode = 'cheapest', hours = 3, reserve = 0, borrow = false } = {}) {
  const business = game.business(businessID), tenant = sortedTenants(game, tenantMode)[0];
  if (!business || !tenant) return false;
  const targetCash = business.storeCost + tenant.deposit + reserve;
  if (borrow) borrowToward(game, targetCash, 'growth-borrow');
  if (game.g.companyCash < targetCash) return false;
  const result = game.openStore({ tenantID: tenant.id, businessID, name: `探索-${business.name}-${game.g.stores.length + 1}`, operatingHours: hours });
  if (result) action(game, 'open-store', { businessID, storeCount: game.g.stores.length });
  return Boolean(result);
}

function applyInitialStyle(game, definition) {
  const style = STYLE_LOGIC[definition.playStyle];
  if (!style) throw new Error(`unknown play style: ${definition.playStyle}`);
  const business = game.business(definition.businessID);
  runtime(game).standardPrice = business.price;
  if (style.price !== 1) game.adjustPrice(definition.businessID, Math.max(1, Math.round(business.price * style.price)));
  if (style.price !== 1) action(game, 'set-price', { price: Math.round(game.business(definition.businessID).price) });
  const growth = ['leveraged_growth', 'turnaround', 'boundary_explorer'].includes(definition.playStyle);
  if (growth && !style.boundary) borrowToward(game, game.g.companyCash + Math.min(3_000_000, availableCredit(game)), 'initial-growth-borrow');
  openNextStore(game, definition, { tenantMode: style.tenant, hours: style.hours, reserve: style.reserve, borrow: growth });
  if (style.debt === true && style.boundary && availableCredit(game) >= 100_000) borrowToward(game, game.g.companyCash + availableCredit(game), 'boundary-max-borrow');
}

function applyWeeklyStyle(game, definition) {
  const style = STYLE_LOGIC[definition.playStyle];
  runtime(game).selectedActions = [];
  if (style.quality && game.g.week % 13 === 0 && game.g.companyCash > style.reserve + 500_000 && game.investBusiness(definition.businessID, 'quality', 500_000)) action(game, 'quality-investment', { amount: 500_000 });
  if (definition.playStyle === 'leveraged_growth') {
    const profitable = Number(game.g.lastReport?.profit || 0) > 0;
    if (game.g.week % 13 === 0 && profitable && game.g.stores.every(store => store.status === 'open')) openNextStore(game, definition, { tenantMode: 'traffic', hours: 4, reserve: 1_000_000, borrow: game.g.companyCredit >= 45 });
    if (game.g.week % 13 === 1 && profitable) {
      const candidate = (game.g.workforceCandidates || []).find(row => row.status === 'open' && game.g.companyCash > row.recruitmentFee + 2_000_000);
      if (candidate && game.hireWorkforceCandidate(candidate.candidateID)) action(game, 'hire', { headcount: candidate.headcount });
    }
  }
  if (style.boundary && game.g.week % 26 === 0) {
    const business = game.business(definition.businessID);
    const price = business.price <= 1 ? 1_000_000 : 1;
    if (game.adjustPrice(definition.businessID, price)) action(game, 'boundary-price', { price });
  }
  if (style.diversify && game.g.week % 52 === 0 && game.g.stores.length < 3) {
    const owned = new Set(game.g.stores.map(store => store.businessID));
    const alternative = game.g.businesses.find(row => !owned.has(row.id));
    if (alternative) openNextStore(game, definition, { businessID: alternative.id, tenantMode: 'cheapest', hours: 3, reserve: style.reserve });
  }
  if (definition.playStyle === 'turnaround') {
    const crisis = String(game.g.playerCrisis?.status || 'stable'), inCrisis = !['stable', 'recovered'].includes(crisis);
    if (!inCrisis && runtime(game).crisisWeek == null && game.g.week % 13 === 0 && Number(game.g.lastReport?.profit || 0) > 0) openNextStore(game, definition, { tenantMode: 'traffic', hours: 4, reserve: 500_000, borrow: true });
    if (inCrisis) {
      const rt = runtime(game); if (rt.turnaroundStartWeek == null) rt.turnaroundStartWeek = game.g.week;
      const lossStore = [...game.g.stores].filter(store => Number(store.lastProfit) < 0).sort((a, b) => a.lastProfit - b.lastProfit)[0];
      if (lossStore && game.g.stores.length > 1 && game.closeStore(lossStore.id)) action(game, 'close-loss-store', { storeID: lossStore.id });
      const business = game.business(definition.businessID), standard = runtime(game).standardPrice;
      if (Math.abs(business.price - standard) > .01 && game.adjustPrice(definition.businessID, standard)) action(game, 'restore-standard-price', { price: standard });
      const costs = typeof game.crisisCostReductionOptions === 'function' ? game.crisisCostReductionOptions() : null;
      const cost = costs?.recommended?.find(row => row.canExecute);
      if (cost) attempt(game, 'reduce-fixed-cost', ()=>game.executeCrisisCostReduction(cost.type, cost.id), { type: cost.type });
      if (typeof game.requestEmergencyBridgeLoan === 'function' && game.g.companyCash < 0) attempt(game, 'emergency-loan', ()=>game.requestEmergencyBridgeLoan());
      const negotiation = typeof game.crisisCreditorNegotiationOptions === 'function' ? game.crisisCreditorNegotiationOptions().recommended?.[0] : null;
      if (negotiation?.canExecute) attempt(game, 'creditor-negotiation', ()=>game.executeCrisisCreditorNegotiation(negotiation.type, negotiation.loanID), { type: negotiation.type });
    } else if (runtime(game).crisisWeek != null && game.g.companyDebt > 0 && game.g.companyCash > 8_000_000) {
      const amount = Math.min(game.g.companyDebt, game.g.companyCash - 6_000_000);
      if (amount > 0 && game.repay(amount, 'company')) action(game, 'recovery-repayment', { amount: Math.round(amount) });
    }
  }
}

function recordWeeklyTelemetry(game, definition) {
  const rt = runtime(game), crisis = String(game.g.playerCrisis?.status || 'stable'), active = !['stable', 'recovered'].includes(crisis);
  if (active && rt.crisisWeek == null) rt.crisisWeek = game.g.week;
  if (!active && rt.crisisWeek != null && rt.crisisExitWeek == null) rt.crisisExitWeek = game.g.week;
  if (game.g.publicCompany && rt.ipoWeek == null) rt.ipoWeek = game.g.week;
  const report = game.g.lastReport || {}, business = game.business(definition.businessID);
  const fixedCost = game.g.stores.reduce((sum, store) => sum + Number(game.business(store.businessID)?.fixedCost || 0), 0) + Number(game.g.officeWeeklyCost || 0);
  rt.history.push({ week: game.g.week, cash: Math.round(game.g.companyCash), debt: Math.round(game.g.companyDebt), sales: Math.round(Number(report.sales || 0)), profit: Math.round(Number(report.profit || 0)), stores: game.g.stores.length, price: Math.round(Number(business?.price || 0)), fixedCost: Math.round(fixedCost), actions: rt.selectedActions.slice(), crisisStatus: crisis });
  rt.history = rt.history.slice(-26);
}

function createGame(definition) {
  const random = statefulRandom(definition.seed);
  const loaded = loadGame({ random, headless: true });
  const game = new loaded.engineModule.TycoonEngine();
  // The browser persists every action/week. Exploration checkpoints explicitly instead,
  // avoiding 1000 large transient save strings (and the harness's optional save log).
  game.save = () => true;
  game.g.skipWeeklyValidation = true;
  game.configure({ playerName: '探索プレイヤー', companyName: `探索-${definition.businessID}`, difficulty: definition.difficulty, scenario: 'free' });
  applyInitialStyle(game, definition);
  // Establish the same normalized current-version baseline that every restored segment receives.
  game.normalize();
  game.g.skipWeeklyValidation = true;
  return { game, random, engineModule: loaded.engineModule };
}

function resumeGame(definition, checkpoint) {
  const random = statefulRandom(definition.seed);
  const loaded = loadGame({ random, headless: true });
  const game = new loaded.engineModule.TycoonEngine();
  game.g = checkpoint.state;
  game.save = () => true;
  game.g.skipWeeklyValidation = true;
  random.setState(checkpoint.randomState);
  return { game, random, engineModule: loaded.engineModule };
}

function runSegment(definition, checkpoint = null, weeks = SEGMENT_WEEKS) {
  const session = checkpoint ? resumeGame(definition, checkpoint) : createGame(definition);
  const { game, random } = session;
  let maxRSS = process.memoryUsage().rss;
  const targetWeek = Math.min(MAX_WEEKS + 1, game.g.week + weeks);
  while (!game.g.gameOver && game.g.week < targetWeek) {
    applyWeeklyStyle(game, definition);
    game.advanceWeek(false);
    recordWeeklyTelemetry(game, definition);
    maxRSS = Math.max(maxRSS, process.memoryUsage().rss);
  }
  return {
    result: terminalSummary(game, definition, maxRSS, random.getState(), game.g.week - 1),
    checkpoint: game.g.gameOver || game.g.week >= MAX_WEEKS + 1 ? null : { state: game.g, randomState: random.getState() }
  };
}

function runCase(definition, { segmented = false, onSegment = null, maxRSSBytes = Infinity } = {}) {
  let { game, random, engineModule } = createGame(definition);
  let maxRSS = process.memoryUsage().rss;
  let engineFailure = null;
  while (!game.g.gameOver && game.g.week <= MAX_WEEKS) {
    applyWeeklyStyle(game, definition);
    game.advanceWeek(false);
    recordWeeklyTelemetry(game, definition);
    maxRSS = Math.max(maxRSS, process.memoryUsage().rss);
    if (maxRSS > maxRSSBytes) { engineFailure = `rss-limit exceeded at week ${game.g.week}: ${maxRSS} bytes`; break; }
    const completedWeeks = game.g.week - 1;
    if (segmented && completedWeeks > 0 && completedWeeks % SEGMENT_WEEKS === 0 && !game.g.gameOver && game.g.week <= MAX_WEEKS) {
      const checkpoint = JSON.stringify(game.g);
      const randomState = random.getState();
      game = new engineModule.TycoonEngine();
      game.g = JSON.parse(checkpoint);
      game.save = () => true;
      random.setState(randomState);
      if (onSegment) onSegment({ week: game.g.week, checkpointBytes: Buffer.byteLength(checkpoint) });
    }
  }
  return terminalSummary(game, definition, maxRSS, random.getState(), game.g.week - 1, engineFailure);
}

async function writeJSONLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, 'drain');
}

module.exports = { MAX_WEEKS, SEGMENT_WEEKS, STYLE_LOGIC, canonicalState, canonicalHash, statefulRandom, outcomeSignature, createGame, applyWeeklyStyle, recordWeeklyTelemetry, runCase, runSegment, writeJSONLine };
