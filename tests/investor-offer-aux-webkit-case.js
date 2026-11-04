'use strict';
// P3-4 G35: the auxiliary investor-offer commands (refreshInvestorOffers, declineInvestorOffer) in real iPhone WebKit.
// Required by investor-offer-save-atomicity-webkit-test.js, which owns the browser, server and workflow step.
// Every shared fault kind plus pending-predecessor and nested variants must roll back state, RNG, mirror and real
// IndexedDB bytes; reload and a fresh context hydrate the pre-command state; a retry then commits exactly once.
const assert = require('node:assert/strict');

// Runs in the page against its installed modules: one auxiliary command under one fault.
const auxCase = async ({ variant, fault, pending, nested, soft, mutation }) => {
  const m = globalThis.__capitalismTycoonModules, e = new m.engine.TycoonEngine(), key = m.engine.SAVE_KEY;
  e.g.configured = true;
  const office = e.g.rentalOffices.reduce((a, b) => a.deposit < b.deposit ? a : b);
  if (!e.contractOffice(office.id)) throw new Error('baseline office failed');
  if (variant === 'decline' && !e.refreshInvestorOffers()) throw new Error('baseline offers failed');
  if (!e.save()) throw new Error('baseline save failed');
  const offerID = variant === 'decline' ? e.g.investorOffers.find(o => o.status === 'pending').id : null;
  const offers = e.g.investorOffers.length;
  await m.saveStorageIDB.flush();
  const durable = () => new Promise((resolve, reject) => {
    const open = indexedDB.open('capitalism-tycoon', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result, tx = db.transaction('saves', 'readonly'), get = tx.objectStore('saves').get(key);
      tx.oncomplete = () => { const value = get.result; db.close(); resolve(value); };
      tx.onerror = () => reject(tx.error);
    };
  });
  if (mutation === 'rollback') e.restoreTransactionSnapshot = () => {};
  // A distinguishable pending predecessor, queued before any microtask can start its durable write.
  if (pending) { e.g.companyName = 'Pending Aux Predecessor'; if (!e.save()) throw new Error('pending predecessor rejected'); }
  const before = JSON.stringify(e.g), bytes = localStorage.getItem(key);
  const command = () => variant === 'decline' ? e.declineInvestorOffer(offerID) : e.refreshInvestorOffers();
  let injection, result = null, thrown = false;
  if (fault === 'save-before-throw') {
    const save = e.save; let hits = 0;
    e.save = () => { hits++; throw new Error('investor offer aux save before admission threw'); };
    injection = { hits: () => hits, restore() { e.save = save; } };
  } else injection = globalThis.__injectInvestorFault(e, m, localStorage, key, fault);
  try { result = nested ? e.runTransaction(command) : command(); }
  catch (_) { thrown = true; }
  finally { injection.restore(); }
  await m.saveStorageIDB.flush();
  if (!(injection.hits() > 0)) throw new Error(`fault not reached: ${variant}/${fault}`);
  const stored = await durable();
  const rollback = JSON.stringify(e.g) === before && localStorage.getItem(key) === bytes
    && m.saveStorageIDB.readSync(key) === bytes && stored === bytes;
  if (!rollback || (soft.includes(fault) ? result !== false || thrown : !thrown))
    throw new Error(`failure boundary did not roll back: ${JSON.stringify({ variant, fault, pending, nested, rollback, result, thrown })}`);
  if (pending && JSON.parse(stored).companyName !== 'Pending Aux Predecessor') throw new Error('pending predecessor not durable');
  return { variant, fault, pending, nested, rollback, returned: result, thrown, offers, offerID };
};

async function loaded(page) {
  return page.evaluate(() => {
    const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
    return { offers: e.g.investorOffers.map(o => o.status), valid: m.finance.validate(e.g).ok };
  });
}

async function run({ browser, url, options, inject, FAULT_KINDS, SOFT_FAILURES, results }) {
  const cases = [];
  for (const variant of ['refresh', 'decline']) {
    for (const fault of FAULT_KINDS) cases.push({ variant, fault, pending: false, nested: false });
    for (const fault of ['save-false', 'save-throw']) cases.push({ variant, fault, pending: true, nested: false }, { variant, fault, pending: false, nested: true });
  }
  for (const c of cases) {
    const context = await browser.newContext(options), page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: 'globalThis.__injectInvestorFault=' + inject.toString() + ';' });
    const proof = await page.evaluate(auxCase, { ...c, soft: SOFT_FAILURES, mutation: null });
    results.push(proof);
    const expected = c.variant === 'decline' ? Array(proof.offers).fill('pending') : [];
    await page.reload({ waitUntil: 'networkidle' });
    assert.deepEqual(await loaded(page), { offers: expected, valid: true }, `${c.variant}/${c.fault}: reload keeps the pre-command state`);
    const storageState = await context.storageState({ indexedDB: true });
    const fresh = await browser.newContext({ ...options, storageState }), freshPage = await fresh.newPage();
    await freshPage.goto(url, { waitUntil: 'networkidle' });
    assert.deepEqual(await loaded(freshPage), { offers: expected, valid: true }, `${c.variant}/${c.fault}: fresh IndexedDB hydration`);
    // The retry commits once and a repeat is refused (decline) or adds its own offers (refresh).
    const retry = await freshPage.evaluate(async ({ variant, offerID }) => {
      const m = globalThis.__capitalismTycoonModules, e = m.engine.TycoonEngine.load();
      const ok = variant === 'decline' ? e.declineInvestorOffer(offerID) : e.refreshInvestorOffers();
      const again = variant === 'decline' ? e.declineInvestorOffer(offerID) : null;
      await m.saveStorageIDB.flush();
      return { ok, again };
    }, { variant: c.variant, offerID: proof.offerID });
    assert.deepEqual(retry, { ok: true, again: c.variant === 'decline' ? false : null });
    await freshPage.reload({ waitUntil: 'networkidle' });
    const after = await loaded(freshPage);
    assert.equal(after.valid, true);
    if (c.variant === 'decline') assert.equal(after.offers.filter(s => s === 'declined').length, 1, 'exactly one decline persisted');
    else assert.ok(after.offers.length >= 1 && after.offers.length <= 2 && after.offers.every(s => s === 'pending'), 'one refresh persisted');
    await fresh.close(); await context.close();
  }
  // Negative control: the same oracle rejects a disabled rollback for each auxiliary command.
  for (const variant of ['refresh', 'decline']) {
    const context = await browser.newContext(options), page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.addScriptTag({ content: 'globalThis.__injectInvestorFault=' + inject.toString() + ';' });
    await assert.rejects(page.evaluate(auxCase, { variant, fault: 'save-false', pending: false, nested: false, soft: SOFT_FAILURES, mutation: 'rollback' }),
      /did not roll back/, `${variant}: a disabled rollback is rejected`);
    results.push({ variant, mutation: 'rollback disabled rejected', pass: true });
    await context.close();
  }
}
module.exports = { run };
