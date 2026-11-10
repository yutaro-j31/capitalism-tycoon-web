'use strict';

// UI v3 weekly report sheet (docs/ui-v3/README.md 5.4, task UI3-2).
// This test loads the REAL module (js/ui3-weekly-report.js) and proves in a real browser that:
//  - without ?ui=3 the current weekly modal is shown, with the same controls with and without the module;
//  - with ?ui=3 the sheet has exactly the 5.4 contents, in one screen, with no scrolling, fully visible
//    above the current UI's fixed bars (the report opens from any screen, ported or not) and above the v3 frame;
//  - its controls reach existing actions and close the sheet (詳しい決算, 閉じる, the scrim, the next move);
//  - the one-sentence result, the +/− signs and the next move follow the game;
//  - both call sites in js/app.js (week advance and the four-week advance) show it;
//  - rendering reads state only.
// Registered in tests/test-execution-registry.json (iPhone Acceptance Playthrough job).
//
// Some states are made by writing engine state (reports, cash) or by replacing finance.cashBridge inside the
// throw-away test page. That is inspection setup for this test only; no v3 module does it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const playwright = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const REPORT_MODULE = /\/js\/ui3-weekly-report\.js(?:\?.*)?$/;
// Other real screen modules (js/ui3-<screen>.js) stay out of the page, so this test always sees the same frame.
const OTHER_SCREEN_MODULE = /\/js\/ui3-(?!shell\.js|weekly-report\.js)[^/?]+\.js(?:\?.*)?$/;
const MUTED = 'rgb(163, 179, 207)';   // --u-muted
const MIME = { '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg' };

// --- static contracts ---------------------------------------------------
const source = fs.readFileSync(path.join(ROOT, 'js', 'ui3-weekly-report.js'), 'utf8');
assert.doesNotMatch(source, /Math\.random|MutationObserver|registerUIEnhancer/, 'the v3 report uses no RNG, observer or D UI enhancer');
assert.doesNotMatch(source, /\b(?:g|engine\.g)\.[A-Za-z_$][\w$]*\s*(?:=(?!=)|\+=|-=|\+\+|--)/, 'the v3 report never assigns engine state');
assert.doesNotMatch(source, /\.save\(|setItem\(|localStorage|confirm\(/, 'the v3 report never saves, stores or uses confirm()');
assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b|font-size|:\s*\d+px/, 'the v3 report writes no colour or font size (tokens live in ui3.css)');
const css = fs.readFileSync(path.join(ROOT, 'css', 'ui3-weekly-report.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|font-size|font\s*:/, 'the report CSS writes no literal colour or font size');
for (const value of css.match(/(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-color)?)\s*:\s*[^;}]+/g) || []) assert.match(value, /var\(--u-/, `colours come from tokens: ${value.trim()}`);
const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
assert.ok(index.indexOf('./js/ui3-shell.js') > 0 && index.indexOf('./js/ui3-weekly-report.js') > index.indexOf('./js/ui3-shell.js')
  && index.indexOf('./js/ui3-weekly-report.js') < index.indexOf('./js/app.js'), 'index.html loads ui3-weekly-report.js after the shell and before app.js');
assert.ok(index.indexOf('./css/ui3-weekly-report.css') > index.indexOf('./css/ui3.css'), 'index.html loads the report CSS after ui3.css');

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

async function found(page, url) {
  await page.goto(url, { waitUntil: 'load' });
  await page.locator('#setup-form').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#setup-form').evaluate(form => form.requestSubmit());
  await page.waitForFunction(() => !document.getElementById('setup-form'), null, { timeout: 30000 });
  await page.waitForTimeout(3500);   // founding toast
}
const evalIn = (page, fn, arg) => page.evaluate(fn, arg);
const advance = page => evalIn(page, () => { globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().advanceWeek(true); });
const closeAll = page => evalIn(page, () => { document.getElementById('modal-root').innerHTML = ''; });
const goTo = (page, tab) => evalIn(page, id => document.querySelector(`[data-action="tab"][data-tab="${id}"]`).click(), tab);
const engineState = page => evalIn(page, () => {
  const g = globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g;
  const copy = JSON.parse(JSON.stringify(g)); delete copy.lastSaveDate; delete copy.saveSequence;
  const text = JSON.stringify(copy); let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return { week: g.week, tab: g.selectedTab, digest: `${text.length}:${hash >>> 0}`, rng: JSON.stringify(g.simulationRng) };
});
const sheetText = (page, selector) => page.locator(selector).innerText().then(text => text.replace(/\s+/g, ' ').trim());
const controls = page => evalIn(page, () => [...document.querySelectorAll('#modal-root [data-action]')].map(node => [node.dataset.action, node.dataset.tab || '', node.innerText.replace(/\s+/g, ' ').trim().slice(0, 40), node.tagName.toLowerCase()]));

// Renders the report for a crafted state through the same call js/app.js makes, and puts it in #modal-root.
const showCrafted = (page, { reports, cashChange, news, cash }) => evalIn(page, ({ reports, cashChange, news, cash }) => {
  const m = globalThis.__capitalismTycoonModules, engine = m.playerEngineBridge.getEngine(), g = engine.g;
  g.reports = reports;
  if (cash !== undefined) g.companyCash = cash;
  m.finance.cashBridge = () => ({ netCashChange: cashChange });
  document.getElementById('modal-root').innerHTML = m.ui3.renderSheet('weekly-report', { engine, engineModule: m.engine, summary: { week: reports[0].week, newNews: news || [] } });
}, { reports, cashChange, news, cash });
const hero = page => page.locator('#modal-root .u-stat.hero').evaluate(node => ({ value: node.querySelector('b').innerText.trim(), valueClass: node.querySelector('b').className,
  delta: node.querySelector('.u-delta').innerText.trim(), deltaClass: node.querySelector('.u-delta').className }));

async function main() {
  const browserName = process.env.UI3_TEST_BROWSER || 'webkit';
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await playwright[browserName].launch(browserName === 'chromium' && process.env.UI3_TEST_CHROME
    ? { executablePath: process.env.UI3_TEST_CHROME, args: ['--no-sandbox'] } : {});
  const device = playwright.devices['iPhone 13'];
  const newPage = async ({ withoutReport = false } = {}) => {
    const context = await browser.newContext({ viewport: device.viewport, userAgent: device.userAgent, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ja-JP' });
    await context.route(OTHER_SCREEN_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded from the UI v3 weekly report test */' }));
    if (withoutReport) await context.route(REPORT_MODULE, route => route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: '/* excluded: control page without the v3 report */' }));
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(String(error.message)));
    return { context, page, pageErrors };
  };
  try {
    // 1. Flag off: the current weekly modal, with the same controls with and without the v3 report module.
    const currentModal = async options => {
      const { context, page, pageErrors } = await newPage(options);
      await found(page, base);
      await advance(page);
      await page.waitForTimeout(800);
      const result = await evalIn(page, () => {
        const modules = globalThis.__capitalismTycoonModules;
        return { registered: modules.ui3.registeredSheets(), enabled: modules.ui3.enabled(), summaryModal: Boolean(document.querySelector('#modal-root .summary-modal')),
          sheet: Boolean(document.querySelector('#modal-root .u-sheet')),
          // consecutive repeats are merged: the number of news lines depends on the week's random events
          sections: [...document.querySelectorAll('#modal-root .summary-modal > *')].map(node => (node.className || node.tagName).toString()).filter((name, index, list) => name !== list[index - 1]),
          buttons: [...document.querySelectorAll('#modal-root button')].map(node => node.innerText.trim()) };
      });
      result.controls = await controls(page);
      assert.deepEqual(pageErrors, []);
      await context.close();
      return result;
    };
    const withReport = await currentModal();
    const withoutReport = await currentModal({ withoutReport: true });
    assert.deepEqual([withReport.registered, withoutReport.registered], [['weekly-report'], []], 'the real sheet module registers only when its script loads');
    assert.deepEqual([withReport.enabled, withReport.summaryModal, withReport.sheet], [false, true, false], 'without ?ui=3 the current weekly modal is shown');
    assert.deepEqual(withReport.controls, [['close-modal', '', withReport.controls[0][2], 'div'], ['close-modal', '', '閉じる', 'button'], ['tab', 'home', '次の優先タスクを見る', 'button']], 'the current modal keeps its three controls');
    assert.deepEqual([withReport.sections, withReport.buttons, withReport.controls.map(row => row.slice(0, 2))], [withoutReport.sections, withoutReport.buttons, withoutReport.controls.map(row => row.slice(0, 2))],
      'without ?ui=3 the weekly modal is identical with and without the v3 report script');

    // 2. Flag on, over a screen the current UI renders.
    const { context, page, pageErrors } = await newPage();
    await found(page, `${base}?ui=3`);
    assert.deepEqual(await evalIn(page, () => globalThis.__capitalismTycoonModules.ui3.registeredSheets()), ['weekly-report']);
    const before = await engineState(page);
    await advance(page);
    await page.waitForTimeout(800);
    assert.deepEqual(await evalIn(page, () => ({ sheet: Boolean(document.querySelector('#modal-root .ui3 .u-sheet')), summaryModal: Boolean(document.querySelector('#modal-root .summary-modal')), backdrop: Boolean(document.querySelector('#modal-root .modal-backdrop')) })),
      { sheet: true, summaryModal: false, backdrop: false }, 'with ?ui=3 the v3 sheet replaces the current weekly modal');
    assert.equal(await sheetText(page, '#modal-root .u-sheet-head .u-h2'), '第2週の結果', 'eyebrow: the week of the result');
    const title = await sheetText(page, '#modal-root .u-sheet-head h1');
    assert.ok(['黒字でした', '黒字が続いています', '黒字でしたが、現金は減りました', '赤字でした', '赤字が続いています', '赤字で、現金も減りました', '収支はゼロでした', '利益は出ず、現金は減りました'].includes(title), `a one-sentence result: ${title}`);
    assert.deepEqual(await page.locator('#modal-root .u-sheet-body > *').evaluateAll(nodes => nodes.map(node => node.tagName + (node.className ? '.' + node.className.split(/\s+/).join('.') : ''))),
      ['SECTION.u-card', 'DIV.u-h2', 'DIV.u-list', 'DIV.u-h2', 'BUTTON.u-action'], 'README 5.4: number card, events, one next move; nothing else');
    assert.deepEqual(await page.locator('#modal-root [role="heading"]').allInnerTexts(), ['今週の出来事', '次の一手']);
    const card = await sheetText(page, '#modal-root .u-card');
    assert.match(card, /^利益 \S+ 前週比較なし 売上 \S+ 前週比較なし 会社現金 800\.0万円 前週比較なし$|^利益 \S+ 前週比較なし 売上 \S+ 前週比較なし 会社現金 \S+ 前週比較なし$/, 'profit (large), sales and company cash, each with its week-over-week note');
    const summary = await evalIn(page, () => globalThis.__capitalismTycoonModules.playerEngineBridge.getEngine().g.lastWeeklySummary.newNews);
    const events = await page.locator('#modal-root .u-list .u-row b').allInnerTexts();
    assert.deepEqual(events, summary.slice(0, 2).map(text => text.replace(/^第\d+週[：:]\s*/, '')), 'this week\'s events: the first two news lines, without the week prefix');
    assert.ok(events.length <= 2);
    const next = await page.locator('#modal-root .u-action').evaluateAll(nodes => nodes.map(node => ({ count: nodes.length, action: node.dataset.action, tab: node.dataset.tab, warn: node.classList.contains('warn'), title: node.querySelector('b').innerText.trim(), tag: node.tagName })));
    assert.equal(next.length, 1, 'exactly one next move');
    assert.deepEqual([next[0].action, next[0].warn, next[0].tag], ['tab', false, 'BUTTON'], 'the next move closes the sheet through the existing tab action');
    assert.match(next[0].title, /^創業ガイド \d+\/10：/, 'at founding the next move is the founding guide\'s current step');
    assert.deepEqual(await page.locator('#modal-root .u-sheet-foot button').evaluateAll(nodes => nodes.map(node => [node.innerText.trim(), node.dataset.action, node.dataset.tab || '', node.classList.contains('primary')])),
      [['詳しい決算', 'tab', 'report', false], ['閉じる', 'close-modal', '', true]], 'foot: 詳しい決算 (to report) and 閉じる (the one primary button)');

    // Acceptance numbers (README 2) and README 5.4 "no scrolling", fully visible above the current UI's bars.
    const metrics = await evalIn(page, () => {
      const root = document.getElementById('modal-root'), sheet = root.querySelector('.u-sheet'), body = root.querySelector('.u-sheet-body');
      const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
      const buttons = [...root.querySelectorAll('button')].filter(visible);
      const small = buttons.filter(element => { const box = element.getBoundingClientRect(); return box.width < 44 || box.height < 44; }).map(element => element.className);
      const covered = [...root.querySelectorAll('button, .u-stat, .u-row, [role="heading"]')].filter(element => {
        const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return !hit || !element.contains(hit) && !hit.closest('.u-sheet') && !hit.closest('.toast');   // the transient toast also sits above the current modal
      }).map(element => element.className || element.tagName);
      let minFont = 99; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) { const node = walker.currentNode; if (node.nodeValue.trim() && visible(node.parentElement)) minFont = Math.min(minFont, parseFloat(getComputedStyle(node.parentElement).fontSize)); }
      const muted = [...root.querySelectorAll('[role="heading"], .u-action small')].map(node => getComputedStyle(node).color);
      return { scrolls: body.scrollHeight - body.clientHeight, sheetHeight: sheet.getBoundingClientRect().height, viewport: innerHeight, minFont, small, covered, overflowX: document.documentElement.scrollWidth > innerWidth, muted,
        money: [...root.querySelectorAll('.u-money')].every(node => getComputedStyle(node).whiteSpace === 'nowrap'), primaries: root.querySelectorAll('.u-btn.primary').length };
    });
    assert.ok(metrics.scrolls <= 0, `the sheet body scrolls by ${metrics.scrolls}px`);
    assert.ok(metrics.sheetHeight <= metrics.viewport * 0.92 + 1, `sheet height ${metrics.sheetHeight} of ${metrics.viewport}`);
    assert.ok(metrics.minFont >= 13, `smallest text ${metrics.minFont}px`);
    assert.deepEqual([metrics.small, metrics.covered, metrics.overflowX, metrics.money, metrics.primaries], [[], [], false, true, 1], 'tap targets, nothing covered by the current UI, no overflow, numbers do not wrap, one primary button');
    assert.deepEqual(metrics.muted, metrics.muted.map(() => MUTED), 'labels keep the v3 muted colour although the current UI recolours h2/p/small in #modal-root');

    // Rendering reads state only.
    await closeAll(page);
    const idle = await engineState(page);
    await evalIn(page, () => { const m = globalThis.__capitalismTycoonModules, engine = m.playerEngineBridge.getEngine(); for (let i = 0; i < 3; i += 1) m.ui3.renderSheet('weekly-report', { engine, engineModule: m.engine, summary: engine.g.lastWeeklySummary }); });
    const after = await engineState(page);
    assert.deepEqual([after.week, after.digest, after.rng], [idle.week, idle.digest, idle.rng], 'rendering the sheet never changes the game');
    assert.ok(before.week === 1 && idle.week === 2);

    // 3. Controls close the sheet through the existing actions.
    await advance(page); await page.waitForTimeout(500);
    await page.locator('#modal-root .u-btn.primary').tap();
    assert.equal(await evalIn(page, () => document.getElementById('modal-root').innerHTML), '', '閉じる closes the sheet');
    await advance(page); await page.waitForTimeout(500);
    await page.locator('#modal-root .u-scrim').tap({ position: { x: 20, y: 20 } });
    assert.equal(await evalIn(page, () => document.getElementById('modal-root').innerHTML), '', 'the scrim closes the sheet');
    await advance(page); await page.waitForTimeout(500);
    await page.locator('#modal-root .u-sheet-foot .u-btn:not(.primary)').tap();
    await page.waitForTimeout(500);
    assert.deepEqual([await engineState(page).then(row => row.tab), await evalIn(page, () => document.getElementById('modal-root').innerHTML)], ['report', ''], '詳しい決算 opens the report screen and closes the sheet');
    await goTo(page, 'home');
    await advance(page); await page.waitForTimeout(500);
    const target = await page.locator('#modal-root .u-action').getAttribute('data-tab');
    await page.locator('#modal-root .u-action').tap();
    await page.waitForTimeout(500);
    assert.deepEqual([await engineState(page).then(row => row.tab), await evalIn(page, () => document.getElementById('modal-root').innerHTML)], [target, ''], 'the next move goes to its tab and closes the sheet');
    await goTo(page, 'home');

    // 4. The four-week advance (the second call site in js/app.js) shows the sheet too.
    await closeAll(page);
    const week = await engineState(page).then(row => row.week);
    await evalIn(page, () => document.querySelector('[data-action="advance-4"]').click());
    await page.waitForTimeout(1500);
    assert.equal(await evalIn(page, () => Boolean(document.querySelector('#modal-root .ui3 .u-sheet'))), true, 'advance-4 shows the v3 sheet');
    assert.equal(await sheetText(page, '#modal-root .u-sheet-head .u-h2'), `第${week + 4}週の結果`);
    await closeAll(page);

    // 5. One sentence, signs and colours for crafted weeks.
    const cases = [
      ['黒字が続いています', [{ week: 8, profit: 500000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }], 100000, '+50.0万円', '前週比 +40.0万円'],
      ['黒字でした', [{ week: 8, profit: 500000, sales: 1000000 }], 100000, '+50.0万円', '前週比較なし'],
      ['黒字でした', [{ week: 8, profit: 500000, sales: 1000000 }, { week: 7, profit: -100000, sales: 1000000 }], 0, '+50.0万円', '前週比 +60.0万円'],
      ['黒字でしたが、現金は減りました', [{ week: 8, profit: 500000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }], -1, '+50.0万円', '前週比 +40.0万円'],
      ['赤字でした', [{ week: 8, profit: -300000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }], 5, '−30.0万円', '前週比 −40.0万円'],
      ['赤字が続いています', [{ week: 8, profit: -300000, sales: 1000000 }, { week: 7, profit: -100000, sales: 1000000 }], 5, '−30.0万円', '前週比 −20.0万円'],
      ['赤字で、現金も減りました', [{ week: 8, profit: -300000, sales: 1000000 }, { week: 7, profit: -100000, sales: 1000000 }], -5, '−30.0万円', '前週比 −20.0万円'],
      ['収支はゼロでした', [{ week: 8, profit: 0, sales: 1000000 }, { week: 7, profit: 0, sales: 1000000 }], 0, '0円', '前週比 変化なし'],
      ['利益は出ず、現金は減りました', [{ week: 8, profit: 0, sales: 1000000 }], -1, '0円', '前週比較なし']
    ];
    for (const [sentence, reports, cashChange, value, delta] of cases) {
      await showCrafted(page, { reports, cashChange, news: [] });
      assert.equal(await sheetText(page, '#modal-root .u-sheet-head h1'), sentence, `sentence for ${JSON.stringify(reports.map(row => row.profit))} / cash ${cashChange}`);
      const row = await hero(page);
      assert.deepEqual([row.value, row.delta], [value, delta], `profit and week-over-week text for: ${sentence}`);
      assert.equal(row.value.startsWith('+'), row.valueClass.includes('u-up'), 'the up colour goes with the + sign');
      assert.equal(row.value.startsWith('−'), row.valueClass.includes('u-down'), 'the down colour goes with the − sign');
      assert.equal(delta.startsWith('前週比 +'), row.deltaClass.includes('u-up'));
      assert.equal(delta.startsWith('前週比 −'), row.deltaClass.includes('u-down'));
    }
    // Events: the first two lines without the week prefix; none -> a plain note; three lines -> still two.
    const week8 = [{ week: 8, profit: 1, sales: 1 }];
    await showCrafted(page, { reports: week8, cashChange: 0, news: ['第8週：一つ目の出来事。', '二つ目の出来事。', '第8週：三つ目は出ない。'] });
    assert.deepEqual(await page.locator('#modal-root .u-list .u-row b').allInnerTexts(), ['一つ目の出来事。', '二つ目の出来事。']);
    await showCrafted(page, { reports: week8, cashChange: 0, news: [] });
    assert.deepEqual([await page.locator('#modal-root .u-list').count(), await sheetText(page, '#modal-root .u-sheet-body > div.u-h2:not([role])')], [0, '今週の新しい出来事はありません。']);
    // Long text still fits in one screen (two-line headlines, one-line note).
    const longLine = '観光カフェOSがSeries A資金調達を完了しました。さらに全国展開に向けて新しい出資者を迎え入れる予定です。';
    await showCrafted(page, { reports: [{ week: 8, profit: 500000, sales: 1000000 }, { week: 7, profit: 100000, sales: 1000000 }], cashChange: -1, news: [longLine, longLine], cash: 1000000 });
    const longBody = await evalIn(page, () => { const body = document.querySelector('#modal-root .u-sheet-body'); return body.scrollHeight - body.clientHeight; });
    assert.ok(longBody <= 0, `long headlines scroll by ${longBody}px`);
    // A critical secretary task (cash below two weeks of fixed cost) comes first and is warned.
    const warned = await page.locator('#modal-root .u-action').evaluate(node => ({ warn: node.classList.contains('warn'), action: node.dataset.action, tab: node.dataset.tab, glyph: node.querySelector('i').innerText }));
    assert.deepEqual(warned, { warn: true, action: 'tab', tab: 'bank', glyph: '⚠' }, 'a critical task is the next move, with the warn style');
    await closeAll(page);

    // 6. Over a v3 frame: the same sheet, the dock gives way, the frame bars stay below it.
    await evalIn(page, () => {
      const ui3 = globalThis.__capitalismTycoonModules.ui3;
      if (!ui3.registeredScreens().includes('home')) ui3.registerScreen('home', { render: ({ esc, g }) => `<section class="u-card"><div class="u-stat"><span>probe</span><b>${esc(g.companyName)}</b></div></section>` });
    });
    await evalIn(page, () => { const m = globalThis.__capitalismTycoonModules, engine = m.playerEngineBridge.getEngine(); engine.g.companyCash = 8000000; engine.g.reports = []; });
    await goTo(page, 'home');
    assert.equal(await evalIn(page, () => Boolean(document.querySelector('#app > .ui3.u-app'))), true, 'a v3 frame is on screen');
    await advance(page); await page.waitForTimeout(800);
    assert.equal(await page.locator('.ui3 .u-dock').evaluate(node => getComputedStyle(node).display), 'none', 'the advance dock gives way to the sheet');
    const overFrame = await evalIn(page, () => {
      const root = document.getElementById('modal-root'), sheet = root.querySelector('.u-sheet'), body = root.querySelector('.u-sheet-body');
      const covered = [...root.querySelectorAll('button, .u-stat, .u-row')].filter(element => { const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2); return !hit || !hit.closest('.u-sheet') && !hit.closest('.toast'); }).map(element => { const box = element.getBoundingClientRect(); return `${element.className}@${Math.round(box.top)}-${Math.round(box.bottom)}`; });
      return { scrolls: body.scrollHeight - body.clientHeight, bottom: Math.round(sheet.getBoundingClientRect().bottom), viewport: innerHeight, covered };
    });
    assert.deepEqual([overFrame.scrolls <= 0, overFrame.bottom, overFrame.covered], [true, device.viewport.height, []], 'over a v3 frame the sheet is anchored to the bottom edge, fully visible, without scrolling');
    await page.locator('#modal-root .u-btn.primary').tap();
    assert.notEqual(await page.locator('.ui3 .u-dock').evaluate(node => getComputedStyle(node).display), 'none');

    // ?ui=2 returns the device to the current UI, and the current weekly modal is back.
    await page.goto(`${base}?ui=2`, { waitUntil: 'load' });
    await page.locator('.topbar').waitFor({ state: 'attached', timeout: 30000 });
    await advance(page); await page.waitForTimeout(800);
    assert.deepEqual(await evalIn(page, () => [globalThis.__capitalismTycoonModules.ui3.enabled(), Boolean(document.querySelector('#modal-root .summary-modal')), Boolean(document.querySelector('#modal-root .u-sheet'))]), [false, true, false]);
    assert.deepEqual(pageErrors, []);
    await context.close();
    console.log(`ui3-weekly-report-webkit-test: PASS (${browserName})`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
