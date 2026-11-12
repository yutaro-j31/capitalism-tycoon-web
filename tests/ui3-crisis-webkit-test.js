'use strict';

// UI v3 cash-crisis response sheet (docs/ui-v3/README.md 10.2, task UI3-9b-1). Loads the real js/ui3-crisis.js. Proves in a real
// browser that:
//  - without ?ui=3 the current crisis panel (js/player-crisis-ui.js) is unchanged with and without the v3 script;
//  - during a crisis the v3 home stays, and the shell's notice and the first "今週やること" slot open the response sheet;
//  - the sheet shows the engine's own quote (cash, shortfall, loan, sponsor equity), the founder's injection starts from the current
//    panel's own default and moves the personal and the company cash by exactly the amount entered, cancelling changes nothing;
//  - actions the current panel disables are disabled with the reason; one press calls the engine function once (no double run).
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const SCREEN_MODULE = /\/js\/ui3-(?:crisis)\.js(?:\?.*)?$/;
const OTHER_SCREEN_MODULES = /\/js\/ui3-(?!shell\.js|crisis\.js|home\.js)[^/?]+\.js(?:\?.*)?$/;

// --- static contracts ---------------------------------------------------
const FILES = ['ui3-crisis'];
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
for (const name of FILES) {
  const source = fs.readFileSync(path.join(ROOT, 'js', `${name}.js`), 'utf8');
  assert.doesNotMatch(source, /Math\.random|Date\.now|MutationObserver|registerUIEnhancer/, `${name} uses no RNG, clock, observer or D UI enhancer`);
  assert.doesNotMatch(source, /\b(?:g|engine\.g|context\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, `${name} never assigns engine state`);
  assert.doesNotMatch(source, /\.save\(|localStorage|sessionStorage|(?<![\w.])confirm\(/, `${name} never saves, stores or uses the browser's confirm()`);
  assert.ok(index.indexOf(`./js/${name}.js`) > index.indexOf('./js/ui3-shell.js') && index.indexOf(`./js/${name}.js`) < index.indexOf('./js/app.js'), `index.html loads ${name} after the shell and before the app`);
}

function serve() {
  const server = http.createServer((request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url || '/', 'http://127.0.0.1').pathname);
      const file = path.resolve(ROOT, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
      assert.ok(file.startsWith(`${ROOT}${path.sep}`));
      const body = fs.readFileSync(file);
      response.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(body);
    } catch (error) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('Not found');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const goTo = (page, tab) => page.evaluate(id => document.querySelector(`[data-action="tab"][data-tab="${id}"]`).click(), tab);
const engineEval = (page, fn, arg) => page.evaluate(([source, value]) => {
  const engine = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine();
  return (0, eval)(`(${source})`)(engine, value);
}, [fn.toString(), arg]);
const digest = page => engineEval(page, engine => JSON.stringify(engine.g, (key, value) => (key === 'lastSaveDate' || key === 'saveSequence' ? undefined : value)));
// the share-count dialog is the v3 amount sheet (UI3-9a)
const cancelDialog = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').tap();
async function enterAmount(page, amount) {
  await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
  await page.locator('#modal-root [data-ui3-amount-input]').fill(String(amount));
  await page.locator('#modal-root [data-ui3-amount-run]').tap();
}

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
}
const metrics = page => page.evaluate(() => {
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
  const controls = [...document.querySelectorAll('#app button,#app a[href],#app input,#app select')].filter(visible);
  const offenders = []; let minFont = 99; const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) { const f = parseFloat(getComputedStyle(node.parentElement).fontSize); if (f < 13) offenders.push(node.parentElement.outerHTML.slice(0, 140)); minFont = Math.min(minFont, f); } }
  return { small: controls.filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.className || element.tagName),
    minFont, overflowX: document.documentElement.scrollWidth > innerWidth, screens: document.documentElement.scrollHeight / innerHeight };
});
const sheetMetrics = page => page.evaluate(() => {
  const root = document.querySelector('#modal-root .u-sheet');
  const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const small = [...root.querySelectorAll('button')].filter(visible).filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.textContent.trim());
  let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
  return { small, minFont, bottom: Math.round(root.getBoundingClientRect().bottom), primaries: [...root.querySelectorAll('.u-btn.primary')].filter(visible).length };
});

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async ({ withoutScreen = false } = {}) => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await context.route(OTHER_SCREEN_MODULES, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 crisis test */' }));
    if (withoutScreen) await context.route(SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 crisis sheet */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  const confirmFacts = page => page.locator('#modal-root [data-ui3-confirm-facts] .u-stat').evaluateAll(nodes => nodes.map(node => [node.querySelector('span').innerText, node.querySelector('b').innerText]));
  const sheetOk = async (page, label) => {
    const sheet = await sheetMetrics(page);
    assert.deepEqual([sheet.small, sheet.bottom], [[], device.viewport.height], `${label}: tap targets and bottom edge`);
    assert.ok(sheet.minFont >= 13, `${label}: font ${sheet.minFont}px`);
  };
  const cancel = page => page.locator('#modal-root .u-sheet-foot [data-action="close-modal"]').first().tap();
  // a real crisis, built the way tests/player-crisis-actions-test.js builds it (cash below zero, a finance state, the crisis evaluation)
  const makeCrisis = (page, cash = -1000000, personal = 50000000, propertyValue = 0) => engineEval(page, (engine, [c, p, v]) => {
    const m = globalThis.__capitalismTycoonModules;
    engine.g.week = 2; engine.g.companyCash = c; engine.g.personalCash = p; engine.g.companyCredit = 80;
    if (v > 0) { const property = engine.g.properties[0]; property.owner = 'company'; property.purchasePrice = v; property.price = v; property.value = v; }
    engine.g.finance = m.finance.defaultFinanceState(engine.g);
    m.playerCrisis.evaluate(engine.g);
    engine.emit();
    return m.playerCrisis.snapshot(engine.g).status;
  }, [cash, personal, propertyValue]);
  const countCalls = (page, names) => engineEval(page, (engine, list) => {
    window.__calls = Object.fromEntries(list.map(name => [name, 0]));
    for (const name of list) { const original = engine[name].bind(engine); engine[name] = (...args) => { window.__calls[name]++; return original(...args); }; }
  }, names);
  const calls = page => page.evaluate(() => window.__calls);
  try {
    // 1. Flag off: the current crisis panel, unchanged by the presence of the v3 script.
    const current = [];
    for (const withoutScreen of [false, true]) {
      const { context, page, pageErrors } = await newPage({ withoutScreen });
      await found(page, base);
      assert.equal(await makeCrisis(page), 'distressed');
      await page.locator('#player-crisis-panel').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('.ui3').count(), 0, 'no v3 frame without ?ui=3');
      current.push(await page.evaluate(() => [...document.querySelectorAll('#player-crisis-panel [data-player-crisis-action]')].map(node => `${node.dataset.playerCrisisAction}:${node.disabled}`)));
      assert.deepEqual(pageErrors, []);
      await context.close();
    }
    assert.deepEqual(current[0], current[1], 'the current crisis panel is identical with and without the v3 script');
    assert.ok(current[0].length >= 3);

    // 2. Without the crisis sheet (v3 on): the shell behaves as before (the current home carries the panel).
    {
      const { context, page } = await newPage({ withoutScreen: true });
      await found(page, `${base}?ui=3`);
      await makeCrisis(page);
      await page.locator('#player-crisis-panel').waitFor({ state: 'attached', timeout: 10000 });
      assert.equal(await page.locator('[data-ui3-crisis-open]').count(), 0);
      await context.close();
    }

    // 3. Flag on: the v3 home stays during a crisis.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.equal(await makeCrisis(page), 'distressed');
    await page.locator('[data-ui3-screen="home"]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#player-crisis-panel').count(), 0, 'the current crisis panel is not drawn');
    assert.equal(await page.locator('[data-ui3-crisis-open]').count(), 2, 'the notice and the first action slot');
    assert.match(await page.locator('.u-screen [data-ui3-crisis-open]').nth(1).innerText(), /資金繰り/);
    const homeCards = await page.locator('.u-screen .u-action').count();
    assert.ok(homeCards <= 4, `the crisis row takes one of the three slots (${homeCards} action rows with the notice)`);
    const baseline = await digest(page);
    await page.locator('.u-screen > [data-ui3-crisis-open]').first().tap();
    await page.locator('[data-ui3-crisis-sheet]').waitFor({ state: 'attached' });
    assert.equal(await digest(page), baseline, 'opening the sheet changes nothing');
    await sheetOk(page, 'crisis sheet');

    // The numbers are the engine's own (the current panel reads the same functions).
    const quote = await engineEval(page, engine => {
      const m = globalThis.__capitalismTycoonModules, s = m.playerCrisis.snapshot(engine.g), o = engine.crisisLiquidityOptions();
      const panel = m.playerCrisisUI.render(engine.g, engine);
      return { options: o, reserve: s.reserveThreshold, defaultAmount: Number((panel.match(/id="player-crisis-founder-amount"[^>]*value="(\d+)"/) || [])[1]), compact: null };
    });
    const sheetText = await page.locator('#modal-root .u-sheet').innerText();
    const money = amount => page.evaluate(value => globalThis.__capitalismTycoonModules.engine.compactYen(value), amount);
    assert.ok(sheetText.includes(await money(quote.reserve)), 'the required reserve');
    assert.ok(sheetText.includes('資金繰り危機'));
    assert.ok(sheetText.includes(await money(quote.options.sponsorAmount)), 'the sponsor amount');

    // Disabled like the current panel: no credit line → no emergency loan (with the reason shown).
    assert.equal(quote.options.canRequestBridge, false);
    assert.equal(await page.locator('[data-ui3-cr="bridge"]').isDisabled(), true, 'the loan is disabled like the current button');
    assert.match(await page.locator('[data-ui3-cr="bridge"]').innerText(), /利用可能枠/);
    const currentDisabled = current[0];
    assert.ok(currentDisabled.includes('emergency-bridge:true'), 'the current panel disables it too');

    // Founder's injection: the amount sheet starts at the current panel's default; the cash moves by exactly the amount.
    await page.locator('[data-ui3-cr="founder"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    assert.equal(Number(await page.locator('#modal-root [data-ui3-amount-input]').inputValue()), quote.defaultAmount, 'the same default as the current panel');
    const beforeCancel = await digest(page);
    await cancel(page);
    assert.equal(await digest(page), beforeCancel, 'cancelling changes nothing');
    await countCalls(page, ['injectFounderCapital', 'requestSponsorInjection', 'executeCrisisCostReduction', 'executeCrisisDisposition', 'requestEmergencyBridgeLoan', 'startTurnaroundPlan', 'cancelTurnaroundPlan', 'acceptTurnaroundFund']);
    await page.locator('.u-screen > [data-ui3-crisis-open]').first().tap();
    await page.locator('[data-ui3-cr="founder"]').tap();
    await page.locator('#modal-root [data-ui3-amount-input]').waitFor({ state: 'visible', timeout: 10000 });
    const cashBefore = await engineEval(page, engine => ({ company: engine.g.companyCash, personal: engine.g.personalCash }));
    await enterAmount(page, 2000000);
    await page.waitForFunction(() => window.__calls.injectFounderCapital === 1, null, { timeout: 10000 });
    const cashAfter = await engineEval(page, engine => ({ company: engine.g.companyCash, personal: engine.g.personalCash }));
    assert.equal(cashAfter.company - cashBefore.company, 2000000, 'the company cash rose by exactly the amount entered');
    assert.equal(cashBefore.personal - cashAfter.personal, 2000000, 'the personal cash fell by exactly the amount entered');
    assert.equal((await calls(page)).injectFounderCapital, 1, 'one press, one call');

    // Sponsor: the sheet shows the engine's quote; cancelling calls nothing.
    await makeCrisis(page, -1000000, 50000000);
    await page.locator('[data-ui3-screen="home"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.locator('[data-ui3-crisis-open]').first().tap();
    await page.locator('[data-ui3-cr="sponsor"]').waitFor({ state: 'visible', timeout: 10000 });
    const sponsorQuote = await engineEval(page, engine => { const o = engine.crisisLiquidityOptions(); return { amount: o.sponsorAmount, equity: o.sponsorEquity, can: o.canRequestSponsor }; });
    assert.equal(sponsorQuote.can, true);
    await page.locator('[data-ui3-cr="sponsor"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const facts = await confirmFacts(page);
    assert.equal(facts[0][1], await money(sponsorQuote.amount), 'the sponsor amount is the engine quote');
    assert.equal(facts[1][1], `${(sponsorQuote.equity * 100).toFixed(1)}%`, 'the equity is the engine quote');
    await sheetOk(page, 'sponsor confirm');
    await cancel(page);
    assert.equal((await calls(page)).requestSponsorInjection, 0, 'cancelling calls nothing');

    // With a property the credit line exists: the emergency loan moves the cash and the debt as quoted; the disposal shows the engine's quote.
    await makeCrisis(page, -1000000, 50000000, 100000000);
    await page.locator('[data-ui3-crisis-open]').first().tap();
    await page.locator('[data-ui3-cr="bridge"]:not([disabled])').waitFor({ state: 'visible', timeout: 10000 });
    const loan = await engineEval(page, engine => { const o = engine.crisisLiquidityOptions(); return { amount: o.bridgeAmount, credit: o.availableCredit }; });
    await page.locator('[data-ui3-cr="bridge"]').tap();
    await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
    const loanFacts = await confirmFacts(page);
    assert.equal(loanFacts[0][1], await money(loan.amount), 'the loan amount is the engine quote');
    assert.equal(loanFacts[1][1], await money(loan.credit), 'the available line is the engine quote');
    const loanBefore = await engineEval(page, engine => ({ cash: engine.g.companyCash, debt: engine.g.companyDebt }));
    await page.locator('#modal-root [data-ui3-confirm]').tap();
    await page.waitForFunction(() => window.__calls.requestEmergencyBridgeLoan === 1, null, { timeout: 10000 });
    const loanAfter = await engineEval(page, engine => ({ cash: engine.g.companyCash, debt: engine.g.companyDebt }));
    assert.equal(loanAfter.cash - loanBefore.cash, loan.amount, 'the company cash rose by the quoted amount');
    assert.equal(loanAfter.debt - loanBefore.debt, loan.amount, 'the debt rose by the quoted amount');
    assert.equal((await calls(page)).requestEmergencyBridgeLoan, 1, 'one press, one call');
    // a disposal or a cost reduction (whichever the engine recommends): the sheet shows the engine's numbers, cancelling calls nothing
    await makeCrisis(page, -1000000, 50000000, 100000000);
    await page.locator('[data-ui3-crisis-open]').first().tap();
    await page.locator('[data-ui3-crisis-sheet]').waitFor({ state: 'attached' });
    const candidates = await engineEval(page, engine => {
      const dis = engine.crisisRestructuringOptions?.(), cost = engine.crisisCostReductionOptions?.();
      return { dispose: dis?.eligible ? (dis.recommended || []).slice(0, 3).map(r => ({ type: r.type, id: r.id, cash: r.expectedCash })) : [], cost: cost?.eligible ? (cost.recommended || []).slice(0, 3).map(r => ({ type: r.type, id: r.id, saving: r.weeklySavings })) : [] };
    });
    assert.equal(await page.locator('[data-ui3-cr="dispose"]').count(), candidates.dispose.length, 'the same disposal candidates as the current panel (three at most)');
    assert.equal(await page.locator('[data-ui3-cr="cost"]').count(), candidates.cost.length, 'the same cost-reduction candidates as the current panel');
    if (candidates.dispose.length) {
      await page.locator('[data-ui3-cr="dispose"]').first().tap();
      await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
      assert.equal((await confirmFacts(page))[0][1], await money(candidates.dispose[0].cash), 'the expected recovery is the engine quote');
      await cancel(page);
      assert.equal((await calls(page)).executeCrisisDisposition, 0, 'cancelling calls nothing');
      await page.locator('[data-ui3-crisis-open]').first().tap();
    }
    if (candidates.cost.length) {
      await page.locator('[data-ui3-cr="cost"]').first().tap();
      await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
      assert.equal((await confirmFacts(page))[0][1], await money(candidates.cost[0].saving), 'the weekly saving is the engine quote');
      await cancel(page);
      assert.equal((await calls(page)).executeCrisisCostReduction, 0, 'cancelling calls nothing');
      await page.locator('[data-ui3-crisis-open]').first().tap();
    }
    await cancel(page);

    // The turnaround plan: the same preview as the current panel; one confirmation, one call.
    await page.locator('[data-ui3-crisis-open]').first().tap();
    await page.locator('[data-ui3-cr="plan-start"]').waitFor({ state: 'visible', timeout: 10000 });
    if (!(await page.locator('[data-ui3-cr="plan-start"]').isDisabled())) {
      const preview = await engineEval(page, engine => globalThis.__capitalismTycoonModules.playerTurnaroundPlanUI.startPreview(engine.g));
      await page.locator('[data-ui3-cr="plan-start"]').tap();
      await page.locator('#modal-root [data-ui3-confirm]').waitFor({ state: 'visible' });
      const planFacts = await confirmFacts(page);
      assert.equal(planFacts[0][1], await money(preview.targetCash), 'the cash target of the current panel');
      assert.equal(planFacts[1][1], await money(preview.targetDebt), 'the debt target of the current panel');
      await page.locator('#modal-root [data-ui3-confirm]').tap();
      await page.waitForFunction(() => window.__calls.startTurnaroundPlan === 1, null, { timeout: 10000 });
      assert.equal(await engineEval(page, engine => engine.g.playerTurnaroundPlan.status), 'active');
      assert.equal((await calls(page)).startTurnaroundPlan, 1, 'one press, one call');
    }

    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-crisis-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
