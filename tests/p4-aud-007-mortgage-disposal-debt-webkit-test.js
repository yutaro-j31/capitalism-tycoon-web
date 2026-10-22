'use strict';
// P4-AUD-007 D-1 in real iPhone WebKit emulation / real IndexedDB; not a physical device test.
// S1 company sale keeps the unrelated bank loan and validates; personal sale keeps personalDebt;
// S2 is quarantined with no mutation; save-false rolls back; reload and fresh durable-only hydration agree.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { webkit, devices } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const DIR = path.resolve(process.env.MA_DEAL_ROOM_ARTIFACT_DIR || 'artifacts/p4-aud-007-mortgage-disposal-webkit');
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const options = { ...devices['iPhone 13'], locale: 'ja-JP', timezoneId: 'Asia/Tokyo', serviceWorkers: 'block' };
const server = http.createServer((req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1));
    assert.ok(file.startsWith(ROOT + path.sep));
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); res.end(fs.readFileSync(file));
  } catch (error) { res.statusCode = 404; res.end(String(error)); }
});

// Runs in the page. Builds the case through real writers, acts, checks invariants, returns a pick.
async function runCase(kind) {
  const m = globalThis.__capitalismTycoonModules, UNRELATED = 50_000_000;
  const owner = kind === 'personal' ? 'personal' : 'company', cashKey = owner === 'company' ? 'companyCash' : 'personalCash';
  const g = m.engine.createInitialState({ configured: true });
  Object.assign(g, { week: 20, companyCash: 400_000_000, personalCash: 400_000_000, companyDebt: 0, personalDebt: 0 });
  const base = g.properties[0];
  g.properties = [{ ...base, id: 'P1', name: 'Mortgage One', owner, value: 300_000_000, marketValue: 300_000_000, purchasePrice: 300_000_000,
    realEstate: { ...(base.realEstate || {}), landBookValue: 100_000_000, buildingBookValue: 150_000_000 },
    mortgageBalance: 0, mortgageProductID: '', mortgageRemainingWeeks: 0 }];
  g.finance = m.finance.defaultFinanceState(g);
  const e = new m.engine.TycoonEngine(g), key = m.engine.SAVE_KEY;
  await m.saveStorageIDB.hydrate();
  if (!m.saveStorageIDB.status().available) throw new Error('real IDB prerequisite');
  if (e.borrow(UNRELATED, owner) !== true) throw new Error('unrelated loan');
  // A pre-Option-A save: the off-book mortgage the old refinance writer produced (no finance row, no debt aggregate,
  // a proceeds row with no liability effect), reproduced field by field. runCase is serialized into the page, so it is inline.
  const legacyMortgage = (id, productID) => e.runTransaction(() => {
    const p = e.g.properties.find(x => x.id === id), product = m.realEstateMortgageRefinancing.PRODUCTS[productID];
    const round = v => Math.round(Number(v) * 100) / 100, week = Math.floor(Number(e.g.week) || 1), own = p.owner === 'personal' ? 'personal' : 'company';
    const key = own === 'personal' ? 'personalCash' : 'companyCash', target = round(Number(p.marketValue) * product.maxLTV), old = round(p.mortgageBalance);
    const gross = Math.max(0, target - old), fee = round(target * product.feeRate), net = round(Math.max(0, gross - fee));
    e.g[key] = round(e.g[key] + net);
    Object.assign(p, { mortgageProductID: productID, mortgageBalance: target, mortgageRemainingWeeks: product.termWeeks, lastMortgageActionWeek: week });
    if (own === 'company') {
      if (net > 0) m.finance.event(e.g, 'propertyMortgageProceeds', net, { cashEffect: net, profitEffect: 0, sourceType: 'property-mortgage', sourceID: id, idempotencyKey: `property-mortgage-proceeds-${id}-w${week}`, description: `${p.name || id} 借換手取金` });
      if (fee > 0) m.finance.event(e.g, 'propertyMortgageFee', fee, { cashEffect: 0, profitEffect: -fee, sourceType: 'property-mortgage-fee', sourceID: id, idempotencyKey: `property-mortgage-fee-${id}-w${week}`, description: `${p.name || id} 借換手数料` });
    }
    m.realEstateMortgageRefinancing.ensure(e.g).propertyMortgageHistory.push({ type: 'mortgage-refinance', week, propertyID: id, owner: own, productID, oldBalance: old, newBalance: target, fee, netProceeds: net });
    return { oldBalance: old, newBalance: target, fee, netProceeds: net };
  });
  const mortgage = legacyMortgage('P1', 'fixed');
  if (!mortgage) throw new Error('mortgage');
  if (kind === 'S2') e.g.finance = m.finance.defaultFinanceState(e.g);
  if (!e.save()) throw new Error('baseline save'); await m.saveStorageIDB.flush();
  // Key-order-insensitive: the transaction rollback restores values, not object key order.
  const canon = value => JSON.stringify(value, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(x => [x, v[x]])) : v);
  const before = canon(e.g), mirror = localStorage.getItem(key), payoff = mortgage.newBalance, cashBefore = e.g[cashKey];
  const validBefore = m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok;
  let result, thrown = false, toasts = 0;
  e.addEventListener('notify', () => { toasts++; });
  const save = e.save;
  if (kind === 'save-false') e.save = () => false;
  try { result = e.sellProperty('P1'); } catch (_) { thrown = true; } finally { e.save = save; }
  await m.saveStorageIDB.flush();
  if (thrown) throw new Error('unexpected throw');
  if (kind === 'S2' || kind === 'save-false') {
    if (result !== false) throw new Error(`${kind}: must be refused`);
    if (kind === 'S2' && (!validBefore || toasts !== 1)) throw new Error('S2 must validate before and warn once');
    if (canon(e.g) !== before || localStorage.getItem(key) !== mirror || m.saveStorageIDB.readSync(key) !== mirror)
      throw new Error(`${kind}: live/mirror/cache changed`);
  } else {
    if (result !== true) throw new Error(`${kind}: sale refused`);
    const gross = Math.round(300_000_000 * 0.97 * 100) / 100;
    if (e.g[cashKey] - cashBefore !== gross - payoff) throw new Error('cash must move by gross - payoff');
    if (owner === 'company' && e.g.companyDebt !== UNRELATED) throw new Error('companyDebt consumed');
    if (owner === 'personal' && e.g.personalDebt !== UNRELATED) throw new Error('personalDebt consumed');
    const row = e.g.finance.transactions.find(r => r.sourceType === 'property-disposition-debt');
    if (owner === 'company' && (!row || row.cashEffect !== -payoff || row.liabilityEffect !== 0)) throw new Error('debt row');
    if (!m.finance.validate(JSON.parse(JSON.stringify(e.g))).ok || !m.finance.debtRollforwardStatus(e.g).ok) throw new Error('accounting');
  }
  return { companyCash: e.g.companyCash, personalCash: e.g.personalCash, companyDebt: e.g.companyDebt, personalDebt: e.g.personalDebt,
    mortgageBalance: e.g.properties.find(p => p.id === 'P1').mortgageBalance, owner: e.g.properties.find(p => p.id === 'P1').owner,
    loans: e.g.finance.loans.map(l => ({ id: l.loanID, balance: l.outstandingPrincipal, status: l.status })),
    ledger: e.g.finance.transactions.length, rng: e.g.simulationRng, saveVersion: e.g.saveVersion };
}
function pickLoaded(g) {
  return { companyCash: g.companyCash, personalCash: g.personalCash, companyDebt: g.companyDebt, personalDebt: g.personalDebt,
    mortgageBalance: g.properties.find(p => p.id === 'P1').mortgageBalance, owner: g.properties.find(p => p.id === 'P1').owner,
    loans: g.finance.loans.map(l => ({ id: l.loanID, balance: l.outstandingPrincipal, status: l.status })),
    ledger: g.finance.transactions.length, rng: g.simulationRng, saveVersion: g.saveVersion };
}

(async () => {
  fs.mkdirSync(DIR, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`, results = [];
  let browser;
  try {
    browser = await webkit.launch();
    for (const kind of ['S1', 'personal', 'S2', 'save-false']) {
      const context = await browser.newContext(options), page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const expected = await page.evaluate(`(${runCase.toString()})(${JSON.stringify(kind)})`);
      const loaded = target => target.evaluate(async src => {
        const m = globalThis.__capitalismTycoonModules; await m.saveStorageIDB.hydrate();
        return eval(`(${src})`)(m.engine.TycoonEngine.load().g);
      }, pickLoaded.toString());
      await page.reload({ waitUntil: 'networkidle' });
      assert.deepEqual(await loaded(page), expected, `${kind}: reload`);
      // IndexedDB export from actual WebKit, localStorage removed to force durable-only hydration.
      const storageState = await context.storageState({ indexedDB: true });
      for (const origin of storageState.origins) origin.localStorage = [];
      const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
      await freshPage.goto(url, { waitUntil: 'networkidle' });
      assert.deepEqual(await loaded(freshPage), expected, `${kind}: fresh durable-only hydration`);
      await fresh.close(); await context.close();
      results.push({ kind, ok: true });
      console.log(`${kind}: mortgage disposal / reload / fresh real IDB PASS`);
    }
    fs.writeFileSync(path.join(DIR, 'p4-aud-007-mortgage-disposal-result.json'), JSON.stringify({ physicalDevice: false, ok: true, results }, null, 2));
    console.log('iPhone WebKit P4-AUD-007 mortgage disposal debt PASS');
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
