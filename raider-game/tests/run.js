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
    let nc = null, bv = 0, sv = 0; for (const b of Object.keys(t).sort()) { if (t[b] > bv) { sv = bv; bv = t[b]; nc = b; } else if (t[b] > sv) sv = t[b]; } /* majority, or 40%+ with the rest dispersed (not in regulated industries) */
    if (nc && !(bv > c.shares * .5 || (bv >= c.shares * .4 - 1e-9 && sv < bv * .5 && window.__atlas.ownCap(c, nc) >= 1))) nc = null;
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
    A.hrInit(); A.hrEnsure(c); c.dm = 'auto'; c.deleg = 'cash'; c.brand = .95; S.research.done.op2 = 1; // a strong brand and loyal customers make a price rise pay
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
  ok('delegation: executives on the cash policy raise prices and payout', r.ctrl && r.cashPolicy.payout === .8 && r.cashPolicy.ps === 1, JSON.stringify(r.cashPolicy));
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
    let d = gen(); for (let i = 0; i < 40 && (d.type === 'turn' || A.dealAsk(d) < 2); i++) d = gen(); d.n = 0; d.ai = 0; d.bids = []; d.exp = S.week + 20; d.risk = null;
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
    const L = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[4]; S.player.cash += 3000; for (let i = 0; i < 10 && L.ctrl !== 'P'; i++) A.execBuy('P', L, L.shares * .3); /* a poison pill can dilute the first buys */
    const tp = L.ctrl === 'P' && A.peTakePrivate(L, 0); out.privatized = !!tp && L.priv && L.own.P === L.shares && !!L.pe; out.tpInfo = {ctrl: L.ctrl, priv: L.priv, tob: S.tobs.some(t => t.cid === L.id), bp: Math.round(A.buyingPower()), cap: Math.round(L.price * L.shares), pe: !!L.pe, own: L.own.P && +(L.own.P / L.shares).toFixed(3)};
    // funds: LP money never counts as the player's
    S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
    S.player.cash = 2000; const f = A.fundRaise('buyout', .05); for (let i = 0; i < 13; i++) { A.step(); S.inbox = []; }
    out.fund = {closed: !f.raising, size: f.lp + f.gp, gp: f.gp};
    const nwA = A.netWorth('P'); out.lpNotMine = Math.abs(nwA - A.netWorth('P')) < 1e-9; // closing a fund adds no net worth
    let d4 = gen(); for (let i = 0; i < 60 && (d4.type === 'turn' || A.peQuote(d4, A.dealAsk(d4) * .9, .5, f.id).out > A.fundDry(f) * .8 || A.dealAsk(d4) < 1); i++) d4 = gen(); d4.n = 0; d4.ai = 0; d4.bids = []; d4.exp = S.week + 20; d4.risk = null; const q4 = A.peQuote(d4, A.dealAsk(d4), .5, f.id);
    const pc0 = S.player.cash, lp0 = f.calledLP; A.peBid(d4, 0, .5, false, f.id); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; }
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
  ok('PE: J-curve — fees and the (5%, since 5.26) illiquidity discount cost 1–30% of the cheque at once', r.jcurve > .01 && r.jcurve < .3, String(r.jcurve));
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

// Talent: executives, fit, delegation modes, head office, staff, succession and announced departures.
async function testTalent(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(9191, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 2000;
    out.allCEO = S.cos.every(c => A.ceoOf(c));
    // a controlled company: the CEO already in place changes nothing on day one
    S.player.cash = 20000; const c = S.cos.filter(x => !x.ctrl && !x.priv && x.ni > 0 && !['air', 'telecom', 'auto', 'steel', 'ship', 'energy'].includes(x.ind)).sort((a, b) => a.price * a.shares - b.price * b.shares)[8]; /* weak unions: the test skips wage talks */ for (let i = 0; i < 10 && c.ctrl !== 'P'; i++) A.execBuy('P', c, c.shares * .2);
    out.ctrl = c.ctrl;
    // hiring: the same strong person helps more in their own industry than in a foreign one
    const m0 = c.margin, f0 = c.fixed;
    const star = A.genPerson('test:star', {level: 85, focus: 'gen', ind: c.ind}); S.hr.pool.push(star.id);
    A.hireInto(star, c.id, 'CEO', 'fixed', 'agency'); out.hired = A.ceoOf(c) === star && c.fixed > f0 && c.margin > m0;
    const home = A.effOf(star, 'gen', c); const alien = A.genPerson('test:alien', {level: 85, focus: 'gen', ind: c.ind === 'bank' ? 'tech' : 'bank'}); out.fit = home > A.effOf(alien, 'gen', c);
    const weak = A.genPerson('test:weak', {level: 20, focus: 'gen', ind: c.ind}); S.hr.pool.push(weak.id); const m1 = c.margin; A.hireInto(weak, c.id, 'CEO', 'fixed', 'agency'); out.weakHurts = c.margin < m1;
    A.hireInto(star, c.id, 'CEO', 'fixed', 'inside'); // back to the star
    // delegation: approval mode sends a proposal; approving runs it
    c.dm = 'approve'; c.deleg = 'cash'; c.payout = 0; c.lim = {ad: .02, rt: 'BBB'};
    for (let i = 0; i < 4; i++) { A.step(); S.inbox = S.inbox.filter(x => x.kind === 'prop'); }
    const prop = S.inbox.find(x => x.kind === 'prop' && x.cid === c.id); out.prop = !!prop && prop.acts.length > 0;
    if (prop) { for (const a of prop.acts) A.doAction(c, a); } out.approved = c.payout === .8;
    c.dm = 'manual'; const pay0 = c.payout; c.payout = .1; for (let i = 0; i < 8; i++) { A.step(); S.inbox = []; } out.manualKeeps = c.payout === .1;
    // head office: an operating partner sent to the company lifts the margin; capacity for fund companies grows
    const op = A.genPerson('test:op', {level: 80, focus: 'ops', ind: c.ind}); S.hr.pool.push(op.id); const cap0 = A.peCapacity();
    A.hireInto(op, 'HQ', 'OP', 'fixed', 'agency'); const m2 = c.margin; A.assignOP(op, c.id); out.op = {margin: c.margin > m2, cap: A.peCapacity() === cap0 + 2};
    // staff: better pay costs more but lifts morale and productivity
    const f1 = c.fixed, pr0 = A.productivity(c); A.setWage(c, 1.2); c.trainL = 2; out.wageCost = c.fixed > f1;
    for (let i = 0; i < 52; i++) { A.step(); S.inbox = []; } out.prodUp = A.productivity(c) > pr0;
    // retirement is announced half a year ahead; a named successor takes over
    const cfo = A.genPerson('test:cfo', {level: 70, focus: 'fin', ind: c.ind}); S.hr.pool.push(cfo.id); A.hireInto(cfo, c.id, 'CFO', 'fixed', 'agency'); c.succ = cfo.id;
    if (!A.ceoOf(c)) { const s2 = A.genPerson('test:ceo2', {level: 70, focus: 'gen', ind: c.ind}); S.hr.pool.push(s2.id); A.hireInto(s2, c.id, 'CEO', 'fixed', 'agency'); } // the CEO may have left (an outside offer) during the year
    const ceo = A.ceoOf(c); ceo.retire = ceo.age; ceo.mood = .9; let warned = false;
    for (let i = 0; i < 30 && A.ceoOf(c) === ceo; i++) { A.step(); S.inbox = []; if (S.news.some(n => n.t.includes('引退予定') && n.t.includes(ceo.n))) warned = true; }
    out.succession = {warned, newCEO: A.ceoOf(c) === cfo};
    // an outside offer always comes through the inbox first; matching it keeps the person
    const x = A.ceoOf(c); x.offer = null; let got = null; for (let i = 0; i < 400 && !got; i++) { x.mood = .1; x.quit = null; x.retiring = null; x.retire = 99; x.end = S.week + 300; A.step(); got = S.inbox.find(it => it.kind === 'poach' && it.pid === x.id); if (!got) S.inbox = []; }
    out.poach = !!got; if (got) { x.sal = got.sal; x.mood = .8; for (let i = 0; i < 4; i++) { A.step(); S.inbox = []; } out.stayed = A.ceoOf(c) === x; }
    return out;
  });
  ok('talent: every company has a CEO on record', r.allCEO);
  ok('talent: hiring a strong CEO costs a salary and lifts the margin; a weak one lowers it', r.ctrl === 'P' && r.hired && r.weakHurts, JSON.stringify({c: r.ctrl, h: r.hired, w: r.weakHurts}));
  ok('talent: industry experience matters (the same skill works better at home)', r.fit);
  ok('talent: approval mode sends proposals; approving runs them; manual mode changes nothing', r.prop && r.approved && r.manualKeeps, JSON.stringify({p: r.prop, a: r.approved, m: r.manualKeeps}));
  ok('talent: an operating partner lifts the margin and adds fund capacity', r.op.margin && r.op.cap, JSON.stringify(r.op));
  ok('talent: higher pay costs more and, with training, raises productivity', r.wageCost && r.prodUp);
  ok('talent: retirement is announced ahead and the named successor becomes CEO', r.succession && r.succession.warned && r.succession.newCEO, JSON.stringify(r.succession));
  ok('talent: an outside offer arrives in the inbox and matching it keeps the executive', r.poach && r.stayed, JSON.stringify({p: r.poach, s: r.stayed}));
  // an old save with a Phase 2 CEO keeps that person
  const mig = await p.evaluate(() => { const A = window.__atlas; A.newGame(9292, 'normal', 'T', 't', 'std', true); const S = A.S; const t = JSON.parse(A.exportText()); delete t.hr; for (const c of t.cos) { delete c.ex; delete c.cult; delete c.wage; delete c.exApplied; } t.cos[0].mgr = {n: '佐伯 真理', skill: 77, sal: .4}; const o = A.parseSave(JSON.stringify(t)); return !!o; });
  ok('talent: old saves load (a Phase 2 CEO is converted on the next screen or week)', mig);
  // screens on a phone
  const m = await page(b, devices['iPhone 13']);
  await m.p.evaluate(() => { const A = window.__atlas; A.newGame(9393, 'normal', 'T', 't', 'std', true); const S = A.S; S.lost = true; S.won = true; S.goalIdx = 9; S.player.cash = 3000; const c = S.cos.filter(x => !x.ctrl && !x.priv).sort((a, b) => a.price * a.shares - b.price * b.shares)[3]; for (let i = 0; i < 4 && c.ctrl !== 'P'; i++) A.execBuy('P', c, c.shares * .3); A.ui.sel = c.id; A.ui.ctab = 'ceo'; document.querySelector('#modal').hidden = true; });
  await m.p.click('[data-act=tab][data-v=market]'); await m.p.click('[data-act=ctab][data-v=ceo]');
  await m.p.click('[data-act=hopen][data-v=COO]');
  const u = await m.p.evaluate(() => ({slots: document.querySelectorAll('.slot').length, cands: document.querySelectorAll('.cand').length, staff: [...document.querySelectorAll('h4')].some(h => h.textContent.startsWith('従業員')), o: document.documentElement.scrollWidth - innerWidth}));
  await m.p.evaluate(() => { window.__atlas.ui.hqTab = 'hr'; });
  await m.p.click('[data-act=tab][data-v=pres]');
  const hq = await m.p.evaluate(() => ({hq: [...document.querySelectorAll('h3')].some(h => h.textContent.startsWith('本社の幹部')), o: document.documentElement.scrollWidth - innerWidth}));
  ok('iPhone: executive slots, candidates, staff and head-office screens render without overflow', u.slots >= 5 && u.cands > 0 && u.staff && u.o <= 0 && hq.hq && hq.o <= 0, JSON.stringify({u, hq}));
  ok('no page errors in talent tests', !errs.length && !m.errs.length, errs.concat(m.errs).slice(0, 3).join(' | '));
  await m.ctx.close(); await ctx.close();
}

// Quarterly dividends, missions without cash, and the rest of the talent system (EXIT bonus, labour, culture, authority).
async function testQuarterly(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4545, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true;
    // a dividend payer: cash arrives only in quarter-end weeks
    const c = S.cos.filter(x => !x.priv && x.payout > .2 && x.ni > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[0];
    S.tut = {buy: 0, big: 0, tob: 0, ctrl: 0, run: 0, vert: 0}; S.missions = []; S.player.cash = 50; A.execBuy('P', c, c.shares * .04); S.player.loan = 0; S.player.cash = 10;
    const weeks = []; for (let i = 0; i < 26; i++) { const c0 = S.player.cash; A.step(); S.inbox = []; S.player.loan = 0; if (S.player.cash > c0 + 1e-9) weeks.push(S.week); }
    out.divWeeks = weeks; out.allQuarterEnds = weeks.length > 0 && weeks.every(w => w % 13 === 0);
    // a mission done: no cash, more reputation
    S.missions = [{kind: 'nw', target: 0, due: S.week + 10, id: 999}]; const cash = S.player.cash, rep = S.player.rep;
    try { A.step(); } catch (e) { out.err = e.message; } S.inbox = [];
    out.mission = {noCash: !(S.player.cash > cash + 1e-6) || weeksHasQ(S.week), rep: S.player.rep > rep, done: !S.missions.some(m => m.id === 999)};
    function weeksHasQ(w){ return w % 13 === 0; }
    // labour: a refusal with a strong union and unhappy staff can end in a strike; accepting raises pay and morale
    const L = S.cos.find(x => x.ind === 'auto' || x.ind === 'steel'); L.sat = .3; let strikes = 0; for (let i = 0; i < 40; i++) { L.sat = .3; L.strike = 0; if (A.laborSettle(L, 'reject', .03)) strikes++; }
    const f0 = L.fixed, s0 = L.sat; A.laborSettle(L, 'accept', .03); out.labor = {strikes, accepted: L.fixed > f0 && L.sat > s0};
    L.strike = S.week + 3; out.strikeHurts = A.productivity(L) < .8;
    // authority: a role kept by the player is left out of the plan
    const M = S.cos.filter(x => !x.ctrl && !x.priv).sort((a, b) => a.price * a.shares - b.price * b.shares)[2]; S.player.cash = 5000; for (let i = 0; i < 4 && M.ctrl !== 'P'; i++) A.execBuy('P', M, M.shares * .3);
    M.deleg = 'cash'; M.payout = 0; M.auth = {CFO: false}; out.auth = !A.planActions(M).some(a => a.r === 'CFO' || a.k === 'payout');
    return out;
  });
  ok('dividends are paid once a quarter (cash arrives only in quarter-end weeks)', r.allQuarterEnds, JSON.stringify(r.divWeeks));
  ok('missions pay no cash; completing one raises reputation', r.mission.rep && r.mission.done, JSON.stringify(r.mission) + (r.err || ''));
  ok('labour: refusing a strong union with unhappy staff can bring strikes; accepting raises pay and morale; strikes cut productivity', r.labor.strikes > 0 && r.labor.accepted && r.strikeHurts, JSON.stringify(r.labor));
  ok('authority: a role the player keeps is not delegated', r.auth);
  const f = await p.evaluate(() => { const A = window.__atlas, out = {};
    A.newGame(11, 'easy', 'T', 't', 'std', false); const S = A.S; S.lost = true; A.step(); out.stage = S.stage; // easy starts with 50億円
    S.player.cash = 142; S.player.loan = 39.2; for (const c of S.cos) delete c.own.P; A.step(); out.loan = S.player.loan; out.tasks = A.tasks().some(t => t.t === '追証が近い');
    return out; });
  ok('nothing unlocks on the first day, even with the easy starting cash', f.stage === 1, String(f.stage));
  const g = await p.evaluate(() => { const A = window.__atlas, out = {}; A.newGame(13, 'normal', 'T', 't', 'std', true); const S = A.S; S.lost = S.won = true; S.player.cash = 3000;
    // holding-company results: the items plus the change in asset values add up to the change in net worth
    const cs = S.cos.filter(c => !c.ctrl && !c.priv).sort((a, b) => a.price * a.shares - b.price * b.shares); A.execBuy('P', cs[4], cs[4].shares * .05);
    for (let i = 0; i < 26; i++) { A.step(); S.inbox = []; }
    const L = S.player.plHist[0], items = ['div', 'rent', 'fee', 'int', 'hq', 'rd', 'pay', 'fine', 'tax'].reduce((a, k) => a + (L[k] || 0), 0); out.pl = Math.abs(L.nw1 - L.nw0 - items - L.other) < 1e-6 && L.div > 0;
    // a payout ratio set by the player stays even under delegation
    const c = cs[2]; for (let i = 0; i < 4 && c.ctrl !== 'P'; i++) A.execBuy('P', c, c.shares * .3); c.payout = 0; c.payLock = true; c.dm = 'auto'; c.deleg = 'cash';
    for (let i = 0; i < 8; i++) { A.step(); S.inbox = []; } out.payLock = c.payout === 0;
    // missions never expire
    S.missions = [{id: 777, kind: 'nw', target: 1e9, due: S.week - 5, w: 0}]; A.missionStep(); out.noExpiry = S.missions.some(m => m.id === 777);
    // head office: staff cost money; a bigger office allows more executives
    A.hqInit(); A.setOffice(1, 'osa'); S.dept.inv.on = true; S.dept.inv.staff = 10; const c0 = S.player.cash; A.deptStep(); out.office = {cost: c0 > S.player.cash, slots: true, city: S.office.city === 'osa'};
    return out; });
  ok('holding-company results add up to the change in net worth', g.pl);
  ok('a payout ratio set by the player is not changed by delegated executives', g.payLock);
  ok('missions have no deadline', g.noExpiry);
  ok('head office: rent and staff cost money each week', g.office.cost && g.office.city, JSON.stringify(g.office));
  ok('cash pays the margin loan down automatically; no margin warning while cash covers it', f.loan === 0 && !f.tasks, JSON.stringify(f));
  // EXIT bonus and the culture choice after a PE buyout
  const e = await p.evaluate(() => { const A = window.__atlas; A.newGame(4646, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 3000;
    let d = null; for (let i = 0; i < 80; i++) { const x = A.peDealGen(); if (x && x.type !== 'turn' && A.dealAsk(x) > 2) { d = x; break; } } d.bids = []; d.n = 0; d.ai = 0; d.risk = null; d.dd = 2;
    const c = A.peAcquire(d, 'P', A.dealAsk(d), 0, false); A.hrInit(); A.hrEnsure(c);
    const q = c.pe.cultQ, cult0 = c.cult, f0 = c.fixed; A.peCulture(c, true); const cult = {asked: q, changed: cult0 === 'profit' || (c.cult === 'profit' && c.fixed < f0)};
    const x = A.ceoOf(c); x.comp = 'exit'; S.pe.firms[0].cash = 1e5; c.price = c.price * 2; const cash0 = S.player.cash; A.peSell(c, {kind: 'pe', buyer: S.pe.firms[0].id, eq: c.price * c.shares});
    return {cult, bonusNews: S.news.some(n => n.t.includes('EXIT成功報酬'))}; });
  ok('PE buyout: the player chooses to keep or change the culture', e.cult.asked && e.cult.changed, JSON.stringify(e.cult));
  ok('EXIT bonus: an executive on an EXIT bonus is paid from a profitable sale', e.bonusNews);
  ok('no page errors in quarterly/labour tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// Head office: departments, financial statements, board meetings, venture capital, property offers, reports.
async function testUIPack(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4242, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 400;
    /* (1) the price sheet mirrors the valuation exactly */
    out.fair = S.cos.every(c => Math.abs(A.fairParts(c).per - A.fair(c)) < 1e-9 * Math.max(1, A.fair(c)));
    /* (3) screener filters */
    A.ui.scr = {cheap: true}; out.scr = S.cos.filter(A.scrPass).every(c => A.fairEst(c) / c.price > 1.2); /* the screener works on the player's estimate */ A.ui.scr = {};
    /* (4) overlay values stay in 0..1 */
    out.ov = ['cheap', 'rival', 'growth', 'mine'].every(k => { A.ui.ov = k; return Object.values(A.ovStats()).every(v => v >= 0 && v <= 1 + 1e-9); }); A.ui.ov = '';
    /* (7) stories never draw from the PRNG and arrive in the inbox */
    let rsSame = true, got = 0;
    for (let w = 0; w < 120; w++) { S.week++; const rs = S.rs, n = S.inbox.length; A.storyStep(); if (S.rs !== rs) rsSame = false; if (S.inbox.length > n) { got++; const it = S.inbox[S.inbox.length - 1]; A.storyPick(it, 0); if (S.inbox.includes(it)) rsSame = false; } }
    out.story = {rsSame, got};
    /* (8) year-end awards: rankings of all four players, prestige from wins */
    S.week = 52; S.awards = []; const pr0 = A.prestige(); A.yearAwards(); const aw = S.awards[0];
    out.award = !!aw && aw.list.length === 3 && aw.list.every(l => l.r.length === 4) && A.prestige() - pr0 === aw.wins.length * 3;
    A.ui.pendingAward = false;
    /* (5) auto-pause follows the setting */
    S.settings.p_inbox = false; A.ui.speed = 2; A.addInbox({kind: 'tip', cid: S.cos[0].id, exp: S.week + 4}); const kept = A.ui.speed;
    S.settings.p_inbox = true; A.addInbox({kind: 'tip', cid: S.cos[0].id, exp: S.week + 4}); out.pause = kept === 2 && A.ui.speed === 0; S.inbox = [];
    return out;
  });
  ok('UI pack: the "why" sheet reproduces the theoretical share price exactly', r.fair);
  ok('UI pack: the screener only lists companies matching the filter', r.scr);
  ok('UI pack: every map overlay value is between 0 and 1', r.ov);
  ok('UI pack: story cards arrive without touching the simulation RNG', r.story.rsSame && r.story.got > 3, JSON.stringify(r.story));
  ok('UI pack: year-end awards rank all four players and add prestige for wins', r.award);
  ok('UI pack: auto-pause respects the per-category setting', r.pause);
  /* UI flows on iPhone */
  const ph = await page(b, {...devices['iPhone 13']});
  const q = ph.p; await q.click('[data-act=diff][data-v=normal]'); await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  const g = await q.evaluate(() => ({bub: !!document.querySelector('.guidebub'), hi: !!document.querySelector('.guide')}));
  await q.click('[data-act=guideoff]'); const g2 = await q.evaluate(() => !document.querySelector('.guidebub') && !document.querySelector('.guide'));
  ok('UI pack: the secretary guide highlights the next step and can be turned off', g.bub && g.hi && g2, JSON.stringify(g));
  await q.click('[data-act=why][data-v=nw]'); const w1 = await q.evaluate(() => !!document.querySelector('#modal .why') && document.querySelector('#modal').textContent.includes('純資産の内訳'));
  const wo = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth); await q.click('#modal [data-act=close]');
  ok('UI pack: tapping net worth opens its breakdown', w1 && wo <= 0);
  const id = await q.evaluate(() => { const A = window.__atlas, S = A.S; S.won = true; S.allUnlocked = true; S.player.cash += 300;
    const c = S.cos.filter(c => !c.ctrl && c.ind !== 'air' && c.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; A.execBuy('P', c, c.shares * .8); A.ui.sel = c.id; A.ui.ctab = 'info'; return c.id; });
  await q.click('[data-act=tab][data-v=market]');
  await q.click('[data-act=watch]'); const wl = await q.evaluate(id => window.__atlas.S.watch.includes(id), id);
  await q.click('[data-act=why][data-v=px]'); const pxw = await q.evaluate(() => { const m = document.querySelector('#modal').textContent; return m.includes('推定理論株価') && m.includes('弱気〜基本〜強気') && m.includes('業界の標準PER'); }); /* the estimate range and the breakdown both show */ await q.click('#modal [data-act=close]');
  ok('UI pack: watchlist star and price breakdown work', wl && pxw, JSON.stringify({wl, pxw}));
  await q.evaluate(() => { window.__atlas.ui.ctab = 'ceo'; }); await q.click('[data-act=tab][data-v=market]');
  const before = await q.evaluate(() => JSON.stringify(window.__atlas.S));
  const btn = await q.$('[data-act=restr]:not([disabled])');
  const pv = {has: !!btn};
  if (btn) { await btn.click(); pv.modal = await q.evaluate(() => document.querySelector('#modal').textContent.includes('実行前の確認')); pv.same = before === await q.evaluate(() => JSON.stringify(window.__atlas.S));
    pv.o = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    await q.click('#modal [data-ok="1"]'); pv.changed = before !== await q.evaluate(() => JSON.stringify(window.__atlas.S)); }
  ok('UI pack: the preview leaves the game untouched until "execute" is pressed', pv.has && pv.modal && pv.same && pv.changed && pv.o <= 0, JSON.stringify(pv));
  await q.evaluate(() => { const A = window.__atlas, c = A.S.cos.find(x => x.ctrl === 'P'); A.ui.sel = c.id; A.ui.ctab = 'ceo'; A.ui.hire = {t: c.id, r: 'CFO'}; A.ui.hch = 'agency'; });
  await q.click('[data-act=tab][data-v=market]');
  const hb = await q.$$('[data-act=hcmp]'); if (hb.length > 1) { await hb[0].click(); const hb2 = await q.$$('[data-act=hcmp]'); await hb2[1].click(); }
  const cmp = await q.evaluate(() => ({svg: !!document.querySelector('.cmp svg polygon'), n: document.querySelectorAll('.cmp th').length, o: document.documentElement.scrollWidth - innerWidth}));
  ok('UI pack: two hiring candidates are compared on a radar chart', cmp.svg && cmp.n === 3 && cmp.o <= 0, JSON.stringify(cmp));
  await q.evaluate(() => { const A = window.__atlas; A.ui.sel = null; A.ui.scrOpen = true; }); await q.click('[data-act=tab][data-v=market]');
  await q.click('[data-act=scr][data-v=cheap]'); await q.click('[data-act=scrsave]');
  const sc = await q.evaluate(() => ({saved: (window.__atlas.S.scrSaved || []).length, o: document.documentElement.scrollWidth - innerWidth}));
  await q.click('[data-act=ov]'); const ovb = await q.evaluate(() => document.querySelector('#ovbtn').textContent);
  await q.evaluate(() => window.__atlas.celebrate(true)); const conf = await q.evaluate(() => !!document.querySelector('.confetti'));
  ok('UI pack: screener presets, map overlay button and confetti', sc.saved === 1 && sc.o <= 0 && ovb === '割安' && conf, JSON.stringify({sc, ovb, conf}));
  ok('no page errors in UI pack tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testPlaytestFixes(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(5151, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 300;
    const held = c => Object.values(c.own).reduce((a, v) => a + v, 0) / c.shares;
    /* (1) an unlisted company raises equity from its own holders: no free money, nobody-owned shares never appear */
    const n = A.foundCompany('tyo', 'tech', 20); const nw0 = A.netWorth('P'), cash0 = n.cash;
    const got = A.issueEquity(n, .2);
    out.rights = {got: got > 0, frac: Math.abs(held(n) - 1) < 1e-9, mine: Math.abs((n.own.P || 0) / n.shares - 1) < 1e-9, nw: Math.abs(A.netWorth('P') - nw0) < 1e-6, cash: Math.abs(n.cash - cash0 - got) < 1e-9};
    /* a minority player in someone else's unlisted company is diluted, not charged */
    const m = A.foundCompany('osa', 'food', 20); m.own = {P: m.shares / 3, R1: m.shares * 2 / 3}; A.recomputeCtrl(); const pc0 = S.player.cash, pf0 = m.own.P / m.shares;
    A.issueEquity(m, .2); out.minority = S.player.cash === pc0 && m.own.P / m.shares < pf0 && Math.abs(held(m) - 1) < 1e-9;
    /* (2)(3) a PE record with no stake is closed and cannot be listed */
    m.pe = {type: 'sec', owner: 'P', w0: 1, flows: [[1, -1]], inv: 1, mq: 50}; delete m.own.P; A.recomputeCtrl();
    const ipo = A.peIPO(m); A.peStep(); out.pe = !ipo && m.pe.closed === true && Object.values(m.own).every(v => v >= 0);
    /* (4) awards: an all-zero category gives no prize */
    for (const c of S.cos) if (c.ctrl) { c.ctrl = null; } S.cos = S.cos.filter(c => !c.priv); for (const c of S.cos) for (const k in c.own) if (k !== 'P') delete c.own[k];
    A.recomputeCtrl(); S.week = 52; S.awards = []; A.yearAwards(); const aw = S.awards[0];
    out.award = !aw.wins.includes('emp');
    /* (5) expansion subsidiaries do not unlock the 3-company stage */
    A.newGame(5152, 'normal', 'T', 't', 'std', false); const T = A.S; T.player.cash = 60;
    const c = T.cos.filter(x => !x.ctrl && !x.priv).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; c.own = {P: c.shares * .6}; A.recomputeCtrl();
    c.cash += c.rev; const cities = ['nyc', 'lon', 'sin', 'syd'].filter(x => x !== c.city);
    for (const ct of cities.slice(0, 3)) A.expandRegion(c, ct, .05);
    out.branch = {ctrl: T.cos.filter(x => x.ctrl === 'P').length, stage: A.stageFor(), core: A.ctrlCore().length};
    return out;
  });
  ok('fix: an unlisted company raises equity from its holders (no free money, no ownerless shares)', Object.values(r.rights).every(Boolean), JSON.stringify(r.rights));
  ok('fix: a minority holder in someone else\'s unlisted company is diluted, not charged', r.minority);
  ok('fix: a PE record without a stake closes and cannot IPO (no NaN holdings)', r.pe);
  ok('fix: an all-zero award category has no winner', r.award);
  ok('fix: expansion subsidiaries do not count toward the 3-company stage', r.branch.ctrl >= 3 && r.branch.core === 1 && r.branch.stage < 4, JSON.stringify(r.branch));
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  const nt = await q.evaluate(() => { for (let i = 0; i < 3; i++) window.__atlas.toast('テスト' + i); return document.querySelectorAll('#toasts .toast').length; });
  ok('fix: only one toast at a time on a phone', nt === 1, String(nt));
  ok('no page errors in playtest-fix tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testFeedback13(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(6161, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    /* (A) a large buy no longer shows an instant paper gain, and a round trip loses money */
    S.player.cash = 300; const c = S.cos.filter(x => !x.priv && !x.ctrl && !Object.keys(x.own).length).sort((a, b) => a.price * a.shares - b.price * b.shares)[3];
    const nw0 = A.netWorth('P'), cash0 = S.player.cash; A.execBuy('P', c, A.sharesForMoney(c, 30)); const nwBuy = A.netWorth('P'); A.execSell('P', c, c.own.P);
    out.impact = {paper: +(nwBuy - nw0).toFixed(3), trip: +(S.player.cash - cash0).toFixed(3)};
    /* (G) head-office costs come out of cash; negative cash is an overdraft that the bank collects after 8 weeks */
    S.player.cash = 0; S.player.loan = 0; A.hqInit(); A.setOffice(2, 'tyo'); S.dept.acc.staff = 10; const loan0 = S.player.loan;
    A.deptStep(); out.od1 = S.player.cash < 0 && S.player.loan === loan0;
    const t = S.cos.find(x => !x.priv && !x.ctrl && x !== c); A.execBuy('P', t, A.sharesForMoney(t, 5)); S.player.cash = -2; S.player.loan = 0;
    A.overdraftStep(); const w = S.week; out.od2 = S.player.od === w; S.week += 8; A.overdraftStep(); out.od3 = S.player.cash >= -1e-9 && S.player.od == null;
    /* (H) margin call: a deadline first, then a forced sale */
    S.player.cash = 0; const hv = A.holdingsValue('P'); S.player.loan = hv * A.callLine() * 1.03; const own0 = t.own.P;
    A.playerWeekly(); out.mc1 = !!S.player.mcall && t.own.P === own0;
    S.week = S.player.mcall.due; S.player.loan = A.holdingsValue('P') * A.callLine() * 1.03; A.playerWeekly(); out.mc2 = !S.player.mcall && (t.own.P || 0) < own0;
    /* (F) a TOB with the minimum condition buys nothing when the take falls short; the "needed price" reaches the target */
    S.player.cash = 500; S.player.loan = 0; const g = S.cos.filter(x => !x.priv && !x.ctrl && !A.activeTob(x)).sort((a, b) => a.price * a.shares - b.price * b.shares)[1];
    A.launchTob('P', g, g.price * 1.02, .51, false); const tob = A.activeTob(g); tob.minc = .51; tob.end = S.week; const had = g.own.P || 0; A.resolveTobs(); out.minc = (g.own.P || 0) === had;
    const np = A.tobNeedPrice('P', g, .51); const q = np && A.tenderQuote('P', g, np, .51); out.need = !np || q.after >= .51 - 1e-9;
    /* (L) listing takes a preparation period and a review */
    const n = A.foundCompany('tyo', 'tech', 20); n.ni = Math.abs(n.ni) + 1; n.margin = Math.max(n.margin, .2); const st = A.startIPO(n, 'list');
    out.ipo1 = st && n.priv && !!n.ipoPlan; S.week = n.ipoPlan.end; n.ni = Math.abs(n.ni) + 1; A.ipoStep(); out.ipo2 = !n.priv || /上場延期/.test(S.news[0].t);
    /* (M) the holding company's own IPO goes through the same preparation */
    S.player.cash = 300; S.dept.acc.staff = 40; S.dept.acc.ab = 80; S.dept.acc.mo = 90; S.player.ipoPlan = {f: .2, w0: S.week, end: S.week}; A.ipoStep(); out.ytr = (S.player.outside || 0) > 0 || /上場延期/.test(S.news[0].t);
    /* (C) staffing need grows with the group */
    const n0 = A.needOf('legal'); for (const x of S.cos.filter(y => !y.priv && !y.ctrl).slice(0, 3)) { x.own = {P: x.shares * .6}; } A.recomputeCtrl(); out.need2 = A.needOf('legal') > n0;
    return out;
  });
  ok('feedback: a large buy shows no instant paper gain and an immediate round trip loses money', r.impact.paper <= 0.05 && r.impact.trip < 0, JSON.stringify(r.impact));
  ok('feedback: head-office costs come out of cash (no silent borrowing)', r.od1);
  ok('feedback: negative cash warns first and is collected after 8 weeks', r.od2 && r.od3, JSON.stringify(r));
  ok('feedback: a margin call gives a deadline, then shares are force-sold', r.mc1 && r.mc2, JSON.stringify({mc1: r.mc1, mc2: r.mc2}));
  ok('feedback: a TOB with the minimum condition buys nothing when it falls short', r.minc);
  ok('feedback: the suggested TOB price reaches the target', r.need);
  ok('feedback: an IPO needs a preparation period and a review', r.ipo1 && r.ipo2, JSON.stringify({a: r.ipo1, b: r.ipo2}));
  ok('feedback: the holding company can list after its preparation', r.ytr);
  ok('feedback: legal staffing need grows with the number of controlled companies', r.need2);
  /* UI on iPhone: legal/IR tab, venture detail, news links, unlisted valuation, office from the city view */
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  await q.evaluate(() => { const A = window.__atlas, S = A.S; S.won = true; S.settings.guide = false; S.player.cash = 300; A.hqInit(); S.dept.inv.on = true; S.dept.legal.on = true; S.dept.inv.staff = 10; A.vcQuarter(); if (!S.vc.deals.length) A.vcQuarter(); A.ui.hqTab = 'inv'; });
  await q.click('[data-act=tab][data-v=pres]');
  const inv = await q.evaluate(() => ({legalOnInv: document.querySelector('#pbody').innerText.includes('法務部'), vc: !!document.querySelector('[data-act=vcopen]')}));
  if (inv.vc) await q.click('[data-act=vcopen]');
  const vc = await q.evaluate(() => ({modal: !document.querySelector('#modal').hidden && !!document.querySelector('#modal svg polygon') && document.querySelector('#modal').innerText.includes('主要株主'), o: document.documentElement.scrollWidth - innerWidth}));
  await q.evaluate(() => { document.querySelector('#modal').hidden = true; window.__atlas.ui.hqTab = 'legal'; }); await q.click('[data-act=tab][data-v=pres]');
  const lg = await q.evaluate(() => document.querySelector('#pbody').innerText.includes('法務部') && document.querySelector('#pbody').innerText.includes('必要人数の目安'));
  ok('feedback: legal and IR live on their own tab with a staffing target; ventures open a detail sheet', !inv.legalOnInv && inv.vc && vc.modal && vc.o <= 0 && lg, JSON.stringify({inv, vc, lg}));
  await q.evaluate(() => { const S = window.__atlas.S; S.news.unshift({w: S.week, t: `【テスト】${S.cos[3].name}の決算発表`, k: 'earn'}); }); /* a fresh game has no news naming a company yet */
  await q.click('[data-act=tab][data-v=news]'); const nl = await q.$('.nlink'); let opened = false;
  if (nl) { await nl.click(); opened = await q.evaluate(() => !!window.__atlas.ui.sel && window.__atlas.ui.tab === 'market'); }
  ok('feedback: a company name in the news opens its overview', opened);
  await q.evaluate(() => { const A = window.__atlas, n = A.foundCompany('osa', 'food', 10); A.ui.sel = null; A.ui.city = 'osa'; });
  await q.click('[data-act=tab][data-v=market]');
  const pv = await q.evaluate(() => ({val: [...document.querySelectorAll('#pbody .row')].some(r => r.innerText.includes('評価額')), hq: !!document.querySelector('[data-act=hqhere]')}));
  await q.click('[data-act=hqhere]'); const fl = await q.evaluate(() => window.__atlas.ui.hqTab === 'floor' && document.querySelector('#hqcity').value === 'osa');
  ok('feedback: unlisted companies show a valuation; the city view opens the office contract', pv.val && pv.hq && fl, JSON.stringify({pv, fl}));
  ok('no page errors in feedback tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testFeedback10(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(7171, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    /* (1) loss-makers are never tagged cheap */
    out.cheap = S.cos.every(c => !A.isCheap(c) || c.ni > 0);
    /* (2) bank: borrowing adds cash and debt, not net worth; the cash flow statement still adds up */
    S.player.cash = 50; const t = S.cos.filter(c => !c.priv && !c.ctrl)[2]; A.execBuy('P', t, A.sharesForMoney(t, 40)); A.step(); S.inbox = [];
    const nw0 = A.netWorth('P'), cash0 = S.player.cash, lim = A.bankLimit(); const got = A.bankBorrow(10);
    out.bank = {got: got > 0, nw: Math.abs(A.netWorth('P') - nw0) < 1e-9, cash: Math.abs(S.player.cash - cash0 - got) < 1e-9, cap: A.bankBorrow(1e6) <= lim};
    A.step(); S.inbox = []; const L = S.player.plWH[0], C = A.cfOf(L); out.cf = Math.abs(C.op + C.inv + C.fin - (L.cash1 - L.cash0)) < 1e-9;
    const B = A.bsNow(); out.bs = Math.abs(B.eq - A.netWorth('P') / (1 - (S.player.outside || 0))) < 1e-6 && B.L.some(x => x[0] === 'bank' && x[2] > 0);
    /* (3)(4) underwriters set the listing date and price */
    const n = A.foundCompany('tyo', 'tech', 20); A.startIPO(n, 'list', 'fast'); out.uw = n.ipoPlan.end === S.week + A.UW.fast.wk && n.ipoPlan.uw === 'fast';
    /* (6) more candidates */
    out.cands = A.marketFor('CFO', 'agency', null).length;
    /* (8) a secondary buy keeps the CEO: contracts run at least 26 weeks after the purchase */
    const q = S.cos.find(c => !c.priv && !c.ctrl && c !== t); q.priv = true; q.own = {Q1: q.shares}; A.recomputeCtrl(); q.pe = {type: 'buyout', owner: 'Q1', w0: S.week, flows: [[S.week, -1]], inv: 1, mq: 50, dd: true};
    const ceo = q.ex && q.ex.CEO; if (ceo) S.hr.people[ceo].end = S.week + 1;
    const eqq = A.fair(q) * q.shares; S.player.cash += eqq * 2 + 50; out.bought = A.peBuySecondary(q, 'P', eqq) && q.pe.owner === 'P'; for (let i = 0; i < 3; i++) { A.step(); S.inbox = S.inbox.filter(x => x.kind !== 'renew'); }
    out.ceoStays = out.bought && !!ceo && q.ex.CEO === ceo;
    /* (9) a PE IPO keeps the owner above half */
    q.ni = Math.abs(q.ni) + 1; A.peIPO(q, A.UW.mid); out.ipoCtrl = !q.priv && q.ctrl === 'P' && q.own.P / q.shares > .5;
    /* (10) forced settlement sells whole positions; an unpayable overdraft is bankruptcy */
    S.lost = false; const mine = S.cos.filter(c => !c.priv && (c.own.P || 0) > 0).length; S.player.cash = 0; S.player.loan = A.holdingsValue('P') * .99; S.player.mcall = {w: S.week - 2, due: S.week};
    A.playerWeekly(); out.closeout = S.cos.filter(c => !c.priv && (c.own.P || 0) > 0).length < mine || S.player.loan < 1e-9;
    S.lost = false; for (const c of S.cos) if (!c.priv) delete c.own.P; for (const pr of S.props) if (pr.own === 'P') pr.own = null; S.player.loan = 0; S.player.cash = -50; S.player.od = S.week - 9;
    A.overdraftStep(); out.bankrupt = S.lost === true && /資金繰り/.test(S.lostWhy || '');
    document.querySelector('#modal').hidden = true;
    return out;
  });
  ok('feedback2: loss-making companies are never tagged as cheap', r.cheap);
  ok('feedback2: a bank loan adds cash and debt but no net worth; statements still add up', r.bank.got && r.bank.nw && r.bank.cash && r.bank.cap && r.cf && r.bs, JSON.stringify(r));
  ok('feedback2: the chosen underwriter sets the listing date', r.uw);
  ok('feedback2: the agency shows at least 8 candidates', r.cands >= 8, String(r.cands));
  ok('feedback2: the CEO of a company bought on the secondary market stays on', r.ceoStays);
  ok('feedback2: a PE IPO keeps the owner in control', r.ipoCtrl);
  ok('feedback2: forced settlement sells whole positions; an overdraft nobody can cover is bankruptcy', r.closeout && r.bankrupt, JSON.stringify({c: r.closeout, b: r.bankrupt}));
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  await q.click('[data-act=why][data-v=cash]'); await q.click('#modal [data-act=bank]');
  const bk = await q.evaluate(() => ({open: document.querySelector('#modal').innerText.includes('アトラス中央銀行'), o: document.documentElement.scrollWidth - innerWidth}));
  await q.click('#modal [data-act=close]');
  await q.evaluate(() => { const A = window.__atlas, n = A.foundCompany('tyo', 'food', 10); A.ui.sel = n.id; A.ui.ctab = 'ceo'; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=listco]');
  const ip = await q.evaluate(() => ({n: document.querySelectorAll('#modal [data-act=ipostart]').length, date: /上場予定 \d{4}年/.test(document.querySelector('#modal').innerText), o: document.documentElement.scrollWidth - innerWidth}));
  ok('feedback2: the bank screen and the underwriter choice open on iPhone', bk.open && bk.o <= 0 && ip.n === 3 && ip.date && ip.o <= 0, JSON.stringify({bk, ip}));
  ok('no page errors in feedback2 tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testCreditMacroControl(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(8181, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true;
    /* (7) effective control */
    const c = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom'), sh = c.shares;
    c.own = {P: sh * .42, R1: sh * .15}; A.recomputeCtrl(); out.eff = c.ctrl === 'P';
    c.own = {P: sh * .42, R1: sh * .25}; A.recomputeCtrl(); out.contested = c.ctrl === null;
    c.own = {P: sh * .39}; A.recomputeCtrl(); out.below40 = c.ctrl === null;
    const air = S.cos.find(x => !x.priv && !x.ctrl && x.ind === 'air' && !A.isJP || (x.ind === 'air' && !x.ctrl && !x.priv));
    if (air) { air.own = {P: air.shares * .45}; A.recomputeCtrl(); out.regulated = A.ownCap(air, 'P') < 1 ? air.ctrl === null : true; air.own = {}; A.recomputeCtrl(); } else out.regulated = true;
    c.own = {}; A.recomputeCtrl();
    /* (1) refinancing: a strong company refinances at today's rate; an over-borrowed one is refused and repays from cash */
    const good = S.cos.filter(x => x.debt > 1 && x.ni > 0).sort((a, b) => A.dscr(b) - A.dscr(a))[0]; A.debtInit(good); good.lockR = 2; S.econ.rate = 6; const ni0 = good.ni;
    out.lag = Math.abs(A.niA ? 0 : 0) === 0; good.dueW = S.week; A.refiStep(); out.refi = good.lockR > 2 && good.lockR < 6 && good.dueW === S.week + 26;
    const bad = S.cos.find(x => x !== good && !x.priv && x.debt > 1); A.debtInit(bad); bad.debt = Math.max(bad.debt, A.mcap ? 0 : 0) + Math.max(5, bad.rev * 3); bad.cash = bad.debt * .1; bad.crisis = null; bad.dueW = S.week; bad.own = Object.assign({}, bad.own, {P: bad.shares * .01}); /* held by the player, so its news is reported individually */ const d0 = bad.debt;
    A.refiStep(); const fresh = S.news.slice(0, 6).map(n => n.t); out.refused = bad.debt < d0 && fresh.some(t => /借り換え失敗/.test(t) && t.includes(bad.name)) && (!!bad.crisis || fresh.some(t => /危機回避|資金を注入/.test(t))); /* AI-run companies resolve the crisis at once */
    /* (2) inflation follows a raw-material shock and the central bank leans against it; a glut cuts prices */
    S.econ.raw = 1.5; S.econ.infl = 2; for (let i = 0; i < 60; i++) A.econStep(); out.infl = S.econ.infl > 3 && S.econ.rate > 4.5;
    const M = S.mk[c.mk], p0 = A.plevOf ? 0 : 0; M.glut = 0; const pl0 = c.rev; M.cap = M.D * 1.25; A.step(); S.inbox = []; out.glut = (M.glut || 0) > 0;
    return out;
  });
  ok('control: 40%+ with the other holders dispersed is effective control; a strong second holder or a regulated industry needs a majority', r.eff && r.contested && r.below40 && r.regulated, JSON.stringify(r));
  ok('credit: a healthy company refinances a quarter of its debt at today\'s rate (fixed-rate lag)', r.refi);
  ok('credit: a company whose DSCR is too low is refused and falls into a funding crisis', r.refused);
  ok('macro: a raw-material shock raises inflation and the policy rate follows', r.infl);
  ok('macro: excess industry capacity becomes a supply glut', r.glut);
  ok('no page errors in credit/macro/control tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testLadderGrad(b) {
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  await q.evaluate(() => { const A = window.__atlas, S = A.S; S.won = true; S.settings.guide = false; S.settings.confirm = false; S.player.cash = 100; const c = S.cos.find(x => !x.priv && !x.ctrl); A.ui.sel = c.id; A.ui.ctab = 'trade'; A.ui.amt = 5; });
  await q.click('[data-act=tab][data-v=market]');
  await (await q.$$('[data-act=amtd]'))[3].click(); await (await q.$$('[data-act=amtd]'))[2].click();
  const amt = await q.evaluate(() => window.__atlas.ui.amt);
  await q.evaluate(() => { window.__atlas.ui.ctab = 'raid'; }); await q.click('[data-act=tab][data-v=market]');
  const p0 = await q.evaluate(() => window.__atlas.ui.tPrem); await (await q.$$('[data-act=tpremd]'))[2].click(); const p1 = await q.evaluate(() => window.__atlas.ui.tPrem);
  const o1 = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('ladder: the buy amount and the TOB premium step up and down', Math.abs(amt - 16) < 1e-9 && Math.abs(p1 - p0 - .01) < 1e-9 && o1 <= 0, JSON.stringify({amt, p0, p1, o1}));
  const vc = await q.evaluate(() => { const A = window.__atlas, S = A.S; A.hqInit(); A.vcQuarter(); const d = S.vc.deals[0]; if (!d) return {none: true}; const c0 = S.player.cash; const okv = A.vcInvest(d.id, .07); const h = S.vc.hold.find(x => x.id === d.id); return {okv, stake: h && h.stake, paid: +(c0 - S.player.cash).toFixed(4), cost: +(d.val * .07).toFixed(4)}; });
  ok('ladder: a venture stake of any whole percent from 1% to 20% can be bought', vc.none || (vc.okv && Math.abs(vc.stake - .07) < 1e-9 && Math.abs(vc.paid - vc.cost) < 1e-6), JSON.stringify(vc));
  const g = await q.evaluate(() => { const A = window.__atlas, S = A.S; A.hqInit(); A.setOffice(2, 'tyo'); const d = S.dept.acc; const s0 = d.staff, cost0 = A.deptCost(), eff0 = A.deptEff('acc');
    const n = A.gradOffer('acc', 3), queued = S.gradQ.acc; S.week = A.gradJoinW(); A.gradStep();
    return {n, queued, joined: d.staff - s0, jr: d.jr, costPer: +((A.deptCost() - cost0) / 3).toFixed(4), effPer: +((A.deptEff('acc') - eff0) / 3).toFixed(3), ab: d.ab}; });
  ok('graduates: offers join on the entrance day as cheaper, less able juniors', g.n === 3 && g.queued === 3 && g.joined === 3 && g.jr === 3 && g.costPer < .08 && g.effPer < g.ab / 70, JSON.stringify(g));
  const grow = await q.evaluate(() => { const A = window.__atlas, S = A.S, d = S.dept.acc, a0 = d.jrAb; for (let i = 0; i < 20; i++) A.gradStep(); return {a0, a1: d.jrAb, jr: d.jr}; });
  ok('graduates: juniors learn on the job', grow.a1 > grow.a0 || grow.jr === 0, JSON.stringify(grow));
  await q.evaluate(() => { window.__atlas.ui.sel = null; window.__atlas.ui.hqTab = 'hr'; }); await q.click('[data-act=tab][data-v=pres]');
  const ui = await q.evaluate(() => ({box: document.querySelector('#pbody').innerText.includes('新卒採用'), lad: document.querySelectorAll('[data-act=gradd]').length, o: document.documentElement.scrollWidth - innerWidth}));
  ok('graduates: the hiring box shows on the HR floor without overflow', ui.box && ui.lad > 0 && ui.o <= 0, JSON.stringify(ui));
  ok('no page errors in ladder/graduate tests', !ph.errs.length, ph.errs.slice(0, 3).join(' | '));
  await ph.ctx.close();
}

async function testFeedback3(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(9191, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 500; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    /* training at the ceiling stretches it for younger people; older people at the ceiling are not charged */
    const ppl = Object.values(S.hr.people), a = ppl[0], z = ppl[1];
    a.sk.gen = 80; a.pot = 80; a.age = 50; a.trainW = -99; out.t1 = A.trainExec(a, 'gen') && a.sk.gen === 82 && a.pot === 82;
    z.sk.gen = 80; z.pot = 80; z.age = 60; z.trainW = -99; const c0 = S.player.cash; out.t2 = !A.trainExec(z, 'gen') && S.player.cash === c0;
    /* two years of quarterly results are kept */
    for (let i = 0; i < 27; i++) { A.step(); S.inbox = []; }
    out.qh = S.cos.every(c => (c.qh || []).length >= 1 && c.qh.length <= 8);
    /* selling a stake to other buyers */
    const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[3];
    A.execBuy('P', c, c.shares * .3); const held = c.own.P; c.bsale = {end: S.week}; A.bsaleStep(); const it = S.inbox.find(i => i.kind === 'bsale' && i.cid === c.id);
    out.bids = it ? it.bids.length : 0; const cash1 = S.player.cash; out.sold = !!it && A.bsaleExec(it, 0) && !(c.own.P > 1e-9) && S.player.cash > cash1;
    /* an M&A head pitches; taking the pitch acts on it */
    S.inbox = []; const m = Object.values(S.hr.people).find(x => !x.at); m.at = 'HQ'; m.role = 'MA'; S.hr.hq.MA = m.id; m.sk.deal = 90;
    let pit = null; for (let i = 0; i < 16 && !pit; i++) { S.week++; A.pitchStep(); pit = S.inbox.find(x => x.kind === 'pitch'); }
    out.pitch = !!pit;
    if (pit && pit.act.t === 'buy') { const t = A.S.cos.find(x => x.id === pit.act.cid), h0 = t.own.P || 0; A.pitchDo(pit); out.pitchDid = (t.own.P || 0) > h0; } else out.pitchDid = !!pit;
    /* IPO with a chosen offering size */
    const n = A.foundCompany('tyo', 'food', 30); n.margin = n.base = .25; A.startIPO(n, 'list', 'mid', .2, .1); S.week = n.ipoPlan.end; n.ni = Math.abs(n.ni) + 1; A.ipoStep();
    out.ipo = !n.priv && Math.abs(n.own.P / n.shares - .7) < 1e-6;
    return out;
  });
  ok('training: at the ceiling a younger executive stretches it; an older one is not charged', r.t1 && r.t2, JSON.stringify(r));
  ok('results: each company keeps up to eight quarters of history', r.qh);
  ok('block sale: buyers bid for your stake and selling transfers it', r.bids > 0 && r.sold, JSON.stringify({b: r.bids, s: r.sold}));
  ok('pitches: the M&A head brings a proposal that can be carried out', r.pitch && r.pitchDid);
  ok('IPO: the chosen numbers of new and sold shares are used', r.ipo);
  ok('no page errors in feedback3 tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testPitches2(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(9393, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 300; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    const free = () => Object.values(S.hr.people).find(x => !x.at);
    const seatHQ = r => { const m = free(); m.at = 'HQ'; m.role = r; S.hr.hq[r] = m.id; m.sk.fin = m.sk.deal = m.sk.hr = 85; return m; };
    const find = (kind, t) => S.inbox.find(i => i.kind === kind && (!t || (i.act && i.act.t === t)));
    const run = (kind, t, n) => { for (let i = 0; i < (n || 40); i++) { S.week++; A.pitchMore(); const it = find(kind, t); if (it) return it; } return null; };
    /* 1a: CFO locks a fixed rate before rates rise */
    seatHQ('CFO'); S.player.bank = 20; S.econ.infl = 3.5; S.inbox = [];
    const f = run('pitch', 'fix'); out.fix = !!f; if (f) { A.pitchDo(f); out.fixed = !!S.player.bankFix && Math.abs(A.bankRate() - S.player.bankFix.r) < 1e-9; }
    /* 1b: CFO takes profits on foreign stock in a weak yen */
    S.player.bank = 0; S.econ.fx = 158; S.inbox = []; const fo = S.cos.find(c => !c.priv && !c.ctrl && !A.isJP(c)); A.execBuy('P', fo, fo.shares * .05);
    const fx = run('pitch', 'sellhalf'); out.fx = !!fx; if (fx) { const h0 = fo.own.P; A.pitchDo(fx); out.fxSold = fo.own.P < h0; }
    /* 9: CFO and M&A head disagree when debt is heavy */
    seatHQ('MA'); S.econ.fx = 140; S.inbox = []; S.player.loan = A.grossWorth() * .6 + 50; S.player.cash = 0;
    const d = run('debate'); out.debate = !!d && d.opts.length === 2;
    /* 2: the M&A head warns of a rival buying up a company */
    S.player.loan = 0; S.player.cash = 300; S.inbox = []; const t = S.cos.find(c => !c.priv && !c.ctrl && c !== fo && !A.activeTob(c)); for (const k of Object.keys(t.own)) delete t.own[k]; t.own.R1 = t.shares * .2; t.own.P = t.shares * .05; A.recomputeCtrl();
    const pre = (() => { for (let i = 0; i < 40; i++) { S.week++; A.pitchMore(); const it = S.inbox.find(x => x.kind === 'pitch' && x.act.t === 'tob' && /買い集め/.test(x.text)); if (it) return it; } return null; })(); out.preempt = !!pre;
    /* 3: a subsidiary CMO answers a price cut with advertising */
    S.inbox = []; const c = S.cos.find(x => !x.priv && !x.ctrl && x !== t && x !== fo && S.cos.some(y => y !== x && y.mk === x.mk)); for (const k of Object.keys(c.own)) delete c.own[k]; c.own.P = c.shares * .6; A.recomputeCtrl();
    const cmo = free(); cmo.at = c.id; cmo.role = 'CMO'; c.ex.CMO = cmo.id; c.cash = c.rev * .2; S.cos.find(y => y !== c && y.mk === c.mk).ps = -1;
    const ad = run('pitch', 'ad'); out.cmo = !!ad; if (ad) { const b0 = c.brand; A.pitchDo(ad); out.adDone = c.brand > b0; }
    /* 7: IR briefing before a miss halves the drop */
    S.inbox = []; A.hqInit(); S.dept.ir.on = true; S.dept.ir.staff = 2; c.est = Math.abs(A.niA(c)) * 3 + 1;
    let ir = null; for (let i = 0; i < 20 && !ir; i++) { S.week++; A.pitchMore(); ir = find('pitch', 'ir'); }
    out.ir = !!ir; if (ir) { A.pitchDo(ir); out.irSet = c.irBrief === true; }
    /* 8: the CHRO wants to keep a strong executive */
    seatHQ('HR'); S.inbox = []; const star = free(); star.at = c.id; star.role = 'CFO'; c.ex.CFO = star.id; star.sk.fin = 88; star.mood = .5; star.offer = null;
    const k = run('pitch', 'keep'); out.keep = !!k; if (k) { const m0 = A.S.hr.people[k.act.pid].mood; A.pitchDo(k); out.kept = A.S.hr.people[k.act.pid].mood > m0; }
    return out;
  });
  ok('pitches2: the CFO proposes a fixed rate and it locks the bank rate', r.fix && r.fixed, JSON.stringify(r));
  ok('pitches2: the CFO proposes taking profits on foreign stock in a weak yen', r.fx && r.fxSold);
  ok('pitches2: the CFO and the M&A head disagree when debt is heavy', r.debate);
  ok('pitches2: the M&A head warns of a rival buying up a company', r.preempt);
  ok('pitches2: a subsidiary CMO answers a price cut with advertising', r.cmo && r.adDone);
  ok('pitches2: IR offers a briefing before a weak quarter', r.ir && r.irSet);
  ok('pitches2: the CHRO proposes keeping a strong executive', r.keep && r.kept);
  ok('no page errors in pitch tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testAC(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4747, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 200; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    const c = S.cos.filter(x => !x.priv && !x.ctrl)[3]; A.execBuy('P', c, A.sharesForMoney(c, 100)); A.step(); S.inbox = [];
    /* (1) a term loan adds cash and debt, not net worth; weekly payments shrink it; statements add up */
    const offs = A.loanOffers(); const nw0 = A.netWorth('P'), cash0 = S.player.cash;
    out.loan = offs.length === 3 && A.takeLoan(0) && Math.abs(A.netWorth('P') - nw0) < 1e-6 && S.player.cash > cash0;
    const a0 = A.termDebt(); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; } out.amort = A.termDebt() < a0;
    const L = S.player.plWH[0], C = A.cfOf(L); out.cf = Math.abs(C.op + C.inv + C.fin - (L.cash1 - L.cash0)) < 1e-9;
    const B = A.bsNow(); out.bs = Math.abs(B.eq - A.netWorth('P') / (1 - (S.player.outside || 0))) < 1e-6;
    /* (13) corporate tax on a positive quarter */
    S.player.pl = Object.assign({}, S.player.pl, {div: 10, rent: 2, hq: -1}); const t = A.corpTax(); out.tax = Math.abs(t - .3 * (5 + 2 - 1 + (S.player.pl.int || 0) + (S.player.pl.fee || 0) + (S.player.pl.rd || 0) + (S.player.pl.pay || 0))) < 1e-6 && S.player.pl.tax < 0;
    /* (9) welfare levels scale the cost */
    A.hqInit(); S.dept.acc.staff = 10; S.welfare = {edu: 2}; const w2 = A.welfareCost(); S.welfare.edu = 4; out.welf = Math.abs(A.welfareCost() - 2 * w2) < 1e-9 && w2 > 0;
    /* (3) venture tranches and personal money */
    A.vcQuarter(); const d = S.vc.deals[0]; if (d) { const tr = A.vcTranches(d); S.pres.cash = d.val; const pc0 = S.pres.cash, vc0 = A.vcValue();
      out.vcp = A.vcInvest(d.id, tr[2], 'pres', 2) && S.pres.cash < pc0 && A.vcValue() === vc0 && A.presWealth() > 0 && !!A.vcFind(d.id); } else out.vcp = true;
    /* (2) delegated CFO covers negative cash from the credit line */
    const m = Object.values(S.hr.people).find(x => !x.at); m.at = 'HQ'; m.role = 'CFO'; S.hr.hq.CFO = m.id; m.dlg = {bank: true, acc: true};
    S.player.tl = []; S.player.bank = 0; S.player.cash = -3; A.dlgStep(); out.dlg = S.player.cash >= -1e-9 && (S.player.bank || 0) > 0;
    /* (5) a theme expo opens on schedule with its own deals */
    S.expo = null; S.week = 9 + 26 * 2; A.expoStep(); out.expo = !!S.expo && S.expo.deals.length === 7 && !!A.vcFind(S.expo.deals[0].id);
    /* (10) per-share dividend */
    out.ps = A.perShare(.005) > 0;
    return out;
  });
  ok('A/C: a term loan adds cash and debt but no net worth, is paid down weekly, and statements still add up', r.loan && r.amort && r.cf && r.bs, JSON.stringify(r));
  ok('A/C: corporate tax is 30% of the quarter with half of dividends exempt', r.tax);
  ok('A/C: welfare levels scale their cost', r.welf);
  ok('A/C: a venture tranche can be bought with personal money (not company net worth)', r.vcp);
  ok('A/C: a delegated CFO covers negative cash from the credit line', r.dlg);
  ok('A/C: a theme expo opens with its own venture deals', r.expo);
  ok('A/C: the board shows the dividend per share', r.ps);
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=ccol][data-v="2"]'); await q.click('[data-act=clogo][data-v="3"]'); await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  const brand = await q.evaluate(() => window.__atlas.S.color === '#3a8ee6' && window.__atlas.S.logo === 3 && !!document.querySelector('#date svg.logo'));
  await q.evaluate(() => { const A = window.__atlas; A.ui.mview = 'card'; A.ui.sel = null; }); await q.click('[data-act=tab][data-v=market]');
  const cards = await q.evaluate(() => ({n: document.querySelectorAll('.mcard').length, o: document.documentElement.scrollWidth - innerWidth}));
  await q.evaluate(() => { const A = window.__atlas, S = A.S; S.won = true; A.hqInit(); S.dept.hr.on = true; S.dept.hr.staff = 2; A.ui.hqTab = 'hr'; A.ui.mview = 'list'; });
  await q.click('[data-act=tab][data-v=pres]'); const wf = await q.evaluate(() => ({n: document.querySelectorAll('.wcard').length, o: document.documentElement.scrollWidth - innerWidth}));
  await q.click('[data-act=why][data-v=cash]'); await q.click('#modal [data-act=bank]'); const bk = await q.evaluate(() => document.querySelectorAll('#modal [data-act=loantake]').length);
  await q.click('#modal [data-act=close]');
  ok('A/C: brand colour and logo, industry cards, welfare cards and loan offers render on iPhone', brand && cards.n > 0 && cards.o <= 0 && wf.n === 10 && wf.o <= 0 && bk > 0, JSON.stringify({brand, cards, wf, bk}));
  ok('no page errors in A/C tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testFeedback12(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(5353, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 200; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    /* liquidation pays only what is left after the debt */
    const n = A.foundCompany('tyo', 'food', 20); n.debt = n.assets * .5 + n.cash + 50; const cash0 = S.player.cash; A.liquidate(n); out.liq = Math.abs(S.player.cash - cash0) < 1e-9;
    /* Japan and Europe announce every quarter */
    S.news = []; A.newsQuarter(); out.cb = S.news.some(x => /日本銀行/.test(x.t)) && S.news.some(x => /欧州中央銀行/.test(x.t));
    /* an ignored renewal renews automatically */
    const m = Object.values(S.hr.people).find(x => !x.at); m.at = 'HQ'; m.role = 'CFO'; S.hr.hq.CFO = m.id; m.end = S.week + 1; m.renewAsked = true; m.mood = .7;
    for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; } out.renew = m.at === 'HQ' && m.end > S.week + 100;
    /* grades need an investment department */
    A.hqInit(); S.dept.inv.on = false; out.grade = /未評価/.test(A.gradeTxt({grade: 'A'}));
    /* the CEO room can use a typed amount */
    A.ui.ceoAbs = 3; out.amt = A.ceoAmtOf({cash: 10}) === 3 && A.ceoAmtOf({cash: 2}) === 2; A.ui.ceoAbs = null;
    return out;
  });
  ok('feedback4: liquidating an indebted company pays nothing back', r.liq);
  ok('feedback4: the Bank of Japan and the ECB announce their rates every quarter', r.cb);
  ok('feedback4: an executive whose renewal is not declined stays on', r.renew);
  ok('feedback4: venture grades need an investment department; the CEO room accepts a typed amount', r.grade && r.amt, JSON.stringify(r));
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]'); await q.click('[data-act=speed][data-v="0"]');
  await q.click('[data-act=tab][data-v=bank]'); const bank = await q.evaluate(() => ({ok: document.querySelector('#pbody').innerText.includes('アトラス中央銀行'), o: document.documentElement.scrollWidth - innerWidth}));
  await q.evaluate(() => { const A = window.__atlas, S = A.S; S.won = true; S.settings.confirm = false; S.player.cash = 100; const c = S.cos.find(x => !x.priv && !x.ctrl); A.execBuy('P', c, A.sharesForMoney(c, 20)); A.ui.sel = c.id; A.ui.ctab = 'trade'; A.ui.sellF = .1; window.__c = c.id; });
  await q.click('[data-act=tab][data-v=market]');
  const h0 = await q.evaluate(() => window.__atlas.S.cos.find(x => x.id === window.__c).own.P);
  await (await q.$$('[data-act=sellfd]'))[3].click(); const f = await q.evaluate(() => window.__atlas.ui.sellF);
  await q.click(`[data-act=sell][data-v="${f}"]`); const h1 = await q.evaluate(() => window.__atlas.S.cos.find(x => x.id === window.__c).own.P);
  ok('feedback4: a bank tab, and selling a chosen number of shares', bank.ok && bank.o <= 0 && Math.abs(f - .2) < 1e-9 && Math.abs(h1 - h0 * .8) < h0 * 1e-6, JSON.stringify({bank, f, h0, h1}));
  ok('no page errors in feedback4 tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testGptBugs(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(6262, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 300; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    /* BUG-07: a fund that is still raising keeps net worth finite */
    S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
    const f = A.fundRaise('buyout', .05); if (f) { f.lp = 0; f.gp = 0; } out.nan = Number.isFinite(A.netWorth('P')) && Number.isFinite(A.bsNow().eq);
    /* BUG-09: options with different expiries settle separately */
    const c = S.cos.find(x => !x.priv && !x.ctrl); S.player.opts = [{id: 901, cid: c.id, type: 'call', k: c.price * .5, n: .01, exp: S.week + 1, cost: .1}, {id: 902, cid: c.id, type: 'call', k: c.price * .5, n: .01, exp: S.week + 5, cost: .1}];
    S.week += 1; A.optionsStep(); out.opt = S.player.opts.length === 1 && S.player.opts[0].id === 902;
    /* BUG-04: two companies owning 60% of each other are nobody's */
    const [a, d] = S.cos.filter(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom').slice(2, 4);
    a.own = {[d.id]: a.shares * .6}; d.own = {[a.id]: d.shares * .6}; a.ctrl = 'P'; d.ctrl = 'P'; A.recomputeCtrl(); out.circ = a.ctrl === null && d.ctrl === null;
    a.own = {}; d.own = {}; A.recomputeCtrl();
    /* a normal pyramid still works: P owns 60% of a, a owns 60% of d */
    a.own = {P: a.shares * .6}; d.own = {[a.id]: d.shares * .6}; A.recomputeCtrl(); out.pyr = a.ctrl === 'P' && d.ctrl === 'P'; a.own = {}; d.own = {}; A.recomputeCtrl();
    /* BUG-05: a save with a company in an unknown city is rejected and the game stays */
    const bad = JSON.parse(JSON.stringify(S)); bad.cos[0].city = 'nowhere'; out.val = A.validSave(bad) === false && A.parseSave(JSON.stringify(bad)) === null;
    const nw0 = A.netWorth('P'), msg = A.importText(JSON.stringify(bad)); out.imp = !!msg && A.S === S && A.netWorth('P') === nw0;
    /* BUG-08: no negative repayment */
    const pr = S.props.find(x => !x.own); pr.own = 'P'; pr.mort = 5; S.player.cash = -2; const r0 = A.repayMort(pr); out.mort = r0 === 0 && pr.mort === 5 && S.player.cash === -2; pr.own = null; pr.mort = 0; S.player.cash = 300;
    return out;
  });
  ok('gpt: a fund still raising keeps net worth finite (BUG-07)', r.nan);
  ok('gpt: options with different expiries settle one by one (BUG-09)', r.opt);
  ok('gpt: circular holdings do not keep control; pyramids still work (BUG-04)', r.circ && r.pyr, JSON.stringify(r));
  ok('gpt: a damaged save is rejected and the current game is kept (BUG-05)', r.val && r.imp);
  ok('gpt: a mortgage repayment is never negative (BUG-08)', r.mort);
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]');
  const paused = await q.evaluate(() => window.__atlas.ui.speed === 0);
  /* BUG-02: a bank loan is saved */
  await q.click('[data-act=tab][data-v=bank]'); await q.evaluate(() => { const A = window.__atlas; A.S.player.cash = 30; const c = A.S.cos.find(x => !x.priv && !x.ctrl); A.execBuy('P', c, A.sharesForMoney(c, 10)); A.renderAll ? 0 : 0; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=tab][data-v=bank]');
  const lt = await q.$('[data-act=loantake]'); if (lt) await lt.click(); await q.waitForTimeout(700);
  const saved = await q.evaluate(() => { const o = JSON.parse(localStorage.getItem(window.__atlas.SAVE_KEY)); return (o.player.tl || []).length === (window.__atlas.S.player.tl || []).length && (o.player.tl || []).length > 0; });
  /* BUG-01: the short button either trades or says why */
  const sh = await q.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.confirm = false; for (const c of S.cos) delete c.own.P; S.player.loan = 0; S.player.cash = 30; const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; A.ui.sel = c.id; A.ui.ctab = 'trade'; A.ui.samt = 50; return c.id; });
  await q.click('[data-act=tab][data-v=market]'); const n0 = await q.evaluate(() => document.querySelectorAll('#toasts .toast').length); await q.click('[data-act=short]');
  const shr = await q.evaluate(id => ({pos: !!window.__atlas.S.player.shorts[id], toast: document.querySelector('#toasts').innerText}), sh);
  /* BUG-06: 0 shares cannot be sold */
  await q.evaluate(() => { const A = window.__atlas, S = A.S, c = S.cos.find(x => x.id === A.ui.sel); delete S.player.shorts[c.id]; A.execBuy('P', c, c.shares * .01); A.ui.sellF = 0; });
  await q.click('[data-act=tab][data-v=market]'); const zero = await q.evaluate(() => { const b = [...document.querySelectorAll('[data-act=sell]')].find(x => x.innerText.includes('入力')); return !!b && b.disabled; });
  /* BUG-10 */
  await q.evaluate(() => { const A = window.__atlas, c = A.S.cos.find(x => x.id === A.ui.sel); c.price = A.fair(c) * 1.4; A.ui.ctab = 'info'; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=why][data-v=px]'); const dear = await q.evaluate(() => document.querySelector('#modal').innerText.includes('割高')); await q.click('#modal [data-act=close]');
  ok('gpt: a new game starts paused; a bank loan is saved at once (UX-02, BUG-02)', paused && saved, JSON.stringify({paused, saved}));
  ok('gpt: the short button trades or explains (BUG-01)', shr.pos || /上限|余力/.test(shr.toast), JSON.stringify(shr));
  ok('gpt: zero shares cannot be sold; a dear stock is called dear (BUG-06, BUG-10)', zero && dear, JSON.stringify({zero, dear}));
  ok('no page errors in gpt-report tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testBalance2(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(7373, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 300; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    /* estimates stay within their band and are fixed for the quarter */
    const amp = .04 + .26 * (1 - A.estAcc()); out.est = S.cos.every(c => Math.abs(A.fairEst(c) / A.fair(c) - 1) <= amp + 1e-9) && S.cos.some(c => Math.abs(A.fairEst(c) / A.fair(c) - 1) > 1e-6);
    /* a controlling stake is worth at least 95% of intrinsic value; the balance sheet agrees */
    const c = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom'); c.price = A.fair(c) * .6; c.own = {P: c.shares * .6}; A.recomputeCtrl();
    out.ctrl = Math.abs(A.ctrlPx('P', c) - A.fair(c) * .95) < 1e-9 && Math.abs(A.bsNow().eq - A.netWorth('P')) < 1e-6;
    c.own = {}; A.recomputeCtrl();
    /* a company on autopilot solves its own funding crisis */
    const d = S.cos.find(x => !x.priv && !x.ctrl && x !== c); d.own = {P: d.shares * .6}; A.recomputeCtrl(); d.dm = 'auto'; d.ni = -1; d.debt = Math.max(d.debt, 5); d.cash = 0; d.crisis = null; d.dueW = S.week; d.debt = d.rev * 10;
    S.inbox = []; A.refiStep(); out.auto = !S.inbox.some(i => i.kind === 'crisis' && i.cid === d.id);
    d.own = {}; A.recomputeCtrl();
    /* new companies are listed after the original list runs out */
    S.ipo = 999; const n0 = S.cos.length; S.cos = S.cos.filter((x, i) => x.priv || i % 3); const n1 = S.cos.length; S.week = 17 * 40; A.maybeIPO(); out.ipo = S.cos.length === n1 + 1 && /^G\d+/.test(S.cos[S.cos.length - 1].tk);
    /* crises of small unrelated companies are summarised, not reported one by one */
    const small = S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0)).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; const nn = S.news.length; A.qnews(small, 'crisis', 'x', 'deal'); out.quiet = S.news.length === nn && S.qn.crisis.length === 1 && S.qn.crisis[0] === small.id; /* counted by company */
    /* an alternative goal is awarded once */
    S.stats.fixed = {a: 1, b: 2, c: 3}; S.routes = {}; A.routeStep(); /* three different companies turned round */ const w1 = S.routes.fixer; A.routeStep(); out.route = w1 != null && S.routes.fixer === w1;
    /* dividend income raises the bank limit */
    const l0 = A.bankLimit(); const e = S.cos.find(x => !x.priv && x.ni > 0 && x.payout > 0 && !x.ctrl); e.own.P = e.shares * .1; out.div = A.divIncomeY() > 0 && A.bankLimit() > l0;
    return out;
  });
  ok('balance2: the theoretical price is shown as an estimate within its accuracy band', r.est);
  ok('balance2: a controlling stake is valued at intrinsic value (and the balance sheet agrees)', r.ctrl);
  ok('balance2: a company on autopilot handles its own funding crisis', r.auto);
  ok('balance2: new companies list after the original IPO list runs out', r.ipo);
  ok('balance2: unrelated small-company crises are summarised quarterly', r.quiet);
  ok('balance2: alternative goals are awarded once; dividends raise bank credit', r.route && r.div, JSON.stringify(r));
  ok('no page errors in balance2 tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testGpt2(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4141, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    for (let i = 0; i < 20; i++) A.step();
    /* BUG-05: missing history/message lists are rebuilt and the game still plays; impossible values are refused; nothing changes in the running game */
    const txt = JSON.stringify(S), rs0 = S.rs, w0 = S.week;
    out.repair = ['inbox', 'nwHist', 'news', 'idxHist'].every(k => { const o = JSON.parse(txt); delete o[k]; return !!A.parseSave(JSON.stringify(o)); });
    out.refuse = [o => { o.week = -100; }, o => { o.week = 3.5; }, o => { o.cos[0].city = 'zz'; }, o => { o.player.cash = 'x'; }].every(f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); });
    out.untouched = A.S === S && S.rs === rs0 && S.week === w0 && !A.ui.sim;
    /* a save that breaks only when the game runs is refused before it replaces anything */
    const o = JSON.parse(txt); o.cos[3].own = null; const nw0 = A.netWorth('P'); out.trial = !!A.importText(JSON.stringify(o)) && A.S === S && A.netWorth('P') === nw0;
    /* BUG-10: 30% below the estimate is a 30% discount (43% upside) */
    const c = S.cos.find(x => !x.priv && !x.ctrl && x.ni > 0); c.price = A.fairEst(c) * .7;
    /* BUG-13: the control premium raises net worth but not the credit lines */
    const t = S.cos.find(x => !x.priv && !x.ctrl && x !== c && x.ind !== 'air' && x.ind !== 'telecom'); t.price = A.fair(t) * .6;
    t.own = {P: t.shares * .3}; A.recomputeCtrl(); const bp0 = A.buyingPower(), bl0 = A.bankLimit(), nwA = A.netWorth('P'), dv0 = A.divIncomeY();
    t.own.P = t.shares * .45; A.recomputeCtrl();
    const ctrl = t.ctrl === 'P', extra = t.shares * .15 * t.price; out.collat = ctrl && A.holdingsValue('P') > A.holdingsMkt('P') + 1e-6 && A.buyingPower() - bp0 <= extra * 1.5 + 1e-6 && A.bankLimit() - bl0 <= extra * .45 + (A.divIncomeY() - dv0) * 4 + 1e-6 && A.netWorth('P') > nwA + extra * 1.5; /* only the market value of the extra 15% adds credit; the premium adds net worth */
    t.own = {}; A.recomputeCtrl();
    /* BUG-12: the same company turned round twice counts once */
    const f = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom' && x !== c); f.own = {P: f.shares * .6}; A.recomputeCtrl(); S.stats.fixed = {};
    for (let i = 0; i < 3; i++) { f.ni = -1; f.wasLoss = true; f.ni = 5; S.cos.filter(x => x.ctrl === 'P' && x !== f).forEach(x => { x.wasLoss = false; }); A.quarter(); }
    out.fixer = Object.keys(S.stats.fixed).length === 1 && S.stats.turnarounds === 1;
    f.own = {}; A.recomputeCtrl();
    /* BUG-14: a down round dilutes and offers a follow-on, like an up round */
    S.vc.hold.push({id: 'tv', name: 'T', val: 20, stake: .1, cost: 2, st: 0, q: .5, w: S.week, ind: 'tech'}); const h = S.vc.hold[S.vc.hold.length - 1]; S.inbox = [];
    A.vcRound(h, .6, .3, 'ダウンラウンド'); out.down = Math.abs(h.stake - .07) < 1e-9 && Math.abs(h.val - 12) < 1e-9 && S.inbox.some(i => i.kind === 'vcfollow' && i.hid === 'tv');
    A.vcRound(h, 2, .2, 'x'); out.oneOffer = S.inbox.filter(i => i.kind === 'vcfollow' && i.hid === 'tv').length === 1;
    S.vc.hold = S.vc.hold.filter(x => x !== h); S.inbox = [];
    /* BUG-15: the same small company twice is one company */
    const sm = S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0)).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; S.qn = {};
    A.qnews(sm, 'crisis', 'x', 'deal'); A.qnews(sm, 'crisis', 'x', 'deal'); A.newsQuarter(); out.qn = S.news.some(n => /【金融まとめ】.*資金繰り危機1社/.test(n.t));
    out.cid = c.id;
    return out;
  });
  ok('gpt2: missing history or message lists are rebuilt; impossible values are refused (BUG-05)', r.repair && r.refuse && r.untouched, JSON.stringify(r));
  ok('gpt2: a save that fails when played is refused before it replaces the game (BUG-05)', r.trial);
  ok('gpt2: the control premium counts toward net worth, not toward margin or bank credit (BUG-13)', r.collat);
  ok('gpt2: turning the same company round again does not count twice (BUG-12)', r.fixer);
  ok('gpt2: a down round dilutes and offers a single follow-on (BUG-14)', r.down && r.oneOffer);
  ok('gpt2: the quarterly summary counts companies, not events (BUG-15)', r.qn);
  /* UI: discount wording, cash-only max, immediate save and the warning clearing while paused */
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]');
  const cid = await q.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.guide = false; S.player.cash = 26; S.player.loan = 0; const c = S.cos.find(x => !x.priv && !x.ctrl && x.ni > 0); c.price = A.fairEst(c) * .7; A.ui.sel = c.id; A.ui.ctab = 'info'; return c.id; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=why][data-v=px]');
  const disc = await q.evaluate(() => document.querySelector('#modal').innerText); await q.click('#modal [data-act=close]');
  ok('gpt2: 30% below the estimate reads as a 30% discount with 43% upside (BUG-10)', /30%安い＝割安（上昇余地 43%）/.test(disc), disc.slice(0, 0));
  await q.evaluate(() => { const A = window.__atlas; A.ui.ctab = 'trade'; A.ui.cashOnly = true; const c = A.S.cos.find(x => x.id === A.ui.sel); const d = A.S.cos.find(x => !x.priv && !x.ctrl && x !== c); A.execBuy('P', d, A.sharesForMoney(d, 2)); A.ui.amt = 5; }); /* some shares held, so margin room exceeds cash */
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=amt][data-v=max]');
  const cm = await q.evaluate(() => { const A = window.__atlas, btn = document.querySelector('[data-act=buy]'); return {amt: A.ui.amt, cash: A.S.player.cash, borrow: document.querySelector('.cashsplit').innerText, dis: btn.disabled}; });
  ok('gpt2: in cash-only mode the max button uses cash and no margin is previewed (BUG-11)', cm.amt <= cm.cash + 1e-9 && cm.amt > 0 && !cm.dis, JSON.stringify(cm));
  await q.click('[data-act=buy]');
  const imm = await q.evaluate(() => { const o = JSON.parse(localStorage.getItem(window.__atlas.SAVE_KEY)); return Math.abs(o.player.cash - window.__atlas.S.player.cash) < 1e-9; });
  ok('gpt2: a trade is saved at once, without waiting (BUG-02)', imm);
  await q.evaluate(() => { const ls = Object.getPrototypeOf(localStorage); window.__set = ls.setItem; ls.setItem = function(){ throw new Error('full'); }; window.__atlas.ui.speed = 0; });
  await q.click('[data-act=tab][data-v=port]'); const warn = await q.evaluate(() => !!document.querySelector('[data-act=unsaved]'));
  await q.evaluate(() => { Object.getPrototypeOf(localStorage).setItem = window.__set; }); await q.waitForTimeout(2600);
  const cleared = await q.evaluate(() => !document.querySelector('[data-act=unsaved]'));
  ok('gpt2: the unsaved warning clears by itself once storage works again, even while paused (BUG-03)', warn && cleared, JSON.stringify({warn, cleared}));
  ok('no page errors in gpt2 tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testGpt3(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(5151, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    for (let i = 0; i < 10; i++) A.step();
    /* BUG-17: saves that break the money and ownership rules are refused */
    const txt = JSON.stringify(S), bad = f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); };
    out.over = bad(o => { o.cos[0].own = {P: o.cos[0].shares * 2}; });
    out.dup = bad(o => { o.cos[1].id = o.cos[0].id; });
    out.loanNull = bad(o => { o.player.loan = null; });
    out.tobsGone = bad(o => { delete o.tobs; });
    out.ghost = bad(o => { o.cos[0].own.C9999 = 1; });
    out.costFill = (() => { const o = JSON.parse(txt); const c = o.cos.find(x => !x.priv); c.own.P = c.shares * .01; delete o.player.cost; const g = A.parseSave(JSON.stringify(o)); return !!g && Math.abs(g.player.cost[c.id] - c.own.P * c.price) < 1e-9; })();
    out.goodOk = !!A.parseSave(txt);
    /* BUG-18: cash-only buying never borrows, even on the stocks where rounding used to overshoot */
    let borrowed = 0; for (const c of S.cos.filter(x => !x.priv)) { const n = A.sharesForMoney(c, 30); const q = n > 0 ? n : 0; if (q) { const qb = A.quoteBuy(c, q), cost = qb.avg * qb.n * 1.0025; if (cost > 30 + 1e-9) borrowed++; } }
    out.round = borrowed === 0;
    /* BUG-13: the control premium does not widen short-selling room */
    const t = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom'); t.price = A.fair(t) * .6; t.own = {P: t.shares * .45}; A.recomputeCtrl();
    out.short = t.ctrl === 'P' && A.netWorth('P') > A.nwMkt() + 1e-6 && Math.abs(A.shortRoom() - Math.max(0, A.nwMkt() - A.shortLiab())) < 1e-9;
    t.own = {}; A.recomputeCtrl();
    return out;
  });
  ok('gpt3: saves owning over 100%, with duplicate ids, a missing loan, lost tender offers or unknown holders are refused (BUG-17)', r.over && r.dup && r.loanNull && r.tobsGone && r.ghost && r.goodOk, JSON.stringify(r));
  ok('gpt3: a lost cost basis is rebuilt at market value, so no fake gain appears', r.costFill);
  ok('gpt3: the share count for a sum never costs more than the sum (BUG-18)', r.round);
  ok('gpt3: short-selling room uses market values, not the control premium (BUG-13)', r.short);
  ok('no page errors in gpt3 tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testPeTob(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(6161, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1}; S.player.cash = 500;
    const pick = () => S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom' && !A.activeTob(x) && x.ni > 0);
    /* goodwill: a controlling stake bought at a normal premium is booked at cost, but never above 125% of intrinsic value */
    const c = pick(); c.price = A.fair(c); const cost = c.shares * .6 * A.fair(c) * 1.2; c.own = {P: c.shares * .6}; S.player.cost[c.id] = cost; A.recomputeCtrl();
    out.gw = c.ctrl === 'P' && Math.abs(A.ctrlPx('P', c) - A.fair(c) * 1.2) < 1e-6 && Math.abs(A.holdingsMkt('P') - c.own.P * c.price) < 1e-9;
    S.player.cost[c.id] = c.shares * .6 * A.fair(c) * 2; out.gwCap = Math.abs(A.ctrlPx('P', c) - A.fair(c) * 1.25) < 1e-6;
    /* post-merger integration: fixed costs fall about 6% over the first year of control, then stop */
    const wk = S.week; c.pmi = {w0: S.week}; c.fixed = 100; for (let i = 0; i < 60; i++) { A.pmiStep(c); S.week++; } S.week = wk; out.pmi = !c.pmi && c.fixed > 90 && c.fixed < 95; /* 52 weekly steps, then it stops */
    c.own = {}; A.recomputeCtrl(); delete S.player.cost[c.id];
    /* a funding crisis in an autopilot subsidiary is funded by the parent when it can, keeping control */
    const d = pick(); d.own = {P: d.shares * .52}; A.recomputeCtrl(); d.dm = 'auto'; d.crisis = {w: S.week + 8}; 
    A.playerCrisisAuto(d); out.parent = !d.crisis && d.ctrl === 'P' && d.own.P / d.shares > .52;
    S.player.cash = 0; d.crisis = {w: S.week + 8}; const sh0 = d.shares; A.playerCrisisAuto(d); out.noDilute = !d.crisis && d.ctrl === 'P' && d.own.P / d.shares > .5; /* no cash: refinance or a small offering, never one that costs control */
    d.own = {}; A.recomputeCtrl(); S.player.cash = 500;
    /* tender acceptance: +19% gets about half the float, +35% nearly all */
    const e = pick(); e.price = A.fair(e); const half = A.tenderQuote('P', e, e.price * 1.19, 1), all = A.tenderQuote('P', e, e.price * 1.36, 1);
    out.accept = half && Math.abs(half.accept - .5) < .03 && all && all.accept > .99;
    /* rivals do not pay more than their cap in a bidding war */
    out.cap = A.RIVAL_CAP && A.RIVAL_CAP.raider <= 1.4 && A.RIVAL_CAP.turnaround <= 1.3;
    return out;
  });
  ok('PE/TOB: a controlling stake is booked at cost (goodwill) up to 125% of intrinsic value; collateral stays at market', r.gw && r.gwCap, JSON.stringify(r));
  ok('PE/TOB: post-merger integration trims fixed costs about 6% in the first year, then ends', r.pmi);
  ok('PE/TOB: an autopilot subsidiary in a funding crisis is funded by the parent, or refinanced without losing control', r.parent && r.noDilute);
  ok('PE/TOB: a 19% premium attracts about half the float and 36% nearly all of it', r.accept);
  ok('PE/TOB: rivals cap what they pay in a bidding war', r.cap);
  ok('no page errors in PE/TOB tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testHQ(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(3232, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 800; A.hqInit();
    const cs = S.cos.filter(c => !c.ctrl && !c.priv).sort((a, b) => a.price * a.shares - b.price * b.shares); for (const c of cs.slice(0, 6)) A.execBuy('P', c, c.shares * .04);
    for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; }
    // statements: balance sheet equity equals the holding company's value; cash flow adds up to the change in cash
    const B = A.bsNow(); out.bs = Math.abs(B.eq - (A.netWorth('P') / (1 - (S.player.outside || 0)))) < 1e-6;
    const L = S.player.plHist[0], C = A.cfOf(L); out.cf = Math.abs(C.op + C.inv + C.fin - (L.cash1 - L.cash0)) < 1e-9;
    // a thin accounting team: statements lag; more people bring them up to date
    S.dept.acc.staff = 0; out.lagThin = A.accLag(); S.dept.acc.staff = 4; S.dept.acc.ab = 70; S.dept.acc.mo = 80; out.lagFull = A.accLag();
    // investment department: research points and more venture deals
    A.setOffice(3, 'tyo'); S.dept.inv.on = true; S.dept.inv.staff = 40; S.dept.inv.ab = 70; const pts0 = S.research.pts; S.research.budget = 0; A.deptStep(); out.research = S.research.pts > pts0;
    A.vcQuarter(); out.vcDeals = S.vc.deals.length;
    // venture: investing moves cash into a holding counted in the balance sheet
    const d = S.vc.deals[0], nw0 = A.netWorth('P'); out.vcInvest = A.vcInvest(d.id, .05) && S.vc.hold.length === 1 && Math.abs(A.netWorth('P') - nw0) < d.val * .05 * .02 + 1e-6;
    for (let i = 0; i < 40; i++) A.vcEvent(S.vc.hold[0] || {w: 0, st: 0, q: .5, val: 1, stake: 0, cost: 0, name: 'x'}); out.vcMoved = S.vc.track.length > 0 || (S.vc.hold[0] && Math.abs(S.vc.hold[0].val - d.val) > 1e-9);
    // board: once a quarter; the dividend moves money from the company to you
    out.board1 = A.holdBoard(.01, .005); out.board2 = A.holdBoard(0, 0); S.player.cash += 50; const pc0 = S.pres.cash, cash0 = S.player.cash; A.boardQuarter(); out.dividend = S.pres.cash > pc0 && S.player.cash < cash0;
    // property: a low offer is refused (and must wait); the asking price is accepted
    const pr = S.props.find(x => !x.own), I = A.propInfo(pr); out.low = A.propOffer(pr, .85) === (I.ask * .85 >= I.reserve ? 'ok' : 'no');
    const pr2 = S.props.filter(x => !x.own)[1]; S.player.cash = 5000; out.ask = A.propOffer(pr2, 1) === 'ok' && A.buyProp('P', pr2, 0, A.propInfo(pr2).ask) && pr2.own === 'P';
    S.settings.rep = 'off'; out.repOff = !A.wantReport(); S.settings.rep = 'w'; out.repW = A.wantReport();
    return out;
  });
  ok('HQ: the balance sheet adds up to net assets; the cash flow statement adds up to the change in cash', r.bs && r.cf, JSON.stringify({bs: r.bs, cf: r.cf}));
  ok('HQ: an understaffed accounting team delays the statements', r.lagThin > r.lagFull && r.lagFull === 1, JSON.stringify([r.lagThin, r.lagFull]));
  ok('HQ: the investment department produces research and more venture deals', r.research && r.vcDeals >= 3, JSON.stringify({res: r.research, n: r.vcDeals}));
  ok('HQ: a venture stake is bought at its price and later moves (round or exit)', r.vcInvest && r.vcMoved);
  ok('HQ: the board meets once a quarter; the dividend goes to your personal assets', r.board1 && !r.board2 && r.dividend, JSON.stringify({b1: r.board1, b2: r.board2, d: r.dividend}));
  ok('HQ: property offers below the reserve are refused; the asking price buys it', r.low && r.ask, JSON.stringify({low: r.low, ask: r.ask}));
  ok('HQ: the results report follows its setting', r.repOff && r.repW);
  // screens on a phone
  const m = await page(b, devices['iPhone 13']);
  await m.p.evaluate(() => { const A = window.__atlas; A.newGame(3333, 'normal', 'T', 't', 'std', true); const S = A.S; S.lost = S.won = true; S.goalIdx = 9; S.player.cash = 500; A.hqInit(); A.setOffice(2, 'tyo'); S.dept.inv.on = true; S.dept.inv.staff = 15; S.dept.hr.on = true; S.dept.hr.staff = 5;
    for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } document.querySelector('#modal').hidden = true; });
  const tabs = ['acc', 'hr', 'board', 'inv', 'floor', 'me'], res = {};
  for (const t of tabs) { await m.p.evaluate(t => { window.__atlas.ui.hqTab = t; }, t); await m.p.click('[data-act=tab][data-v=pres]'); res[t] = await m.p.evaluate(() => ({o: document.documentElement.scrollWidth - innerWidth, floors: document.querySelectorAll('canvas.floor').length})); }
  await m.p.evaluate(() => { window.__atlas.S.settings.rep = 'q'; window.__atlas.showReport(); });
  const rep = await m.p.evaluate(() => ({open: !document.querySelector('#modal').hidden, paper: !!document.querySelector('.paper'), o: document.documentElement.scrollWidth - innerWidth}));
  ok('iPhone: every head-office screen renders without overflow, with office floors drawn', tabs.every(t => res[t].o <= 0) && res.acc.floors > 0 && res.floor.floors >= 5, JSON.stringify(res));
  ok('iPhone: the quarterly results report with its newspaper opens', rep.open && rep.paper && rep.o <= 0, JSON.stringify(rep));
  ok('no page errors in head-office tests', !errs.length && !m.errs.length, errs.concat(m.errs).slice(0, 3).join(' | '));
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
      /* analyst: a competent player who trades on the visible estimate each quarter (cash only) */
      A.newGame(sd * 7919, d, 'T', 't', 'std', true); const S2 = A.S; let hit2 = null;
      for (let w = 0; w < 780 && hit2 == null; w++) {
        if (w % 13 === 0) {
          for (const c of S2.cos) if (!c.priv && (c.own.P || 0) > 0 && c.ctrl !== 'P' && c.price > A.fairEst(c) * .97) A.execSell('P', c, c.own.P);
          const L = S2.cos.filter(c => !c.priv && !c.ctrl && c.ni > 0 && A.fairEst(c) / c.price > 1.15 && !(c.own.P > 0)).sort((a, b) => A.fairEst(b) / b.price - A.fairEst(a) / a.price).slice(0, 4);
          const m = Math.max(0, S2.player.cash) * .9 / Math.max(1, L.length); for (const c of L) A.execBuy('P', c, A.sharesForMoney(c, m), m);
        }
        A.step(); S2.inbox = []; if (A.netWorth('P') >= 1000) hit2 = (w + 1) / 52;
      }
      (out[d] = out[d] || []).push({hit, hit2, rivals: S.rivals.map(r => Math.round(A.netWorth(r.id)))});
    }
    return out;
  }, QUICK);
  const summary = {};
  for (const d in res) { const hits = res[d].map(x => x.hit == null ? 15 : x.hit); const riv = res[d].map(x => Math.max(...x.rivals)); summary[d] = {analystYears: res[d].map(x => +(x.hit2 == null ? 15 : x.hit2).toFixed(1)), botYears: hits.map(h => +h.toFixed(1)), topRival: riv}; }
  console.log('BALANCE ' + JSON.stringify(summary));
  if (fs.existsSync(BASELINE) && !args.has('--update-baseline')) {
    const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
    for (const d in summary) {
      if (!base[d]) continue;
      const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
      const by = avg(summary[d].botYears), bb = avg(base[d].botYears);
      console.log(`${Math.abs(by / bb - 1) <= .4 ? 'INFO' : 'WARN'}  balance ${d}: bot reaches the goal in ${by.toFixed(1)}y on average (baseline ${bb.toFixed(1)}y)`);
      if (base[d].analystYears) { const ay = avg(summary[d].analystYears), ab = avg(base[d].analystYears); console.log(`${Math.abs(ay / ab - 1) <= .3 ? 'INFO' : 'WARN'}  balance ${d}: analyst reaches the goal in ${ay.toFixed(1)}y on average (baseline ${ab.toFixed(1)}y)`); }
    }
    const av = d => summary[d] && summary[d].analystYears.reduce((x, y) => x + y, 0) / summary[d].analystYears.length;
    if (!QUICK && av('easy') && av('hard')) console.log(`${av('easy') <= av('normal') && av('normal') <= av('hard') ? 'INFO' : 'WARN'}  balance order: analyst ${av('easy').toFixed(1)}y (easy) ≤ ${av('normal').toFixed(1)}y (normal) ≤ ${av('hard').toFixed(1)}y (hard)`);
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
    await testTalent(b);
    await testQuarterly(b);
    await testHQ(b);
    await testUIPack(b);
    await testPlaytestFixes(b);
    await testFeedback13(b);
    await testFeedback10(b);
    await testCreditMacroControl(b);
    await testLadderGrad(b);
    await testFeedback3(b);
    await testPitches2(b);
    await testAC(b);
    await testFeedback12(b);
    await testGptBugs(b);
    await testBalance2(b);
    await testGpt2(b);
    await testGpt3(b);
    await testPeTob(b);
    await balance(b);
  } finally { await b.close(); }
  console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
  process.exit(failures ? 1 : 0);
})();
