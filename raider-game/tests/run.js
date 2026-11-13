#!/usr/bin/env node
// Atlas Capital regression tests (independent of the Capitalism Tycoon Web test suite).
// Usage: node raider-game/tests/run.js [--quick] [--update-baseline] [--make-fixture]
// Needs Playwright with Chromium (preinstalled in the Claude Code cloud environment).
'use strict';
const path = require('path');
const fs = require('fs');
const {chromium, devices} = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const URL = 'file://' + path.join(ROOT, 'index.html');
const FIX = path.join(__dirname, 'fixtures');
const BASELINE = path.join(__dirname, 'baseline.json');
const args = new Set(process.argv.slice(2));
const QUICK = args.has('--quick');

let failures = 0;
const ok = (name, cond, detail) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); if (!cond) failures++; };

// Runs inside the page: checks the game state for broken numbers and broken ownership.
const INVARIANTS = () => {
  const S = window.__atlas.S, bad = [];
  const fin = (v, w) => { if (!Number.isFinite(v)) bad.push(w); };
  for (const c of S.cos) {
    for (const k of ['price', 'cash', 'debt', 'shares', 'rev', 'assets', 'margin']) fin(c[k], `${c.id}.${k}`);
    if (c.cash < -1e-6) bad.push(`${c.id} negative cash`);
    if (!(c.shares > 0)) bad.push(`${c.id} shares<=0`);
    let held = 0; for (const k in c.own) { if (!(c.own[k] >= 0)) bad.push(`${c.id} own ${k}<0`); held += c.own[k]; }
    if (held > c.shares * (1 + 1e-6)) bad.push(`${c.id} over-held`);
    const t = {}; for (const k in c.own) { const b = k[0] === 'C' ? (S.cos.find(x => x.id === k) || {}).ctrl : /^F\d+$/.test(k) ? 'P' : k; if (b) t[b] = (t[b] || 0) + c.own[k]; }
    let nc = null; for (const b in t) if (t[b] > c.shares * .5) nc = b;
    if ((nc || null) !== (c.ctrl || null)) bad.push(`${c.id} ctrl mismatch`);
  }
  fin(S.player.cash, 'player.cash'); fin(S.player.loan, 'player.loan');
  if (S.player.loan < -1e-9) bad.push('player loan<0');
  for (const r of S.rivals) fin(r.cash, r.id + '.cash');
  for (const t of S.tobs) if (!S.cos.some(c => c.id === t.cid)) bad.push('tob on missing company');
  if (S.mk) { // Phase 1 markets
    const by = {}; for (const c of S.cos) { if (!c.mk) { bad.push(`${c.id} no market`); continue; } (by[c.mk] = by[c.mk] || []).push(c); }
    for (const key in by) { const sum = by[key].reduce((a, c) => a + c.sh, 0); if (!(sum <= 1 + 1e-9) || by[key].some(c => !(c.sh >= 0))) bad.push(`market ${key} share sum ${sum}`); if (!S.mk[key]) bad.push(`market ${key} missing`); }
  }
  for (const p of S.props || []) { fin(p.v, p.id + '.v'); fin(p.mort, p.id + '.mort'); if (p.own && p.own !== 'P' && !S.rivals.some(r => r.id === p.own)) bad.push(p.id + ' bad owner'); if (!p.own && p.mort) bad.push(p.id + ' mortgage without owner'); }
  return bad;
};

async function page(browser, opt) {
  const ctx = await browser.newContext(opt || {viewport: {width: 1366, height: 900}});
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  // External resources (web fonts) can fail to load from a local file; that is not a game error.
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|CORS/.test(m.text())) errs.push(m.text()); });
  await p.goto(URL);
  await p.waitForTimeout(300);
  return {p, ctx, errs};
}

async function testDeterminism(b) {
  const {p, ctx} = await page(b);
  const seeds = QUICK ? [7] : [7, 99, 4242];
  for (const sd of seeds) {
    const same = await p.evaluate(sd => {
      const A = window.__atlas, run = () => { A.newGame(sd, 'normal', 'T', 't', 'std'); for (let i = 0; i < 260; i++) { A.step(); A.S.inbox = []; } return JSON.stringify(A.S); };
      return run() === run();
    }, sd);
    ok(`determinism seed ${sd} (5 years, full state)`, same);
  }
  await ctx.close();
}

async function testInvariants(b) {
  const {p, ctx, errs} = await page(b);
  const combos = QUICK ? [['normal', 11]] : [['easy', 11], ['normal', 11], ['normal', 22], ['hard', 22]];
  for (const [d, sd] of combos) {
    const bad = await p.evaluate(([d, sd, inv]) => {
      const check = new Function('return (' + inv + ')()');
      const A = window.__atlas; A.newGame(sd * 7919, d, 'T', 't', 'std'); const found = [];
      for (let w = 0; w < 520; w++) { A.step(); A.S.inbox = []; if (w % 13 === 0) { const x = check(); if (x.length) { found.push(`w${w}: ${x.slice(0, 3).join(', ')}`); break; } } }
      return found;
    }, [d, sd, INVARIANTS.toString()]);
    ok(`invariants ${d} seed ${sd} (10 years)`, !bad.length, bad.join(' | '));
  }
  ok('no page errors during simulation', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// A 3-year game with a broad set of player positions, saved by the version that made it.
async function makeFixture(b) {
  const {p, ctx} = await page(b);
  const json = await p.evaluate(() => {
    const A = window.__atlas; A.newGame(20271104, 'normal', 'フィクスチャ', 'テスト', 'std', true); const S = A.S;
    for (let i = 0; i < 40; i++) { A.step(); S.inbox = []; }
    S.player.cash += 400; S.won = true;
    const cs = S.cos.filter(c => !c.ctrl && c.ind !== 'air' && c.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares);
    const a = cs[0]; A.execBuy('P', a, a.shares * .75); if (a.ctrl !== 'P') A.execBuy('P', a, a.shares * .2); a.cash += 60;
    const t = cs.find(c => c !== a && !c.ctrl); A.execBuy(a.id, t, t.shares * .2);
    A.execBuy('P', cs[3], cs[3].shares * .06);
    a.ps = -1; A.advertise(a, a.rev * .03);
    for (let i = 0; i < 116; i++) { A.step(); S.inbox = []; }
    return JSON.stringify(S);
  });
  fs.mkdirSync(FIX, {recursive: true});
  fs.writeFileSync(path.join(FIX, 'save-v1-pre-phase1.json'), json);
  console.log(`wrote fixtures/save-v1-pre-phase1.json (${Math.round(json.length / 1024)}KB)`);
  await ctx.close();
}

async function testOldSaves(b) {
  if (!fs.existsSync(FIX)) { ok('old-save fixtures present', false, 'run with --make-fixture'); return; }
  for (const f of fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort()) {
    const raw = fs.readFileSync(path.join(FIX, f), 'utf8');
    const {p, ctx, errs} = await page(b);
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), ['atlas_capital_save_v1', raw]);
    await p.reload(); await p.waitForTimeout(300);
    const saved = JSON.parse(raw);
    const r = await p.evaluate(([inv, savedRev]) => {
      const check = new Function('return (' + inv + ')()'); const A = window.__atlas, S = A.S;
      const revDiff = savedRev.reduce((m, [id, rev]) => { const c = S.cos.find(x => x.id === id); return Math.max(m, c ? Math.abs(c.rev / rev - 1) : 1); }, 0);
      const week = S.week, first = check();
      for (let i = 0; i < 52; i++) { A.step(); S.inbox = []; }
      return {week, revDiff, first, after: check()};
    }, [INVARIANTS.toString(), saved.cos.map(c => [c.id, c.rev])]);
    ok(`${f}: loads at the saved week`, r.week === saved.week, `week ${r.week}`);
    ok(`${f}: revenue unchanged right after loading`, r.revDiff < 1e-9, `max diff ${r.revDiff}`);
    ok(`${f}: invariants after load and 52 more weeks`, !r.first.length && !r.after.length, [...r.first, ...r.after].slice(0, 3).join(' | '));
    ok(`${f}: no page errors`, !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

async function testSaveSafety(b) {
  const {p, ctx, errs} = await page(b);
  await p.click('[data-act=newgame]'); await p.click('[data-act=speed][data-v="0"]');
  await p.evaluate(() => { for (let i = 0; i < 30; i++) window.__atlas.step(); window.__atlas.save(); });
  // export → import round trip
  const round = await p.evaluate(() => { const A = window.__atlas, t = A.exportText(), w = A.S.week; A.step(); const err = A.importText(t); return {err, back: A.S.week === w, same: A.exportText() === t}; });
  ok('export/import round trip restores the exact state', !round.err && round.back && round.same, JSON.stringify(round));
  // garbage import leaves the game alone
  const junk = await p.evaluate(() => { const A = window.__atlas, before = A.exportText(); const err = A.importText('{"v":1,"cos":'); return {err: !!err, same: A.exportText() === before}; });
  ok('corrupt import is rejected without touching the game', junk.err && junk.same);
  // a corrupt main slot falls back to the backup
  const fb = await p.evaluate(() => { const A = window.__atlas; localStorage.setItem(A.BAK_KEY, A.exportText()); localStorage.setItem(A.SAVE_KEY, '{broken'); const o = A.loadSave(); return !!o && o.week === A.S.week && localStorage.getItem(A.SAVE_KEY) === '{broken'; });
  ok('corrupt save falls back to the backup and keeps the broken data', fb);
  // a failing write is reported, not swallowed
  const fail = await p.evaluate(() => { const A = window.__atlas, orig = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };
    const r = A.save(); Storage.prototype.setItem = orig; const msg = [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '); return {r, warned: msg.includes('セーブに失敗')}; });
  ok('a failed write returns false and warns the player', fail.r === false && fail.warned, JSON.stringify(fail));
  // save manager UI
  await p.click('[data-act=help]'); await p.click('[data-act=savemgr]');
  ok('save manager opens', await p.evaluate(() => !!document.querySelector('#savetext-in')));
  await p.click('[data-act=close]');
  ok('no page errors in save tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testUI(b) {
  for (const [name, opt] of [['desktop', {viewport: {width: 1366, height: 900}}], ['iPhone 13', {...devices['iPhone 13']}]]) {
    const {p, ctx, errs} = await page(b, opt);
    await p.click('[data-act=diff][data-v=normal]');
    await p.click('[data-act=allu][data-v="1"]');
    await p.click('[data-act=newgame]'); await p.click('[data-act=speed][data-v="0"]');
    await p.click('[data-act=step]');
    const id = await p.evaluate(() => { const A = window.__atlas, S = A.S; S.won = true; S.player.cash += 300;
      const c = S.cos.filter(c => !c.ctrl && c.ind !== 'air' && c.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares)[0];
      A.execBuy('P', c, c.shares * .8); return c.id; });
    await p.evaluate(id => { window.__atlas.ui.sel = id; }, id);
    await p.click('[data-act=tab][data-v=market]');
    for (const t of ['info', 'trade', 'raid', 'ceo']) { const has = await p.$(`[data-act=ctab][data-v=${t}]`); if (has) await p.click(`[data-act=ctab][data-v=${t}]`); }
    for (const t of ['port', 'pres', 'rivals', 'news', 'inbox', 'market']) await p.click(`[data-act=tab][data-v=${t}]`);
    await p.click('[data-act=step]');
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(`${name}: no horizontal overflow`, overflow <= 0, `${overflow}px`);
    ok(`${name}: no console or page errors`, !errs.length, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
}

// Phase 1: city × industry markets, share competition and profit attribution.
async function testMarkets(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(quick => {
    const A = window.__atlas, out = {roles: {'-1': [0, 0, 0], '0': [0, 0, 0], '1': [0, 0, 0]}, cutHurts: 0, cutTried: 0, attrErr: 0, attrN: 0, bankrupt: 0};
    const seeds = quick ? [3, 5] : [3, 5, 8, 13, 21, 34];
    for (const sd of seeds) for (const ps of [-1, 0, 1]) { // one company per seed run under each price level for 3 years
      A.newGame(sd * 101, 'normal', 'T', 't', 'std', true); const S = A.S, c = S.cos[sd % S.cos.length], id = c.id; c.ps = ps;
      const r0 = c.rev, s0 = c.sh; for (let i = 0; i < 156; i++) { A.step(); S.inbox = []; const x = S.cos.find(y => y.id === id); if (!x) break; x.ps = ps; }
      const x = S.cos.find(y => y.id === id); const R = out.roles[ps]; if (!x) { R[3] = (R[3] || 0) + 1; continue; } // merged, bought out or bankrupt
      R[0] += x.rev / r0; R[1] += x.sh / s0; R[2] += x.cash / r0; R[4] = (R[4] || 0) + 1;
    }
    out.shareOrder = {n: 0, bad: 0}; out.marginOrder = {n: 0, bad: 0};
    for (const sd of seeds) { // pure functions, no randomness: the direction of the price lever for every company
      A.newGame(sd * 71, 'normal', 'T', 't', 'std', true); const S = A.S; for (let i = 0; i < 26; i++) { A.step(); S.inbox = []; }
      for (const c of S.cos) {
        const t = [-1, 0, 1].map(ps => A.mkTargets(c.mk, {id: c.id, ps})[c.id]), m = [-1, 0, 1].map(ps => A.pricePreview(c, ps).m);
        out.shareOrder.n++; if (!(t[0] > t[1] && t[1] > t[2])) out.shareOrder.bad++;
        const o = [-1, 0, 1].map(ps => A.pricePreview(c, ps).op); out.marginOrder.n++; if (!(o[1] >= o[0] - 1e-9 && o[1] >= o[2] - 1e-9)) out.marginOrder.bad++;
      }
    }
    for (const sd of seeds) { // a rival in the same market cuts its price: our share should fall
      A.newGame(sd * 313, 'normal', 'T', 't', 'std', true); const S = A.S;
      const by = {}; for (const c of S.cos) (by[c.mk] = by[c.mk] || []).push(c);
      const key = Object.keys(by).sort().find(k => by[k].length >= 2); if (!key) continue;
      const [me, rv] = by[key]; const s0 = me.sh; rv.ps = -1; out.cutTried++;
      for (let i = 0; i < 26; i++) { A.step(); S.inbox = []; rv.ps = -1; }
      if (me.sh < s0) out.cutHurts++;
    }
    for (const sd of seeds) { // attribution adds up; count bankruptcies
      A.newGame(sd * 977, 'normal', 'T', 't', 'std', true); const S = A.S;
      for (let i = 0; i < 260; i++) { A.step(); S.inbox = []; for (const n of S.news) { if (n.w !== S.week) break; if (n.t.startsWith('【経営破綻】')) out.bankrupt++; } }
      for (const c of S.cos) if (c.attr) { out.attrN++; const sum = c.attr.terms.reduce((a, t) => a + t[1], 0); out.attrErr = Math.max(out.attrErr, Math.abs(sum - c.attr.dop) / Math.max(1, Math.abs(c.attr.op))); }
    }
    for (const k in out.roles) { const R = out.roles[k]; for (let i = 0; i < 3; i++) R[i] /= R[4] || 1; }
    return out;
  }, QUICK).catch(e => ({error: e.message}));
  if (r.error) { ok('market tests ran', false, r.error); await ctx.close(); return; }
  const [lo, st, hi] = [r.roles['-1'], r.roles['0'], r.roles['1']];
  console.log(`MARKET price roles (3y, relative to start): revenue low ${lo[0].toFixed(2)} / std ${st[0].toFixed(2)} / high ${hi[0].toFixed(2)}; share ${lo[1].toFixed(2)} / ${st[1].toFixed(2)} / ${hi[1].toFixed(2)}; cash ${lo[2].toFixed(2)} / ${st[2].toFixed(2)} / ${hi[2].toFixed(2)}`);
  ok('price mechanism: for every company, equilibrium share low > standard > high', r.shareOrder.bad === 0 && r.shareOrder.n > 0, `${r.shareOrder.n - r.shareOrder.bad}/${r.shareOrder.n}`);
  console.log(`MARKET companies lost during the 3 years: low ${lo[3] || 0} / std ${st[3] || 0} / high ${hi[3] || 0}`);
  // Standard is where operating profit peaks at a normal brand without research (a few strong or weak brands may differ).
  ok('price mechanism: standard earns at least as much as high or low for most companies (≥90%)', r.marginOrder.n > 0 && r.marginOrder.bad <= r.marginOrder.n * .1, `${r.marginOrder.n - r.marginOrder.bad}/${r.marginOrder.n}`);
  console.log('MARKET (info only — separate runs diverge, so this is noisy)');
  ok('a rival price cut takes share from the same market', r.cutHurts === r.cutTried && r.cutTried > 0, `${r.cutHurts}/${r.cutTried}`);
  ok('profit attribution adds up to the change in operating profit', r.attrN > 0 && r.attrErr < 1e-6, `${r.attrN} companies, max error ${r.attrErr}`);
  console.log(`MARKET bankruptcies over 5 years across ${QUICK ? 2 : 6} games: ${r.bankrupt}`);
  ok('no page errors in market tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// Phase 2: rival styles, restructuring, executives and delegation.
async function testPhase2(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(quick => {
    const A = window.__atlas, out = {};
    A.newGame(777, 'normal', 'T', 't', 'std', true); let S = A.S; S.won = true; S.lost = true; S.player.cash += 2000;
    const c = S.cos.filter(x => !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares)[0];
    A.execBuy('P', c, c.shares * .8); if (c.ctrl !== 'P') A.execBuy('P', c, c.shares * .15);
    out.ctrl = c.ctrl === 'P';
    const f0 = c.fixed; A.restructure(c, 'cost'); out.costCut = c.fixed / f0;
    A.hire(c, 0); c.deleg = 'cash'; c.brand = .95; S.research.done.op2 = 1; // a strong brand and loyal customers make a price rise pay
    for (let i = 0; i < 12; i++) { A.step(); S.inbox = []; }
    out.cashPolicy = {payout: c.payout, ps: c.ps, log: (c.mlog || []).length};
    const counts = {raider: 0, turnaround: 0, keiretsu: 0, defend: 0};
    for (const sd of quick ? [3] : [3, 9, 27]) {
      A.newGame(sd * 4099, 'hard', 'T', 't', 'std', true); S = A.S;
      for (let i = 0; i < 520; i++) { A.step(); S.inbox = []; for (const n of S.news) { if (n.w !== S.week) break; if (n.t.includes('資産回収型')) counts.raider++; if (n.t.includes('再建型')) counts.turnaround++; if (n.t.includes('系列型')) counts.keiretsu++; if (n.t.includes('買い集めに対抗')) counts.defend++; } }
    }
    out.counts = counts;
    return out;
  }, QUICK);
  ok('restructuring: cost cut lowers fixed costs by 15%', Math.abs(r.costCut - .85) < 1e-9, r.costCut);
  ok('delegation: a CEO on the cash policy raises prices and payout', r.ctrl && r.cashPolicy.payout === .8 && r.cashPolicy.ps === 1, JSON.stringify(r.cashPolicy));
  console.log('PHASE2 style-specific rival actions over 10 years: ' + JSON.stringify(r.counts));
  ok('rival styles: the asset-stripper and the turnaround investor each act in character', r.counts.raider > 0 && r.counts.turnaround > 0, '');
  ok('no page errors in phase 2 tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// Phase 3: founding, regional expansion, listing, vertical integration.
async function testPhase3(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(inv => {
    const check = new Function('return (' + inv + ')()'); const A = window.__atlas, out = {};
    A.newGame(5150, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = true; S.lost = true; S.player.cash += 3000;
    const nw0 = A.netWorth('P'), f = A.foundCompany('tyo', 'tech', 30);
    out.found = {priv: f.priv, owned: f.own.P === f.shares, ctrl: f.ctrl, nwDrop: nw0 - A.netWorth('P')};
    let parent = S.cos.filter(x => !x.ctrl && !x.priv && x.ind === 'auto').sort((a, b) => a.price * a.shares - b.price * b.shares)[0];
    A.execBuy('P', parent, parent.shares * .8); if (parent.ctrl !== 'P') A.execBuy('P', parent, parent.shares * .15);
    const city = Object.entries({jp: 'tyo', am: 'nyc', emea: 'lon', ap: 'sin'}).find(([r]) => !parent.mk.startsWith(r))[1];
    const sub = A.expandRegion(parent, city, .1);
    out.expand = {priv: sub.priv, parentOwns: sub.own[parent.id] === sub.shares, ctrl: sub.ctrl, market: sub.mk !== parent.mk};
    const steel = S.cos.filter(x => !x.ctrl && !x.priv && x.ind === 'steel').sort((a, b) => b.rev - a.rev)[0];
    const vb0 = A.vertBonus(parent); A.execBuy('P', steel, steel.shares * .8); if (steel.ctrl !== 'P') A.execBuy('P', steel, steel.shares * .15);
    out.vert = {before: vb0, after: A.vertBonus(parent), big: steel.rev >= parent.rev * .15};
    out.buyPriv = A.execBuy('R1', f, f.shares * .1) === null;
    for (let i = 0; i < 104; i++) { A.step(); S.inbox = []; }
    const f2 = S.cos.find(x => x.id === f.id); out.alive = !!f2;
    if (f2) { const raised = A.listCompany(f2); out.listed = {raised: raised > 0, priv: f2.priv}; }
    out.bad = check();
    return out;
  }, INVARIANTS.toString());
  ok('founding: an unlisted company fully owned by the player, costing about its capital', r.found.priv && r.found.owned && r.found.ctrl === 'P' && r.found.nwDrop > 0 && r.found.nwDrop < 30, JSON.stringify(r.found));
  ok('expansion: an unlisted subsidiary in another region\'s market, owned by the parent', r.expand.priv && r.expand.parentOwns && r.expand.ctrl === 'P' && r.expand.market, JSON.stringify(r.expand));
  ok('vertical integration: controlling a large supplier lowers costs', r.vert.after > r.vert.before || !r.vert.big, JSON.stringify(r.vert));
  ok('unlisted shares cannot be bought on the market', r.buyPriv);
  ok('a founded company can be listed later', !r.alive || (r.listed.raised && !r.listed.priv), JSON.stringify(r.listed || {}));
  ok('invariants hold with unlisted companies', !r.bad.length, r.bad.slice(0, 3).join(' | '));
  ok('no page errors in phase 3 tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// Phase 4: raw materials, regional demand shocks, credit crises.
async function testPhase4(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {};
    A.newGame(6060, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = true; S.lost = true; S.player.cash += 3000;
    const op = c => { const st = A.opState(c); return (st.D * st.s * (st.P * (1 + st.syn) - st.vc * st.raw) - st.fixed) * st.fx; };
    const air = S.cos.find(c => c.ind === 'air'), en = S.cos.find(c => c.ind === 'energy');
    const a0 = op(air), e0 = op(en); S.econ.raw = 1.5; out.raw = {airDown: op(air) < a0, energyUp: op(en) > e0}; S.econ.raw = 1;
    // a controlled company forced into distress: crisis → inbox → resolved
    const pick = () => S.cos.filter(x => !x.ctrl && !x.priv && x.ind !== 'air' && x.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares);
    const c = pick()[0]; A.execBuy('P', c, c.shares * .8); if (c.ctrl !== 'P') A.execBuy('P', c, c.shares * .15);
    const d = pick()[0]; A.execBuy('P', d, d.shares * .8); if (d.ctrl !== 'P') A.execBuy('P', d, d.shares * .15);
    for (const x of [c, d]) { x.debt = x.rev * 6; x.cash = 0; x.margin = x.base = -.05; x.ni = -1; }
    A.crisisCheck();
    out.crisis = {flag: !!c.crisis, inbox: S.inbox.some(i => i.kind === 'crisis' && i.cid === c.id)};
    out.resolved = A.resolveCrisis(c, 'refi') && !c.crisis && c.pen && c.pen.add === 3;
    S.inbox = S.inbox.filter(i => i.cid !== d.id);
    for (let i = 0; i < 10; i++) { d.cash = 0; d.ni = Math.min(d.ni, -1); A.step(); S.inbox = S.inbox.filter(it => it.cid !== d.id); }
    out.bankrupt = !S.cos.some(x => x.id === d.id);
    return out;
  });
  ok('raw materials: a price spike hurts airlines and helps energy companies', r.raw.airDown && r.raw.energyUp, JSON.stringify(r.raw));
  ok('credit crisis: a distressed controlled company raises a crisis in the inbox', r.crisis.flag && r.crisis.inbox, JSON.stringify(r.crisis));
  ok('credit crisis: choosing a way out clears it (refinancing adds 3% for two years)', r.resolved);
  ok('credit crisis: ignoring it for 8 weeks ends in bankruptcy', r.bankrupt);
  ok('no page errors in phase 4 tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testPhase5(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {};
    A.newGame(7070, 'normal', 'T', 't', 'std', true); const S = A.S; S.lost = true;
    out.emptyTasks = A.tasks().length;
    const c = S.cos.filter(x => !x.ctrl && !x.priv).sort((a, b) => a.price * a.shares - b.price * b.shares)[0];
    S.player.cash += 500; const cash0 = S.player.cash;
    A.execBuy('P', c, c.shares * .06); const cashAfterBuy = S.player.cash;
    A.stepCheck();
    out.steps = {buy: S.tut.buy != null, big: S.tut.big != null, reward: +(S.player.cash - cashAfterBuy).toFixed(6)};
    A.stepCheck(); out.once = +(S.player.cash - cashAfterBuy).toFixed(6) === out.steps.reward;
    S.inbox.push({kind: 'tip', cid: c.id, from: 'R1', exp: S.week + 3});
    out.inboxTask = A.tasks().some(t => t.go === 'inbox');
    S.inbox = [];
    // endless goals: after the first win the next targets roll on
    S.won = true; S.goalIdx = 1; S.player.cash += 3000; A.step();
    out.goal = S.goalIdx;
    return out;
  });
  ok('tasks bar: nothing to do at the start', r.emptyTasks === 0, String(r.emptyTasks));
  ok('beginner steps: first buy and 5% stake are recorded with a reward', r.steps.buy && r.steps.big && r.steps.reward === 3, JSON.stringify(r.steps));
  ok('beginner steps: a reward is paid only once', r.once);
  ok('tasks bar: an inbox item shows up as a task', r.inboxTask);
  ok('endless mode: passing 3,000億円 after winning moves to the next goal', r.goal === 2, String(r.goal));
  // old saves get milestones recorded silently, without rewards
  const o = await p.evaluate(() => { const A = window.__atlas; A.newGame(7071, 'normal', 'T', 't', 'std', true); const S = A.S; S.lost = true; const c = S.cos.find(x => !x.ctrl && !x.priv); A.execBuy('P', c, c.shares * .01); const t = JSON.parse(A.exportText()); delete t.tut; delete t.goalIdx; const s2 = A.parseSave(JSON.stringify(t)); return {tut: s2.tut, goalIdx: s2.goalIdx}; });
  ok('old saves: milestone state is added on load', o.tut && o.tut._m === 1 && o.goalIdx === 0, JSON.stringify(o));
  // the tasks bar renders on a phone and navigates
  const m = await page(b, devices['iPhone 13']);
  const ph = await m.p.evaluate(() => { const A = window.__atlas; A.newGame(7072, 'normal', 'T', 't', 'std', true); const S = A.S; S.lost = true; S.won = true; const c = S.cos.find(x => !x.ctrl && !x.priv); S.inbox.push({kind: 'tip', cid: c.id, from: 'R1', exp: S.week + 3}); document.querySelector('#modal').hidden = true; return true; });
  await m.p.evaluate(() => document.querySelector('[data-act="tab"][data-v="news"]').click());
  const bar = await m.p.evaluate(() => { const el = document.querySelector('#tasks'); return {shown: !el.hidden, w: el.scrollWidth <= el.clientWidth + 1, btn: !!el.querySelector('[data-act="task"]')}; });
  ok('tasks bar: shown on iPhone without overflow', ph && bar.shown && bar.w && bar.btn, JSON.stringify(bar));
  if (bar.btn) { await m.p.click('#tasks [data-act="task"]'); const tab = await m.p.evaluate(() => window.__atlas.ui.tab); ok('tasks bar: tapping a task opens the right tab', tab === 'inbox', tab); }
  ok('no page errors in phase 5 tests', !errs.length && !m.errs.length, errs.concat(m.errs).slice(0, 3).join(' | '));
  await m.ctx.close(); await ctx.close();
}

// Phase 6: real estate, and rivals using proposals, proxy fights, LBOs and equity raises.
async function testPhase6(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {};
    A.newGame(8080, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = true; S.lost = true;
    out.sameProps = JSON.stringify(A.genProps()) === JSON.stringify(S.props) && S.props.length >= 50;
    // buying with a 50% loan: cash falls by the equity part, net worth only by the 3% fee
    S.player.cash = 500; const pr = S.props.find(x => x.city === 'tyo'), nw0 = A.netWorth('P'), v = A.propVal(pr);
    out.bought = A.buyProp('P', pr, .5); out.cashDrop = +(500 - S.player.cash).toFixed(4); out.expect = +(v * .53).toFixed(4); out.nwDrop = +(nw0 - A.netWorth('P')).toFixed(4); out.fee = +(v * .03).toFixed(4);
    const c0 = S.player.cash; S.econ.rate = S.econ.rate; A.propStep(); out.rent = S.player.cash > c0;
    const v1 = A.propVal(pr); S.econ.rate += 1; A.propStep(); out.rateHit = A.propVal(pr) < v1 * .98;
    const ny = S.props.find(x => x.city === 'nyc'), vn = A.propVal(ny); S.econ.fx *= 1.2; out.fx = Math.abs(A.propVal(ny) / vn - 1.2) < 1e-9; S.econ.fx /= 1.2;
    const c1 = S.player.cash, net = A.sellProp(pr); out.sold = !pr.own && Math.abs(S.player.cash - c1 - net) < 1e-9;
    // rival proposal: the player votes against with a big stake and wins
    const R = S.rivals[0], t = S.cos.filter(c => !c.ctrl && !c.priv).sort((a, b) => a.price * a.shares - b.price * b.shares)[3];
    A.execBuy('R1', t, t.shares * .1); A.execBuy('P', t, t.shares * .35);
    A.rivalPropose(R, t, 'div'); const it = S.inbox.find(i => i.kind === 'vote' && i.cid === t.id);
    out.voteInbox = !!it; const pay0 = t.payout; if (it) A.castVote(it.id, -1);
    for (let i = 0; i < 3; i++) { A.step(); S.inbox = S.inbox.filter(i => i.kind !== 'vote'); }
    out.voteBlocked = !t.ract && t.payout <= pay0 + 1e-9;
    // rival proxy fight against a board the player holds
    const u = S.cos.filter(c => !c.ctrl && !c.priv && c !== t && !c.proxy).sort((a, b) => a.price * a.shares - b.price * b.shares)[5];
    A.execBuy('R1', u, u.shares * .35); u.board = 'P'; u.boardEnd = S.week + 40; R.cash += 100;
    A.rivalProxyStart(R, u); R.cash = 0; R.agg = 0; for (const h of S.cos) if (h.ctrl === 'R1') h.cash = 0; out.proxyInbox = S.inbox.some(i => i.kind === 'vote' && i.what === 'proxy' && i.cid === u.id);
    u.price = A.fair(u) * .7; u.proxy.end = S.week; A.rivalProxyResolve(u); // the shareholder meeting of an undervalued company: holders lean towards the challenger
    out.proxy = {board: u.board, ctrl: u.ctrl || null};
    // LBO: a raider short of cash can still bid by borrowing against the target
    const w = S.cos.filter(c => !c.ctrl && !c.priv && !c.proxy && c !== t && c !== u).sort((a, b) => a.price * a.shares - b.price * b.shares)[8];
    w.debt = 0; R.cash = 0; for (const h of S.cos) if (h.ctrl === 'R1') h.cash = 0;
    const bid = Math.max(w.price, A.fair(w)) * 1.45, need = bid * w.shares * .5; R.cash = need * .5; const bb = A.rivalBid(R, w, bid, .51); out.lbo = !!bb && bb[1] === true; out.lboInfo = JSON.stringify({bb: bb && [bb[0], bb[1], bb[2].cost], need, rc: R.cash, style: R.style});
    // third-party allotment raises the rival's stake and dilutes the player
    const x = S.cos.find(c => !c.priv && c.ctrl === null && c !== t && c !== u && c !== w);
    A.execBuy('R1', x, x.shares * .52); A.execBuy('P', x, x.shares * .05); R.cash = 1e4;
    const fr = x.own.R1 / x.shares, fp = x.own.P / x.shares; A.allot(x, 'R1', .15);
    out.allot = {up: x.own.R1 / x.shares > fr, diluted: x.own.P / x.shares < fp, ctrl: x.ctrl};
    return out;
  });
  ok('real estate: properties come from the city list alone (no RNG)', r.sameProps);
  ok('real estate: a 50% loan purchase uses 53% of the price in cash and costs only the fee in net worth', r.bought && Math.abs(r.cashDrop - r.expect) < 1e-6 && Math.abs(r.nwDrop - r.fee) < 1e-6, JSON.stringify({c: r.cashDrop, e: r.expect, n: r.nwDrop, f: r.fee}));
  ok('real estate: rent arrives weekly; a rate rise lowers values; overseas values move with the yen', r.rent && r.rateHit && r.fx, JSON.stringify({rent: r.rent, rate: r.rateHit, fx: r.fx}));
  ok('real estate: selling pays the owner the price after costs and the loan', r.sold);
  ok('rival proposals: the player gets a vote and a large "no" vote blocks it', r.voteInbox && r.voteBlocked, JSON.stringify({i: r.voteInbox, b: r.voteBlocked}));
  ok('rival proxy fights: a 35% rival takes the board the player held', r.proxyInbox && r.proxy.board === 'R1', JSON.stringify(r.proxy));
  ok('rival LBO: a raider short of cash bids with borrowed money', r.lbo, r.lboInfo);
  ok('rival equity: a third-party allotment raises the rival stake and dilutes the player', r.allot.up && r.allot.diluted && r.allot.ctrl === 'R1', JSON.stringify(r.allot));
  // long run: rivals use the new moves and nothing breaks
  const l = await p.evaluate(inv => { const A = window.__atlas; A.newGame(8181, 'hard', 'T', 't', 'std', true); const S = A.S; S.won = true; S.lost = true; const seen = {}; for (let w = 0; w < 520; w++) { A.step(); S.inbox = []; for (const n of S.news) if (n.w === S.week) for (const k of ['株主提案', '委任状争奪戦', 'LBO', '第三者割当', '不動産取得']) if (n.t.includes(k)) seen[k] = (seen[k] || 0) + 1; } return {seen, bad: (0, eval)('(' + inv + ')')()}; }, INVARIANTS.toString());
  ok('rivals use proposals, proxy fights and real estate over 10 years', l.seen['株主提案'] > 0 && l.seen['委任状争奪戦'] > 0 && l.seen['不動産取得'] > 0, JSON.stringify(l.seen));
  ok('invariants hold over 10 hard years with the new moves', !l.bad.length, l.bad.slice(0, 5).join(', '));
  // the property list in a city renders on iPhone without overflow
  const m = await page(b, devices['iPhone 13']);
  await m.p.evaluate(() => { const A = window.__atlas; A.newGame(8282, 'normal', 'T', 't', 'std', true); A.S.lost = true; A.S.player.cash = 300; A.buyProp('P', A.S.props.find(x => x.city === 'osa'), .5); document.querySelector('#modal').hidden = true; A.ui.city = 'tyo'; });
  await m.p.click('[data-act=tab][data-v=market]');
  const a = await m.p.evaluate(() => ({n: document.querySelectorAll('[data-act=pbuy]').length, o: document.documentElement.scrollWidth - innerWidth}));
  await m.p.click('[data-act=tab][data-v=port]');
  const b2 = await m.p.evaluate(() => ({sell: document.querySelectorAll('[data-act=psell]').length, o: document.documentElement.scrollWidth - innerWidth}));
  const lg = await m.p.evaluate(() => document.querySelector('#legend').textContent.includes('あなたの不動産'));
  ok('map legend shows the player\'s real estate once a property is owned', lg);
  // tapping a property marker on the map opens that city's property list; rival properties get their own marks
  await m.p.evaluate(() => { const A = window.__atlas, S = A.S; S.rivals[0].cash += 500; A.buyProp('R1', S.props.find(x => x.city === 'osa' && !x.own), .5); A.ui.city = null; scrollTo(0, 0); });
  await m.p.click('[data-act=zoomjp]'); await m.p.waitForTimeout(500);
  const hit = await m.p.evaluate(() => { const h = window.__atlas.propHits.find(x => x[2] === 'osa'), r = document.querySelector('#map').getBoundingClientRect(); return h && {x: r.left + h[0], y: r.top + h[1], vis: h[0] > 0 && h[0] < r.width && h[1] > 0 && h[1] < r.height, n: window.__atlas.propHits.length}; });
  let tapped = null;
  if (hit && hit.vis) { await m.p.touchscreen.tap(hit.x, hit.y); await m.p.waitForTimeout(700); tapped = await m.p.evaluate(() => ({city: window.__atlas.ui.city, list: !!document.querySelector('#cprops'), legend: document.querySelector('#legend').textContent.includes('ライバルの不動産')})); }
  ok('map: tapping a property marker opens that city\'s property list', tapped && tapped.city === 'osa' && tapped.list && tapped.legend, JSON.stringify({hit, tapped}));
  ok('iPhone: city property list and holdings render without overflow', a.n > 0 && a.o <= 0 && b2.sell === 1 && b2.o <= 0, JSON.stringify({a, b2}));
  ok('no page errors in phase 6 tests', !errs.length && !m.errs.length, errs.concat(m.errs).slice(0, 3).join(' | '));
  await m.ctx.close(); await ctx.close();
}

// Research tree: effects work, and the budget stops once nothing is left to buy.
async function testResearch(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(5151, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true;
    S.research.done.fin3 = 0; out.week0 = A.shortCap() === .25; delete S.research.done.fin3;
    out.call = [A.callLine()]; S.research.done.fin4 = 5; out.call.push(A.callLine());
    // a controlled company: going premium pays roughly twice as much with loyal customers
    S.player.cash = 5000; const c = S.cos.filter(x => !x.priv && S.cos.filter(y => y.mk === x.mk).length >= 3)[0]; A.execBuy('P', c, c.shares * .55);
    const g0 = A.pricePreview(c, 1).op - A.pricePreview(c, 0).op; S.research.done.op2 = 5; const g1 = A.pricePreview(c, 1).op - A.pricePreview(c, 0).op;
    out.op2 = {ctrl: c.ctrl, g0: +g0.toFixed(2), g1: +g1.toFixed(2)};
    // budget: spends only what is still needed, then stops
    for (const br of ['fin', 'ma', 'op', 'in']) for (let i = 1; i <= 4; i++) S.research.done[br + i] = 5;
    delete S.research.done.in4; S.research.pts = 0; S.research.budget = 3; S.player.cash = 1e5;
    const c0 = S.player.cash; for (let i = 0; i < 20; i++) A.researchStep(); out.spent = +(c0 - S.player.cash).toFixed(4); out.pts = +S.research.pts.toFixed(4); out.left = A.researchLeft();
    return out;
  });
  ok('research: an item finished in week 0 still takes effect', r.week0);
  ok('research: the derivatives desk widens the margin-call line by 5 points', Math.abs(r.call[1] - r.call[0] - .05) < 1e-9, JSON.stringify(r.call));
  ok('research: loyal customers turn a losing price rise into a profitable one', r.op2.ctrl === 'P' && r.op2.g0 < 0 && r.op2.g1 > 0, JSON.stringify(r.op2));
  ok('research: the budget stops once everything is paid for', r.spent === 35 && r.pts === 35 && r.left === 0, JSON.stringify({spent: r.spent, pts: r.pts, left: r.left}));
  ok('no page errors in research tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// PE: deals, due diligence, auctions, LBO, value creation, exits, take-private and funds (LP money kept apart).
async function testPE(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(6161, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 600;
    const gen = () => { let d = null; for (let i = 0; i < 50 && !d; i++) d = A.peDealGen(); return d; };
    const byDeal = d => S.cos.find(x => x.pe && x.tk === 'PE' + String(d.id).slice(1).padStart(3, '0')); // tickers are unique, names are not
    // due diligence: costs money and reveals the real margin; a found problem comes off the price
    let d1 = gen(); for (let i = 0; i < 40 && (d1.type === 'turn' || A.dealAsk(d1) < 2); i++) d1 = gen(); d1.risk = {k: 'debt', cost: d1.rev * .1, w: 10}; d1.exp = S.week + 20; const c0 = S.player.cash;
    A.peDD(d1); out.ddPaid = S.player.cash < c0; for (let i = 0; i < 4; i++) { A.step(); S.inbox = []; } out.ddDone = d1.dd === 2; const after = A.dealAsk(d1); d1.dd = 0; out.ddCheaper = after < A.dealAsk(d1); d1.dd = 2; // same week: what the seller's numbers say vs what due diligence found
    // a deal nobody else wants: a 10% lowball wins; the J-curve shows right after buying
    const d = gen(); d.n = 0; d.ai = 0; d.exp = S.week + 20; d.risk = null;
    const nw0 = A.netWorth('P'), cash0 = S.player.cash, q = A.peQuote(d, A.dealAsk(d) * .9, .5, 'P');
    out.bid = A.peBid(d, -.1, .5, false, 'P'); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; }
    const c = byDeal(d); out.won = !!c && c.ctrl === 'P' && c.priv && c.own.P === c.shares;
    out.lbo = c && c.debt >= d.debt + q.acq - 1e-6;
    { S.player.cash += 2000; let e = gen(); for (let i = 0; i < 40 && (e.type === 'turn' || A.dealAsk(e) < 2); i++) e = gen(); e.n = 0; e.ai = 0; e.bids = []; e.exp = S.week + 20; e.risk = null; e.dd = 2; /* known numbers: only fees and the discount remain */ const qe = A.peQuote(e, A.dealAsk(e), .5, 'P'); A.peBid(e, 0, .5, false, 'P'); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; }
      const ce = byDeal(e); out.jcurve = ce ? (qe.out - ce.own.P * ce.price) / qe.out : null; } // bought at the asking price: the mark sits below the cheque
    // an outbid player loses
    const d2 = gen(); d2.n = 2; d2.ai = A.dealAsk(d2) * 1.3; d2.exp = S.week + 20; A.peBid(d2, 0, 0, false, 'P'); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; } out.lost = !(byDeal(d2) && byDeal(d2).pe.owner === 'P');
    // skipping due diligence: the hidden problem shows up later
    const d3 = gen(); d3.n = 0; d3.ai = 0; d3.exp = S.week + 20; d3.risk = {k: 'suit', cost: 3, w: 2}; A.peBid(d3, 0, 0, false, 'P'); for (let i = 0; i < 6; i++) { A.step(); S.inbox = []; }
    out.surprise = S.news.some(n => n.t.includes('買収後の誤算'));
    // recap: debt up, cash back to the owner, recorded as a distribution
    if (c) { const before = A.peStats(c).ret, cash1 = S.player.cash; c.debt = 0; const a = A.peRecap(c); out.recap = a > 0 && S.player.cash > cash1 && A.peStats(c).ret > before; }
    // exit through a sale process: bids arrive in the inbox; selling writes the track record
    if (c) { A.peExitStart(c); for (let i = 0; i < 6; i++) A.step(); const it = S.inbox.find(i => i.kind === 'peexit' && i.cid === c.id); out.exitBids = it ? it.bids.length : 0;
      if (it) { const cash2 = S.player.cash; const bb = it.bids[it.bids.length - 1]; A.peSell(c, bb); out.sold = (!S.cos.includes(c) || (c.own.P == null && c.ctrl === bb.buyer)) && S.player.cash > cash2 && S.pe.track.length >= 1 && S.pe.track[0].moic > 0; } }
    // take a controlled listed company private
    const L = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[4]; S.player.cash += 3000; for (let i = 0; i < 4 && L.ctrl !== 'P'; i++) A.execBuy('P', L, L.shares * .3);
    const tp = L.ctrl === 'P' && A.peTakePrivate(L, 0); out.privatized = !!tp && L.priv && L.own.P === L.shares && !!L.pe; out.tpInfo = {ctrl: L.ctrl, priv: L.priv, tob: S.tobs.some(t => t.cid === L.id), bp: Math.round(A.buyingPower()), cap: Math.round(L.price * L.shares), pe: !!L.pe, own: L.own.P && +(L.own.P / L.shares).toFixed(3)};
    // funds: LP money never counts as the player's
    S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
    S.player.cash = 2000; const f = A.fundRaise('buyout', .05); for (let i = 0; i < 13; i++) { A.step(); S.inbox = []; }
    out.fund = {closed: !f.raising, size: f.lp + f.gp, gp: f.gp};
    const nwA = A.netWorth('P'); out.lpNotMine = Math.abs(nwA - A.netWorth('P')) < 1e-9; // closing a fund adds no net worth
    let d4 = gen(); for (let i = 0; i < 60 && (d4.type === 'turn' || A.peQuote(d4, A.dealAsk(d4) * .9, .5, f.id).out > A.fundDry(f) * .8 || A.dealAsk(d4) < 1); i++) d4 = gen(); d4.n = 0; d4.ai = 0; d4.bids = []; d4.exp = S.week + 20; d4.risk = null; const q4 = A.peQuote(d4, A.dealAsk(d4) * .9, .5, f.id);
    const pc0 = S.player.cash, lp0 = f.calledLP; A.peBid(d4, -.1, .5, false, f.id); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; }
    const fc = byDeal(d4);
    out.fundBuy = {owned: !!fc && fc.own[f.id] === fc.shares && fc.ctrl === 'P', lpPaid: f.calledLP - lp0 > q4.out * .9, nav: A.fundNAV(f) > 0};
    // waterfall: a big distribution pays capital back, then the preferred return, then 20% carry to the GP
    const PI = f.calledLP + f.calledGP, c3 = S.player.cash; A.fundDistribute(f, PI * 2); const st = A.fundStats(f);
    out.carry = {carry: +f.carry.toFixed(4), expect: +(.2 * PI).toFixed(4), playerGot: +(S.player.cash - c3).toFixed(4), gpShare: +(f.carry + (PI * 2 - f.carry) * f.gp / (f.lp + f.gp)).toFixed(4), dpi: st.dpi};
    out.irr = A.irr([[0, -100], [52, 0], [104, 0], [156, 286]], 0, 156);
    // other bidders: AI firms and the rivals; an unclaimed deal goes to the best of them
    let rivalBid = false, aiWon = null;
    for (let i = 0; i < 300 && (!rivalBid || !aiWon); i++) { const x = A.peDealGen(); if (!x) continue; if (x.bids.some(b => /^R/.test(b.k))) rivalBid = true;
      if (!aiWon && x.bids.length) { x.exp = S.week; const c5 = A.peAIWin(x); if (c5) aiWon = {owner: c5.pe.owner, ctrl: c5.ctrl, priv: c5.priv}; } S.pe.deals = S.pe.deals.filter(y => y !== x); }
    out.rivalBid = rivalBid; out.aiWon = aiWon;
    // co-investment: an AI firm takes 25%; the player keeps control and pays 75%
    S.player.cash = 3000; for (const q of S.pe.firms) q.cash = Math.max(q.cash, 5000); const d6 = gen(); d6.bids = []; d6.n = 0; d6.ai = 0; d6.exp = S.week + 20; d6.risk = null; const q6 = A.peQuote(d6, A.dealAsk(d6), .5, 'P'), cash6 = S.player.cash;
    const okBid = A.peBid(d6, 0, .5, false, 'P', .25); for (let i = 0; i < 3; i++) { A.step(); S.inbox = S.inbox.filter(x => x.kind === 'pesec'); }
    const c6 = byDeal(d6);
    out.co = c6 ? {bid: okBid, mine: +(c6.own.P / c6.shares).toFixed(4), partner: c6.pe.co && +(c6.own[c6.pe.co.k] / c6.shares).toFixed(4), ctrl: c6.ctrl, inv: +(c6.pe.inv / q6.out).toFixed(4)} : {bid: okBid};
    // secondary: an AI firm offers its company to the player first; buying makes it the player's
    const qx = S.cos.find(x => x.pe && /^Q/.test(x.pe.owner) && x.priv);
    if (qx) { qx.pe.w0 = S.week - 400; let it = null; for (let i = 0; i < 26 && !it; i++) { A.step(); it = S.inbox.find(x => x.kind === 'pesec' && x.cid === qx.id); S.inbox = S.inbox.filter(x => x === it); }
      const firm = A.firmBy(qx.pe.owner), fc0 = firm.cash; out.sec = it ? {offered: true, bought: A.peBuySecondary(qx, 'P', it.eq), owner: qx.pe.owner, type: qx.pe.type, firmPaid: firm.cash > fc0} : {offered: false}; }
    return out;
  });
  ok('PE: due diligence costs money, takes 4 weeks and takes a found problem off the price', r.ddPaid && r.ddDone && r.ddCheaper, JSON.stringify({p: r.ddPaid, d: r.ddDone, c: r.ddCheaper}));
  ok('PE: an uncontested 10% lowball wins; the company is unlisted, wholly owned and carries the LBO debt', r.bid && r.won && r.lbo, JSON.stringify({bid: r.bid, won: r.won, lbo: r.lbo}));
  ok('PE: J-curve — fees and the illiquidity discount cost 5–30% of the cheque at once', r.jcurve > .05 && r.jcurve < .3, String(r.jcurve));
  ok('PE: a higher rival bid wins the auction', r.lost);
  ok('PE: skipping due diligence lets a hidden problem surface after the deal', r.surprise);
  ok('PE: a dividend recap pays the owner and counts as a distribution', r.recap);
  ok('PE: a sale process brings bids; selling closes the investment into the track record', r.exitBids > 0 && r.sold, JSON.stringify({n: r.exitBids, sold: r.sold}));
  ok('PE: taking a controlled listed company private buys out every outside holder', r.privatized, JSON.stringify(r.tpInfo));
  ok('PE fund: LP commitments close and are not counted as the player\'s net worth', r.fund.closed && r.fund.size > 0 && r.lpNotMine, JSON.stringify(r.fund));
  ok('PE fund: a fund deal is owned by the fund, controlled by the player and paid mostly by LPs', r.fundBuy.owned && r.fundBuy.lpPaid && r.fundBuy.nav, JSON.stringify(r.fundBuy));
  ok('PE fund: waterfall pays 20% carry once LPs have capital back plus 8%', Math.abs(r.carry.carry - r.carry.expect) < 1e-6 && Math.abs(r.carry.playerGot - r.carry.gpShare) < 1e-6, JSON.stringify(r.carry));
  ok('IRR: 100 → 286 over three years is about 41.9% a year', Math.abs(r.irr - .419) < .002, String(r.irr));
  ok('PE: the rivals bid in auctions that suit their style', r.rivalBid);
  ok('PE: an unclaimed deal goes to the best outside bidder, who owns and runs it', r.aiWon && r.aiWon.priv && r.aiWon.owner === r.aiWon.ctrl, JSON.stringify(r.aiWon));
  ok('PE co-investment: an AI firm takes 25%, the player keeps control and pays 75%', r.co.bid && Math.abs(r.co.mine - .75) < 1e-6 && Math.abs(r.co.partner - .25) < 1e-6 && r.co.ctrl === 'P' && Math.abs(r.co.inv - .75) < 1e-6, JSON.stringify(r.co));
  ok('PE secondary: an AI firm offers its company to the player first, and buying it starts a new investment', r.sec && r.sec.offered && r.sec.bought && r.sec.owner === 'P' && r.sec.type === 'sec' && r.sec.firmPaid, JSON.stringify(r.sec));
  // long run with a PE-playing bot: nothing breaks
  const l = await p.evaluate(inv => { const A = window.__atlas; A.newGame(6262, 'hard', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 300; let bought = 0, sold = 0;
    for (let w = 0; w < 520; w++) { A.step();
      for (const it of S.inbox.filter(i => i.kind === 'peexit')) { const c = S.cos.find(x => x.id === it.cid); if (c && A.peSell(c, it.bids[0])) sold++; }
      S.inbox = [];
      if (w % 3 === 0) { const d = S.pe.deals.find(x => !x.bid && x.dd === 0); if (d) A.peDD(d); const e = S.pe.deals.find(x => !x.bid && x.dd === 2); if (e && A.peBid(e, .05, .5, false, 'P')) bought++; }
      for (const c of S.cos) if (c.pe && !c.pe.closed && c.priv && c.ctrl === 'P' && (S.week - c.pe.w0) > 150 && !c.pe.sale) A.peExitStart(c);
    }
    return {bought, sold, track: S.pe.track.length, bad: (0, eval)('(' + inv + ')')(), nw: A.netWorth('P')}; }, INVARIANTS.toString());
  console.log('PE bot over 10 hard years: ' + JSON.stringify({bought: l.bought, sold: l.sold, track: l.track, nw: Math.round(l.nw)}));
  ok('PE: invariants hold over 10 years of buying and selling', !l.bad.length && Number.isFinite(l.nw) && l.bought > 0, l.bad.slice(0, 5).join(', '));
  // the PE tab on a phone
  const m = await page(b, devices['iPhone 13']);
  await m.p.evaluate(() => { const A = window.__atlas; A.newGame(6363, 'normal', 'T', 't', 'std', true); A.S.lost = true; for (let i = 0; i < 40 && A.S.pe.deals.length < 2; i++) A.peDealGen(); document.querySelector('#modal').hidden = true; });
  await m.p.click('[data-act=tab][data-v=pe]');
  await m.p.click('.deal-h[data-act=peopen]');
  const u = await m.p.evaluate(() => ({deals: document.querySelectorAll('.deal').length, bidBtn: !!document.querySelector('[data-act=pebid]'), o: document.documentElement.scrollWidth - innerWidth}));
  ok('iPhone: the PE tab lists deals, opens one with bid controls and does not overflow', u.deals >= 2 && u.bidBtn && u.o <= 0, JSON.stringify(u));
  ok('no page errors in PE tests', !errs.length && !m.errs.length, errs.concat(m.errs).slice(0, 3).join(' | '));
  await m.ctx.close(); await ctx.close();
}

// Simple value bot used since the first version: buys cheap stocks, sells rich ones, milks controlled companies.
async function balance(b) {
  const {p, ctx} = await page(b);
  const res = await p.evaluate(quick => {
    const A = window.__atlas, out = {};
    for (const d of ['easy', 'normal', 'hard']) for (const sd of quick ? [1] : [1, 2, 3]) {
      A.newGame(sd * 7919, d, 'T', 't', 'std', true); const S = A.S; let hit = null;
      for (let w = 0; w < 780; w++) { A.step(); S.inbox = [];
        if (w % 2 === 0) {
          const nw = A.netWorth('P');
          for (const c of S.cos.slice()) if (c.own.P && c.ctrl !== 'P' && c.price > A.fair(c) * 1.12) { const n = c.own.P, np = c.price / (1 + .9 * n / c.shares); S.player.cash += (c.price + np) / 2 * n * .9975; c.price = np; delete c.own.P; delete S.player.cost[c.id]; }
          for (const c of S.cos) if (c.ctrl === 'P' && c.cash > 5) { const a = c.cash * .8; c.cash -= a; S.player.cash += a * (c.own.P || 0) / c.shares; }
          const pay = Math.min(S.player.cash, S.player.loan); S.player.cash -= pay; S.player.loan -= pay;
          let best = null, bs = 1.15; for (const c of S.cos) { if (c.ctrl && c.ctrl !== 'P') continue; const s = A.fair(c) / c.price; if (s > bs && c.price * c.shares < nw * 4) { bs = s; best = c; } }
          if (best && S.player.cash > 1) A.execBuy('P', best, Math.min(S.player.cash * 1.6, best.price * best.shares * .1) / best.price / 1.05);
        }
        if (!hit && A.netWorth('P') >= 1000) hit = w / 52;
      }
      (out[d] = out[d] || []).push({hit, rivals: S.rivals.map(r => Math.round(A.netWorth(r.id)))});
    }
    return out;
  }, QUICK);
  const summary = {};
  for (const d in res) { const hits = res[d].map(x => x.hit == null ? 15 : x.hit); const riv = res[d].map(x => Math.max(...x.rivals)); summary[d] = {botYears: hits.map(h => +h.toFixed(1)), topRival: riv}; }
  console.log('BALANCE ' + JSON.stringify(summary));
  if (fs.existsSync(BASELINE) && !args.has('--update-baseline')) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    for (const d in summary) {
      if (!base[d]) continue;
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const by = avg(summary[d].botYears), bb = avg(base[d].botYears);
      console.log(`${Math.abs(by / bb - 1) <= .4 ? 'INFO' : 'WARN'}  balance ${d}: bot reaches the goal in ${by.toFixed(1)}y on average (baseline ${bb.toFixed(1)}y)`);
    }
  }
  if (args.has('--update-baseline') && !QUICK) { fs.writeFileSync(BASELINE, JSON.stringify(summary, null, 2) + '\n'); console.log('wrote baseline.json'); }
  await ctx.close();
}

(async () => {
  const b = await chromium.launch();
  try {
    if (args.has('--make-fixture')) await makeFixture(b);
    await testDeterminism(b);
    await testInvariants(b);
    await testOldSaves(b);
    await testSaveSafety(b);
    await testUI(b);
    await testMarkets(b);
    await testPhase2(b);
    await testPhase3(b);
    await testPhase4(b);
    await testPhase5(b);
    await testPhase6(b);
    await testResearch(b);
    await testPE(b);
    await balance(b);
  } finally { await b.close(); }
  console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
  process.exit(failures ? 1 : 0);
})();
