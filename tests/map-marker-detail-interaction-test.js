'use strict';
/*
 * Marker tap -> entity detail contract.
 *
 * Reported on a real iPhone: tapping a 売物件 / テナント募集 / オフィス募集
 * placard did not open a detail screen. Two independent causes were found by
 * reading the code:
 *
 *   1. buildMapViewModel() attached the raw state object for `store` and
 *      `property` but NOT for `tenant` or `rentalOffice`, so selectedDetail()
 *      had no rent, deposit, capacity or grade to render. The office card was
 *      a name plus a "go to the office screen" link, and the tenant card read
 *      a legacy `entity.item` DOM-scrape field that buildMapViewModel has
 *      never set, so it always degraded to the entity name.
 *   2. Below 1180px css/d-ui-reference-fidelity.css drops .d-context-panel out
 *      of its sticky desktop column, so the panel renders after the map stage
 *      and the three overlay cards -- about a screen further down on an
 *      iPhone. Selection updated the panel correctly, but nothing visible
 *      moved, so the tap read as "nothing happened".
 *
 * buildMapViewModel runs for real in a vm sandbox. selectedDetail() cannot run
 * standalone (js/d-ui-shell.js is DOM-dependent), so its source is extracted
 * and executed with the same tiny helper set it closes over -- that makes
 * "tapping THIS marker renders THAT entity's detail" an executable assertion
 * rather than a regex guess.
 *
 * Run directly: node tests/map-marker-detail-interaction-test.js
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const shellSrc = read('js/d-ui-shell.js');
const canvasSrc = read('js/map-phase2-canvas.js');
const mapCss = read('css/d-ui-map.css');
const fidelityCss = read('css/d-ui-reference-fidelity.css');
const appSrc = read('js/app.js');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS:', name); pass += 1; }
  catch (error) { console.log('FAIL:', name, '--', error.message); fail += 1; }
}

function extractFunction(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `could not locate function ${name}`);
  const braceStart = src.indexOf('{', start);
  let depth = 0, index = braceStart;
  for (; index < src.length; index += 1) {
    if (src[index] === '{') depth += 1;
    else if (src[index] === '}') { depth -= 1; if (depth === 0) break; }
  }
  return src.slice(start, index + 1);
}

/* ---------- the real buildMapViewModel, in a sandbox ---------- */
function buildViewModel(g, engineStub) {
  const sandbox = {
    console, Promise, Object, Array, Math, JSON, Date, Number, String, Map, Set,
    URLSearchParams, setTimeout, clearTimeout,
    location: { search: '' }, devicePixelRatio: 1,
    fetch: () => new Promise(() => {}),
    document: { head: { appendChild() {} }, createElement() { return { set src(v) {} }; } },
    requestAnimationFrame: cb => { cb(); return 1; },
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  vm.createContext(sandbox);
  sandbox.__capitalismTycoonModules = {};
  vm.runInContext(canvasSrc, sandbox, { filename: 'map-phase2-canvas.js' });
  return sandbox.__capitalismTycoonModules.mapPhase2Canvas.buildMapViewModel(g, engineStub);
}

/* ---------- the real selectedDetail, with its own helper closure ---------- */
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const finite = value => (Number.isFinite(Number(value)) ? Number(value) : 0);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const money = value => `¥${Math.round(finite(value)).toLocaleString('ja-JP')}`;

const ENGINE_STUB = {
  pref: id => ({ tokyo: { id: 'tokyo', name: '東京都' }, osaka: { id: 'osaka', name: '大阪府' } }[id] || null),
  business: id => ({ ramen: { name: 'ラーメン店', quality: 70, brand: 62, efficiency: 72 } }[id] || null),
};
const selectedDetail = new Function(
  'esc', 'money', 'finite', 'clamp', 'engine', 'storeStatusLabel',
  `${extractFunction(shellSrc, 'selectedDetail')}; return selectedDetail;`
)(esc, money, finite, clamp, () => ENGINE_STUB, () => '営業中');

/* ---------- fixtures shaped exactly like js/engine.js's factories ---------- */
const TENANT = {
  id: 't-1', prefID: 'tokyo', cityName: '東京都中央', name: '東京都 駅前1階テナント',
  businessID: 'ramen', rent: 184000, deposit: 1472000, traffic: 1.3924, size: 'S',
  occupiedBy: null, expiresWeek: 25,
};
const OFFICE = {
  id: 'o-1', prefID: 'tokyo', cityName: '東京都中央', name: '東京都 ビジネスセンター',
  grade: 'B', rent: 499200, deposit: 4992000, capacity: 120, prestige: 16, dxBonus: 0.05,
  contracted: false, stableKey: 'office_tokyo_B',
};
const PROPERTY = {
  id: 'p-1', prefID: 'tokyo', name: '東京都 駅前商業ビル', kind: '商業ビル',
  price: 822500000, value: 822500000, rentIncome: 791000, owner: null,
  cityName: '東京都中央', yieldRate: 0.05, landAreaSqm: 220, buildingType: '商業ビル',
};
const STORE = {
  id: 's-1', businessID: 'ramen', prefID: 'tokyo', name: '一号店', status: 'open',
  lastSales: 1250000, lastProfit: 320000, condition: 100,
  marketResult: { unitsSold: 840, customerSatisfaction: 4.2 },
};
const GAME = {
  selectedPref: 'tokyo', stores: [STORE], tenants: [TENANT],
  rentalOffices: [OFFICE], properties: [PROPERTY],
};

const viewModel = buildViewModel(GAME, ENGINE_STUB);
const byKind = kind => viewModel.entities.find(entity => entity.kind === kind);

/* ===================== VIEW MODEL CARRIES REAL STATE ===================== */

check('buildMapViewModel attaches the raw state object for all four kinds, so a tapped marker can show more than its own name', () => {
  assert.equal(byKind('store').store, STORE);
  assert.equal(byKind('tenant').tenant, TENANT, 'tenant state must reach selectedDetail()');
  assert.equal(byKind('office').office, OFFICE, 'rentalOffice state must reach selectedDetail()');
  assert.equal(byKind('realestate').property, PROPERTY);
});

check('the documented entity shape is unchanged (additive only) and ids stay kind+sourceId', () => {
  for (const entity of viewModel.entities) {
    assert.ok(entity.id && entity.kind && entity.sourceId, 'id/kind/sourceId must survive');
    assert.equal(entity.id, `${entity.kind}:${entity.sourceId}`);
    assert.equal(entity.rawID, entity.sourceId, 'rawID is what detail actions pass back to the engine');
  }
});

check('the dead entity.item DOM-scrape fallback is gone -- it was never set by buildMapViewModel, so it always degraded to the name', () => {
  assert.ok(!/entity\.item/.test(shellSrc), 'selectedDetail must not read a field the view model never produces');
});

/* ===================== EACH MARKER OPENS ITS OWN DETAIL ===================== */

check('realestate marker -> property detail: price, prefecture, kind, area, yield, ownership, and both purchase actions', () => {
  const html = selectedDetail(byKind('realestate'), GAME);
  assert.match(html, /売物件/);
  assert.ok(html.includes(esc(PROPERTY.name)), 'the property name must be shown');
  assert.ok(html.includes(money(PROPERTY.price)), '売出価格 must come from state');
  assert.ok(html.includes(money(PROPERTY.rentIncome)), '週次賃料 must come from state');
  assert.match(html, /東京都/);
  assert.match(html, /商業ビル/);
  assert.match(html, /220㎡/);
  assert.match(html, /利回り5\.0%/);
  assert.match(html, /売出中/, 'ownership state must be shown');
  assert.match(html, /data-action="buy-property-company" data-id="p-1"/);
  assert.match(html, /data-action="buy-property-personal" data-id="p-1"/);
});

check('tenant marker -> tenant detail: weekly rent, deposit, prefecture, trade area, size, traffic, business, and the existing 出店 action', () => {
  const html = selectedDetail(byKind('tenant'), GAME);
  assert.match(html, /テナント募集/);
  assert.ok(html.includes(esc(TENANT.name)));
  assert.ok(html.includes(money(TENANT.rent)), '賃料 must come from state');
  assert.ok(html.includes(money(TENANT.deposit)), '初期費用 must come from state');
  assert.match(html, /東京都中央/, 'trade area must come from state');
  assert.match(html, /1\.39/, 'traffic/立地係数 must come from state');
  assert.match(html, /ラーメン店/, 'the intended business must come from state');
  assert.match(html, /契約可能/);
  assert.match(html, /data-action="open-store" data-id="t-1"/, 'must reuse the existing tenant action, not a new leasing path');
});

check('office marker -> office detail: weekly rent, deposit, capacity, grade, prestige, and the existing contract-office action', () => {
  const html = selectedDetail(byKind('office'), GAME);
  assert.match(html, /オフィス募集/);
  assert.ok(html.includes(esc(OFFICE.name)));
  assert.ok(html.includes(money(OFFICE.rent)), '賃料 must come from state');
  assert.ok(html.includes(money(OFFICE.deposit)), '保証金 must come from state');
  assert.match(html, /120人/, 'capacity must come from state');
  assert.match(html, /グレード/);
  assert.match(html, /data-action="contract-office" data-id="o-1"/, 'must reuse the engine action js/app.js already routes');
  assert.ok(appSrc.includes("case 'contract-office'"), 'sanity: that action must already exist in production');
});

check('store marker -> store detail keeps its existing path (sales, profit, customers, satisfaction)', () => {
  const html = selectedDetail(byKind('store'), GAME);
  assert.ok(html.includes(money(STORE.lastSales)));
  assert.ok(html.includes(money(STORE.lastProfit)));
  assert.match(html, /840人/);
  assert.match(html, /4\.2/);
});

check('rent is labelled 週額, matching what js/engine.js actually stores (office.rent becomes g.officeWeeklyCost)', () => {
  // Labelling a weekly figure as monthly would be fabricating a number the
  // state does not hold.
  assert.match(selectedDetail(byKind('office'), GAME), /週額賃料/);
  assert.match(selectedDetail(byKind('tenant'), GAME), /週額賃料/);
  assert.match(read('js/engine.js'), /officeWeeklyCost=office\.rent/);
});

check('no detail fabricates a field the state does not have', () => {
  const html = selectedDetail(byKind('realestate'), GAME);
  // This fixture has no property.realEstate, so there is no condition to show.
  assert.ok(!/建物状態/.test(html), 'condition must be omitted when the state has none');
  const withCondition = selectedDetail(
    { ...byKind('realestate'), property: { ...PROPERTY, realEstate: { condition: 0.82 } } }, GAME
  );
  assert.match(withCondition, /建物状態/, 'and shown when it genuinely exists');
  assert.match(withCondition, /82%/);
});

/* ===================== IDENTITY ===================== */

check('the detail always belongs to the tapped entity: two properties never render each other', () => {
  const second = { ...PROPERTY, id: 'p-2', name: '東京都 都心オフィスタワー', kind: 'オフィス', price: 1_000_000_000 };
  const model = buildViewModel({ ...GAME, properties: [PROPERTY, second] }, ENGINE_STUB);
  const first = model.entities.find(entity => entity.sourceId === 'p-1');
  const other = model.entities.find(entity => entity.sourceId === 'p-2');
  const firstHtml = selectedDetail(first, GAME);
  const otherHtml = selectedDetail(other, GAME);
  assert.ok(firstHtml.includes('data-id="p-1"') && !firstHtml.includes('data-id="p-2"'));
  assert.ok(otherHtml.includes('data-id="p-2"') && !otherHtml.includes('data-id="p-1"'));
  assert.ok(firstHtml.includes(esc(PROPERTY.name)) && !firstHtml.includes(esc(second.name)));
  assert.ok(otherHtml.includes(esc(second.name)));
  assert.notEqual(firstHtml, otherHtml);
});

check('kind + sourceId is a stable unique identity across every entity on the map', () => {
  const ids = viewModel.entities.map(entity => entity.id);
  assert.equal(new Set(ids).size, ids.length, 'marker ids must be unique or a tap could resolve to the wrong entity');
});

/* ===================== SELECTION WIRING ===================== */

check('marker tap routes through the existing single selection path: data-d-ui-marker -> selectedEntity -> selectedDetail', () => {
  assert.match(shellSrc, /selectedEntity=marker\.dataset\.dUiMarker/, 'tap must set the one existing selection variable');
  assert.match(shellSrc, /selectedDetail\(chosen,g\)/, 'the panel must render from that same selection');
  for (const forbidden of ['phase2SelectedEntity', 'selectedProperty2']) {
    assert.ok(!shellSrc.includes(forbidden), `${forbidden} would be a parallel selection state`);
  }
  assert.equal((shellSrc.match(/let selectedEntity/g) || []).length, 1, 'exactly one selection variable may exist');
});

check('tap vs pan (PR C contract) is unchanged: a pan-ending click is still suppressed before selection', () => {
  assert.match(shellSrc, /consumeJustPanned\?\.\(\)\)return true;selectedEntity=/, 'the pan guard must still run BEFORE selection, so a drag never opens a detail');
  assert.match(canvasSrc, /PAN_THRESHOLD=8/, 'the 8px tap/pan threshold must stay 8px');
});

/* ===================== MOBILE VISIBILITY ===================== */

check('after a marker tap the detail panel is brought into view on the stacked (narrow) layout', () => {
  assert.match(shellSrc, /runUIEnhancers\(\);revealContextPanel\(\)/, 'the reveal must run after the re-render, so it targets the new panel');
  const body = extractFunction(shellSrc, 'revealContextPanel');
  assert.match(body, /scrollIntoView/);
  assert.match(body, /1180/, 'the threshold must match the CSS breakpoint where the panel stops being a side column');
  assert.match(body, /prefers-reduced-motion/, 'motion preference must be respected');
});

check('the stacked layout really does push the panel below the fold -- the reason the reveal is needed', () => {
  assert.match(fidelityCss, /@media\(max-width:1180px\)\{[\s\S]*?\.d-context-panel\{position:static;grid-column:1\/-1/, 'sanity: below 1180px the panel leaves its sticky side column');
  assert.match(fidelityCss, /\.d-map-stage\{min-height:520px\}/, 'sanity: the map stage alone is taller than an iPhone viewport');
  const markup = shellSrc.slice(shellSrc.indexOf('workspace.innerHTML='));
  assert.ok(
    markup.indexOf('d-map-stage') < markup.indexOf('d-context-panel'),
    'sanity: the panel is rendered after the stage, so it starts off-screen on a phone'
  );
});

check('revealContextPanel degrades safely when there is no panel, no viewport, or no scrollIntoView', () => {
  const reveal = new Function('document', 'globalThis', `${extractFunction(shellSrc, 'revealContextPanel')}; return revealContextPanel;`);
  assert.doesNotThrow(() => reveal({ querySelector: () => null }, { innerWidth: 390, innerHeight: 844 })());
  assert.doesNotThrow(() => reveal({ querySelector: () => ({}) }, { innerWidth: 390, innerHeight: 844 })());
});

check('the detail panel keeps 44px tap targets for its actions', () => {
  assert.match(mapCss, /\.d-context-panel \.button-row \.btn\{[^}]*min-height:44px/);
});

check('every d- class the new detail markup emits is defined in a d-ui-*.css file (typo guard)', () => {
  const detail = extractFunction(shellSrc, 'selectedDetail');
  const classes = new Set();
  for (const match of detail.matchAll(/class="([^"$]*)"/g)) {
    for (const name of match[1].split(/\s+/)) if (name.startsWith('d-')) classes.add(name);
  }
  assert.ok(classes.has('d-context-name'), 'sanity: the new element must be present');
  const allCss = fs.readdirSync(path.join(ROOT, 'css'))
    .filter(name => name.startsWith('d-ui') && name.endsWith('.css'))
    .map(name => read(`css/${name}`)).join('\n');
  for (const name of classes) assert.ok(allCss.includes(`.${name}`), `.${name} is used but never defined in any d-ui-*.css`);
});

/* ===================== CHROME COEXISTENCE (PR #616) ===================== */

check('the iPhone chrome controls and markers still stay out of each other\'s way (PR #616 must not regress)', () => {
  assert.match(canvasSrc, /function chromeExclusionRects\(canvas\)/, 'markers must still route around the chrome controls');
  assert.match(canvasSrc, /chromeExclusionRects\(canvas\)/);
  assert.match(read('js/iphone-playtest-fixes.js'), /modules\.mapPhase2Canvas\.render\(canvas,g\)/, 'chrome creation must still re-trigger marker positioning');
  assert.match(read('css/d-ui-map-phase2-markers.css'), /\.d-map-marker\{z-index:25\}/, 'markers must still out-rank the surface');
});

check('placard labels stay unconditionally visible (PR #615 must not regress)', () => {
  assert.match(read('css/d-ui-map-phase2-markers.css'), /\.d-map-marker small\{display:block;opacity:1/);
  assert.match(shellSrc, /function placardLabel\(entity\)/);
  for (const label of ['テナント募集', 'オフィス募集', '売物件']) {
    assert.ok(shellSrc.includes(label), `${label} must still be a placard label`);
  }
});

check('determinism and asset separation are untouched: no RNG, no save writes in the changed view-model code', () => {
  const body = extractFunction(canvasSrc, 'buildMapViewModel');
  assert.doesNotMatch(body, /Math\s*\.\s*random/);
  assert.doesNotMatch(body, /localStorage|SAVE_KEY|saveVersion/);
  assert.doesNotMatch(body, /companyCash|personalCash/, 'the view model must not touch either cash pool');
});

/* ===================== NEGATIVE TESTS ===================== */

check('NEGATIVE 3: a detail panel that only flips selected state without rendering the entity is rejected', () => {
  // The pre-fix office branch was exactly this: a generic card plus a link to
  // another screen, carrying none of the tapped entity's own data.
  const stubbed = '<div class="d-context-hero"><div class="d-store-visual office"></div></div><button data-action="tab" data-tab="office">本社・組織画面へ</button>';
  assert.ok(!stubbed.includes(OFFICE.name) && !stubbed.includes(String(OFFICE.capacity)),
    'sanity: the old shape carries no entity data');
  const real = selectedDetail(byKind('office'), GAME);
  assert.ok(real.includes(esc(OFFICE.name)) && real.includes('120人'),
    'the real panel must carry the tapped entity\'s own data, which the stub does not');
});

check('NEGATIVE 4: rendering a different sourceId than the one tapped is detectable', () => {
  const tapped = byKind('realestate');
  const wrong = selectedDetail({ ...tapped, rawID: 'p-999', property: { ...PROPERTY, name: '別の物件' } }, GAME);
  assert.ok(wrong.includes('data-id="p-999"') && !wrong.includes('data-id="p-1"'),
    'sanity: a mismatched entity really does produce a mismatched panel');
  const correct = selectedDetail(tapped, GAME);
  assert.ok(correct.includes(`data-id="${tapped.rawID}"`), 'the real panel must carry the tapped entity id');
});

check('NEGATIVE 5: dropping the reveal call would leave the iPhone tap looking unresponsive', () => {
  const withoutReveal = shellSrc.replace(/runUIEnhancers\(\);revealContextPanel\(\)/, 'runUIEnhancers()');
  assert.notEqual(withoutReveal, shellSrc, 'sanity: the mutation must actually remove the call');
  assert.ok(!/runUIEnhancers\(\);revealContextPanel\(\)/.test(withoutReveal),
    'the mutated source no longer brings the panel into view, which is the exact real-device symptom');
});

check('NEGATIVE 6: reverting the tenant/office state refs would strip their details back to a bare name', () => {
  const model = buildViewModel(GAME, ENGINE_STUB);
  const officeEntity = model.entities.find(entity => entity.kind === 'office');
  const stripped = { ...officeEntity };
  delete stripped.office;
  const html = selectedDetail(stripped, GAME);
  assert.ok(!html.includes('120人'), 'without the state ref the capacity cannot be rendered');
  assert.ok(selectedDetail(officeEntity, GAME).includes('120人'), 'sanity: with it, it can');
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
