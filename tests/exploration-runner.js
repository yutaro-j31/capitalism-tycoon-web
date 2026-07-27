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
  passive: { tenant: 'none', hours: 3, price: 1, reserve: Infinity, debt: false, diversify: false },
  turnaround: { tenant: 'cheapest', hours: 2, price: 1.08, reserve: 7_000_000, debt: 'crisis', diversify: false },
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
  const employees = Object.values(game.g.departmentStaff || {}).reduce((sum, value) => sum + Number(value || 0), 0) +
    Object.keys(game.g.executives || {}).length;
  return {
    ...definition,
    status: engineFailure ? 'engine-failure' : game.g.gameOver ? 'bankrupt' : weeksPlayed === MAX_WEEKS ? 'completed' : 'stopped',
    engineFailure, gameOver: Boolean(game.g.gameOver), gameOverReason: String(game.g.gameOverReason || ''),
    weeksPlayed, finalGameWeek: game.g.week,
    cash: Math.round(game.g.companyCash), debt: Math.round(game.g.companyDebt), stores: game.g.stores.length,
    employees, sales: Math.round(Number(report.sales || 0)), profit: Math.round(Number(report.profit || 0)),
    companyValue: Math.round(game.companyValue()), ipo: Boolean(game.g.publicCompany),
    crisisStatus: String(game.g.playerCrisis?.status || 'stable'), prngState: randomState >>> 0,
    canonicalStateHash: canonicalHash(game.g), reports: game.g.reports.length, maxRSSBytes: maxRSS
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

function applyInitialStyle(game, definition) {
  const style = STYLE_LOGIC[definition.playStyle];
  if (!style) throw new Error(`unknown play style: ${definition.playStyle}`);
  const business = game.business(definition.businessID);
  if (style.price !== 1) game.setBusinessPrice(definition.businessID, Math.max(1, Math.round(business.price * style.price)));
  if (style.tenant === 'none') return;
  const tenant = sortedTenants(game, style.tenant).find(row => game.g.companyCash >= business.storeCost + row.deposit + style.reserve);
  if (tenant) game.openStore({ tenantID: tenant.id, businessID: definition.businessID, name: `探索-${business.name}`, operatingHours: style.hours });
  if (style.debt === true) {
    const available = Math.max(0, game.companyCreditLimit() - game.g.companyDebt);
    if (available >= 1_000_000) game.borrow(Math.min(style.boundary ? available : 3_000_000, available), 'company');
  }
}

function applyWeeklyStyle(game, definition) {
  const style = STYLE_LOGIC[definition.playStyle];
  if (style.quality && game.g.week % 13 === 0 && game.g.companyCash > style.reserve + 500_000) game.investBusiness(definition.businessID, 'quality', 500_000);
  if (style.debt === 'crisis' && game.g.companyCash < 1_000_000) {
    const available = Math.max(0, game.companyCreditLimit() - game.g.companyDebt);
    if (available >= 1_000_000) game.borrow(Math.min(2_000_000, available), 'company');
  }
  if (style.boundary && game.g.week % 26 === 0) {
    const business = game.business(definition.businessID);
    game.setBusinessPrice(definition.businessID, business.price <= 1 ? 1_000_000 : 1);
  }
  if (style.diversify && game.g.week % 52 === 0 && game.g.stores.length < 3) {
    const alternative = game.g.businesses.find(row => row.id !== definition.businessID);
    const tenant = sortedTenants(game, 'cheapest').find(row => game.g.companyCash >= alternative.storeCost + row.deposit + style.reserve);
    if (tenant) game.openStore({ tenantID: tenant.id, businessID: alternative.id, name: `多角化-${alternative.name}`, operatingHours: 3 });
  }
}

function createGame(definition) {
  const random = statefulRandom(definition.seed);
  const loaded = loadGame({ random, headless: true, recordStorageHistory: false });
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
  const loaded = loadGame({ random, headless: true, recordStorageHistory: false });
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

module.exports = { MAX_WEEKS, SEGMENT_WEEKS, STYLE_LOGIC, canonicalState, canonicalHash, statefulRandom, outcomeSignature, runCase, runSegment, writeJSONLine };
