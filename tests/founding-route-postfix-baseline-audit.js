'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

const BUSINESS_IDS = ['ramen', 'conveni', 'gym', 'realEstateAgency'];
const SEED = 190826041;
const STANDARD_WEEKS = 500;
const CONSERVATIVE_WEEKS = 500;
const DETERMINISM_WEEKS = 120;
const TARGET_VALUE = 1_000_000_000;
const CHECKPOINTS = new Set([52, 104, 208, 300, 500]);

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function round(value) {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0;
}

function average(rows) {
  return rows.length ? rows.reduce((sum, value) => sum + Number(value || 0), 0) / rows.length : 0;
}

function highestTrafficTenant(engine) {
  return engine.g.tenants
    .filter(row => !row.occupiedBy)
    .sort((a, b) => Number(b.traffic || 0) - Number(a.traffic || 0) || Number(a.deposit || 0) - Number(b.deposit || 0) || String(a.id).localeCompare(String(b.id)))[0] || null;
}

function upfrontFor(engine, tenant, businessID) {
  return Number(engine.business(businessID).storeCost || 0) + Number(tenant?.deposit || 0);
}

function initialOpen(engine, businessID) {
  const tenant = highestTrafficTenant(engine);
  if (!tenant) return { opened: false, reason: 'no-tenant', ordinaryBorrowing: 0, startupLoan: null, upfront: 0, tenantID: null, tenantTraffic: null };

  const upfront = upfrontFor(engine, tenant, businessID);
  const ordinaryBorrowing = Math.min(
    Math.max(0, upfront - Number(engine.g.companyCash || 0)),
    Math.max(0, Math.floor(Number(engine.companyCreditLimit()) - Number(engine.g.companyDebt || 0)))
  );
  let ordinaryBorrowed = false;
  if (ordinaryBorrowing > 0) ordinaryBorrowed = engine.borrow(ordinaryBorrowing, 'company') === true;

  const estimate = engine.estimateStoreOpening({ tenantID: tenant.id, businessID, operatingHours: 3 });
  const opened = engine.openStore({
    tenantID: tenant.id,
    businessID,
    name: businessID + ' 1号店',
    operatingHours: 3
  }) === true;

  return {
    opened,
    reason: opened ? null : 'openStore-failed',
    upfront: round(upfront),
    ordinaryBorrowing: round(ordinaryBorrowing),
    ordinaryBorrowed,
    startupLoan: estimate?.startupLoan ? {
      eligible: Boolean(estimate.startupLoan.eligible),
      principal: round(estimate.startupLoan.principal),
      required: round(estimate.startupLoan.required),
      weeklyPayment: round(estimate.startupLoan.weeklyPayment),
      annualRate: Number(estimate.startupLoan.annualRate || 0),
      term: Number(estimate.startupLoan.term || 0)
    } : null,
    tenantID: tenant.id,
    tenantTraffic: Number(tenant.traffic || 0),
    tenantDeposit: round(tenant.deposit)
  };
}

function recentAverageProfit(engine) {
  return average(engine.g.reports.slice(-8).map(row => Number(row.profit || 0)));
}

function maybeExpand(engine, businessID, elapsedWeek, actionLog) {
  if (elapsedWeek % 4 !== 0) return false;
  if (engine.g.reports.length < 8) return false;
  if (recentAverageProfit(engine) <= 0) return false;
  if (!engine.g.stores.length || engine.g.stores.some(store => store.status !== 'open')) return false;

  const tenant = highestTrafficTenant(engine);
  if (!tenant) return false;
  const upfront = upfrontFor(engine, tenant, businessID);
  if (!(Number(engine.g.companyCash || 0) > upfront * 3)) return false;

  const beforeCash = Number(engine.g.companyCash || 0);
  const opened = engine.openStore({
    tenantID: tenant.id,
    businessID,
    name: businessID + ' ' + (engine.g.stores.length + 1) + '号店',
    operatingHours: 3
  }) === true;
  if (opened) {
    actionLog.push({
      elapsedWeek,
      gameWeek: engine.g.week,
      action: 'openStore',
      tenantID: tenant.id,
      tenantTraffic: Number(tenant.traffic || 0),
      upfront: round(upfront),
      cashBefore: round(beforeCash),
      cashAfter: round(engine.g.companyCash)
    });
  }
  return opened;
}

function snapshot(engine, elapsedWeek) {
  const statements = engine.g.finance ? engine.constructor && globalThis : null;
  return {
    elapsedWeek,
    gameWeek: engine.g.week,
    companyValue: round(engine.companyValue()),
    companyCash: round(engine.g.companyCash),
    companyDebt: round(engine.g.companyDebt),
    storeCount: engine.g.stores.length,
    openStores: engine.g.stores.filter(row => row.status === 'open').length,
    averageProfit8: round(recentAverageProfit(engine)),
    gameOver: Boolean(engine.g.gameOver),
    gameOverReason: String(engine.g.gameOverReason || '')
  };
}

function gymLoanBreakdown(engine, openingWeek, openingStoreProfit) {
  if (openingWeek == null) return null;
  const startupMeta = (engine.g.bankFinancing?.loans || []).find(row => row.productType === 'gymStartup');
  const payments = (engine.g.bankFinancing?.history || []).filter(row =>
    row.week === openingWeek &&
    row.type === 'payment' &&
    (!startupMeta || row.loanId === startupMeta.id)
  );
  const principal = payments.reduce((sum, row) => sum + Number(row.principal || 0), 0);
  const scheduledInterest = payments.reduce((sum, row) => sum + Number(row.interest || 0), 0);
  const report = engine.g.reports.find(row => row.week === openingWeek);
  return {
    openingWeek,
    storeOpeningProfit: round(openingStoreProfit),
    companyOpeningWeekProfit: round(report?.profit),
    scheduledPrincipalPayment: round(principal),
    scheduledInterestPayment: round(scheduledInterest),
    scheduledDebtService: round(principal + scheduledInterest),
    engineReportedInterestExpense: round(report?.interest),
    note: 'storeOpeningProfit is store operating profit and excludes financing cash flows; scheduled debt service is reported separately.'
  };
}

function simulate(businessID, mode, maxWeeks, { validate = true } = {}) {
  const { modules } = loadGame({ random: lcg(SEED) });
  const engine = new modules.engine.TycoonEngine(modules.engine.createInitialState({ configured: true }));
  engine.g.configured = true;

  const initial = initialOpen(engine, businessID);
  const actionLog = [];
  if (initial.opened) {
    actionLog.push({
      elapsedWeek: 0,
      gameWeek: engine.g.week,
      action: 'openInitialStore',
      tenantID: initial.tenantID,
      tenantTraffic: initial.tenantTraffic,
      upfront: initial.upfront,
      ordinaryBorrowing: initial.ordinaryBorrowing,
      startupLoan: initial.startupLoan
    });
  }

  let targetElapsedWeek = null;
  let targetGameWeek = null;
  let openingWeek = null;
  let openingStoreProfit = null;
  const checkpoints = [];

  if (initial.opened) {
    for (let elapsedWeek = 1; elapsedWeek <= maxWeeks; elapsedWeek += 1) {
      const beforeOpenCount = engine.g.stores.filter(row => row.status === 'open').length;
      const advanced = engine.advanceWeek(false);
      if (advanced === false) break;

      const afterOpen = engine.g.stores.filter(row => row.status === 'open');
      if (openingWeek == null && beforeOpenCount === 0 && afterOpen.length > 0) {
        openingWeek = engine.g.week;
        openingStoreProfit = afterOpen[0].lastProfit;
      }

      if (mode === 'standard' && !engine.g.gameOver) maybeExpand(engine, businessID, elapsedWeek, actionLog);

      const value = Number(engine.companyValue() || 0);
      if (targetElapsedWeek == null && value >= TARGET_VALUE) {
        targetElapsedWeek = elapsedWeek;
        targetGameWeek = engine.g.week;
      }

      if (CHECKPOINTS.has(elapsedWeek) || engine.g.gameOver) checkpoints.push(snapshot(engine, elapsedWeek));
      if (engine.g.gameOver) break;
    }
  }

  const financeValidation = validate ? modules.finance.validate(engine.g) : { ok: true, errors: [] };
  assert.equal(financeValidation.ok, true, businessID + ' ' + mode + ' finance validation: ' + JSON.stringify(financeValidation.errors));
  assert.doesNotThrow(() => JSON.stringify(engine.g), businessID + ' ' + mode + ' state must remain serializable');

  const statements = modules.finance.buildStatements(engine.g, '52');
  const final = {
    elapsedWeeks: checkpoints.length && checkpoints.at(-1).gameOver ? checkpoints.at(-1).elapsedWeek : (initial.opened ? Math.min(maxWeeks, Math.max(0, engine.g.week - 1)) : 0),
    gameWeek: engine.g.week,
    companyValue: round(engine.companyValue()),
    totalAssets: round(statements.balanceSheet.assets.totalAssets),
    companyCash: round(engine.g.companyCash),
    companyDebt: round(engine.g.companyDebt),
    storeCount: engine.g.stores.length,
    openStores: engine.g.stores.filter(row => row.status === 'open').length,
    averageProfit8: round(recentAverageProfit(engine)),
    gameOver: Boolean(engine.g.gameOver),
    gameOverReason: String(engine.g.gameOverReason || '')
  };

  return {
    businessID,
    mode,
    seed: SEED,
    requestedWeeks: maxWeeks,
    policy: mode === 'standard'
      ? 'highest-traffic tenant; every 4 elapsed weeks, if all stores are open, last-8-week company profit is positive, and company cash is strictly greater than 3x next store upfront cost, open one same-industry store'
      : 'same initial opening path, then no further player actions',
    initial,
    targetValue: TARGET_VALUE,
    targetElapsedWeek,
    targetGameWeek,
    final,
    checkpoints,
    actionLog,
    financeValidation,
    gymOpeningLoanBreakdown: businessID === 'gym' ? gymLoanBreakdown(engine, openingWeek, openingStoreProfit) : null
  };
}

function determinismDigest(result) {
  return {
    businessID: result.businessID,
    mode: result.mode,
    initial: result.initial,
    targetElapsedWeek: result.targetElapsedWeek,
    targetGameWeek: result.targetGameWeek,
    final: result.final,
    checkpoints: result.checkpoints,
    actionLog: result.actionLog
  };
}

const standard = BUSINESS_IDS.map(id => simulate(id, 'standard', STANDARD_WEEKS));
const conservative = BUSINESS_IDS.map(id => simulate(id, 'conservative', CONSERVATIVE_WEEKS));
const determinism = BUSINESS_IDS.map(businessID => {
  const a = simulate(businessID, 'standard', DETERMINISM_WEEKS, { validate: false });
  const b = simulate(businessID, 'standard', DETERMINISM_WEEKS, { validate: false });
  const left = determinismDigest(a);
  const right = determinismDigest(b);
  assert.deepEqual(left, right, businessID + ' same seed + same action policy must be deterministic');
  return { businessID, weeks: DETERMINISM_WEEKS, identical: true };
});

const result = {
  generatedFrom: 'production TycoonEngine via tests/harness.js',
  approximationModel: false,
  seed: SEED,
  targetCompanyValue: TARGET_VALUE,
  standardWeeks: STANDARD_WEEKS,
  conservativeWeeks: CONSERVATIVE_WEEKS,
  determinismWeeks: DETERMINISM_WEEKS,
  standard,
  conservative,
  determinism
};

const outDir = path.join(__dirname, '..', 'artifacts', 'founding-route-baseline');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(result, null, 2) + '\n');
console.log('FOUNDING_ROUTE_POSTFIX_BASELINE ' + JSON.stringify(result));
console.log('founding route post-fix baseline audit completed');
