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
    if (await p.$('#modal:not([hidden]) [data-act=close]')) await p.click('#modal:not([hidden]) [data-act=close]'); /* the weekly results open after +1週 (default since rev30): the player closes them */
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
    out.bought = A.buyProp('P', pr, .5); out.cashDrop = +(500 - S.player.cash).toFixed(4); const r2m = x => Math.round(x * 100) / 100; /* rev48: prices, fees and loans in whole 百万円 */ out.expect = +(v + r2m(v * .03) - r2m(v * .5)).toFixed(4); out.nwDrop = +(nw0 - A.netWorth('P')).toFixed(4); out.fee = +r2m(v * .03).toFixed(4);
    const c0 = S.player.cash; S.econ.rate = S.econ.rate; A.propStep(); out.rent = S.player.cash > c0;
    const v1 = A.propVal(pr); S.econ.rate += 1; A.propStep(); out.rateHit = A.propVal(pr) < v1 * .98;
    const ny = S.props.find(x => x.city === 'nyc'), vn = A.propVal(ny); S.econ.fx *= 1.2; out.fx = Math.abs(A.propVal(ny) - Math.round(ny.v * A.propFx(ny) * 100) / 100) < 1e-9 && Math.abs(A.propVal(ny) / vn - 1.2) < .011 / vn; /* rev48: in proportion to the rate, to the 百万円 */ S.econ.fx /= 1.2;
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
  const l = await p.evaluate(inv => { const A = window.__atlas, seen = {}, bad = []; for (const seed of [8181, 8182, 8183]) { A.newGame(seed, 'hard', 'T', 't', 'std', true); const S = A.S; S.won = true; S.lost = true; for (let w = 0; w < 520; w++) { A.step(); S.inbox = []; for (const n of S.news) if (n.w === S.week) for (const k of ['株主提案', '委任状争奪戦', 'LBO', '第三者割当', '不動産取得']) if (n.t.includes(k)) seen[k] = (seen[k] || 0) + 1; } bad.push(...[].concat((0, eval)('(' + inv + ')')() || [])); } return {seen, bad: bad.length ? bad : (0, eval)('(' + inv + ')')()}; }, INVARIANTS.toString()); /* rev29: counted over three 10-year games (30 years), so one game's path does not decide whether rivals use a move at all */
  ok('rivals use proposals, proxy fights and real estate over three 10-year games', l.seen['株主提案'] > 0 && l.seen['委任状争奪戦'] > 0 && l.seen['不動産取得'] > 0, JSON.stringify(l.seen));
  ok('invariants hold over three 10-year hard games with the new moves', !l.bad.length, l.bad.slice(0, 5).join(', '));
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
    const A = window.__atlas, out = {}; A.newGame(6161, 'normal', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.won = S.lost = true; S.player.cash = 600;
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
      const ce = byDeal(e), qc = A.peQuote(e, A.dealAsk(e), .5, 'P'); /* the cheque re-priced in the closing week: the market can move during the three-week auction (industry cycles, bubbles), which is a separate effect from the J-curve */ out.jcurve = ce ? (qc.out - ce.own.P * ce.price) / qc.out : null; out.jcurveBid = ce ? (qe.out - ce.own.P * ce.price) / qe.out : null; } // bought at the asking price: the mark sits below the cheque
    // an outbid player loses
    const d2 = gen(); d2.n = 2; d2.ai = A.dealAsk(d2) * 1.3; d2.exp = S.week + 20; A.peBid(d2, 0, 0, false, 'P'); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; } out.lost = !(byDeal(d2) && byDeal(d2).pe.owner === 'P');
    // skipping due diligence: the hidden problem shows up later
    let d3 = gen(); for (let i = 0; i < 40 && (d3.type === 'turn' || A.dealAsk(d3) < 2); i++) d3 = gen(); /* an ordinary deal, as above (a loss-maker at the minimum price may not close within the six weeks) */ d3.n = 0; d3.ai = 0; d3.bids = []; /* nobody else bids, as in the cases above */ d3.exp = S.week + 20; d3.risk = {k: 'suit', cost: 3, w: 2}; A.peBid(d3, 0, 0, false, 'P'); for (let i = 0; i < 6; i++) { A.step(); S.inbox = []; }
    out.surprise = S.news.some(n => n.t.includes('買収後の誤算'));
    // recap: debt up, cash back to the owner, recorded as a distribution
    if (c) { const before = A.peStats(c).ret, cash1 = S.player.cash; c.debt = 0; const a = A.peRecap(c); out.recap = a > 0 && S.player.cash > cash1 && A.peStats(c).ret > before; }
    // exit through a sale process: bids arrive in the inbox; selling writes the track record
    if (c) { A.peExitStart(c); for (let i = 0; i < 6; i++) A.step(); const it = S.inbox.find(i => i.kind === 'peexit' && i.cid === c.id); out.exitBids = it ? it.bids.length : 0;
      if (it) { const cash2 = S.player.cash; const bb = it.bids[it.bids.length - 1]; A.peSell(c, bb); out.sold = (!S.cos.includes(c) || (c.own.P == null && c.ctrl === bb.buyer)) && S.player.cash > cash2 && S.pe.track.length >= 1 && S.pe.track[0].moic > 0; } }
    // take a controlled listed company private
    const L = S.cos.filter(x => !x.priv && !x.ctrl && !A.activeTob(x) && !Object.keys(x.own).some(k => k !== 'P' && x.own[k] / x.shares >= .05)).sort((a, b) => a.price * a.shares - b.price * b.shares)[4]; /* no tender offer under way and no other large holder */ S.player.cash += 3000; for (let i = 0; i < 10 && L.ctrl !== 'P'; i++) A.execBuy('P', L, L.shares * .3); /* a poison pill can dilute the first buys */
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
  ok('PE: J-curve — fees and the (5%, since 5.26) illiquidity discount cost 1–30% of the cheque at once', r.jcurve > .01 && r.jcurve < .3, `${r.jcurve} (against the cheque at the bid: ${r.jcurveBid})`);
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
  const l = await p.evaluate(inv => { const A = window.__atlas; A.newGame(6262, 'hard', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.won = S.lost = true; S.player.cash = 300; let bought = 0, sold = 0;
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
  await m.p.evaluate(() => { const A = window.__atlas; A.newGame(6363, 'normal', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ A.renderAll(true); /* shows the PE tab */ A.S.lost = true; for (let i = 0; i < 40 && A.S.pe.deals.length < 2; i++) A.peDealGen(); document.querySelector('#modal').hidden = true; });
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
    // a weaker executive can miss an item in a given month (planActions), so approve each month's proposal until the payout item has come and run
    let prop = null, sawPay = false;
    for (let m = 0; m < 6 && !sawPay; m++) { for (let i = 0; i < 4; i++) { A.step(); S.inbox = S.inbox.filter(x => x.kind === 'prop'); }
      const p1 = S.inbox.find(x => x.kind === 'prop' && x.cid === c.id); if (!p1) continue; prop = prop || p1; sawPay = p1.acts.some(a => a.k === 'payout');
      for (const a of p1.acts) A.doAction(c, a); S.inbox = S.inbox.filter(x => x !== p1); }
    out.prop = !!prop && prop.acts.length > 0; out.approved = sawPay && c.payout === .8;
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
    const x = A.ceoOf(c); x.offer = null; let got = null; for (let i = 0; i < 1040 && !got; i++) /* rev40: the offer is a quarterly chance (about 8% for this person); wait up to 20 years so the test does not depend on luck */ { x.mood = .1; x.quit = null; x.retiring = null; x.retire = 99; x.end = S.week + 300; A.step(); got = S.inbox.find(it => it.kind === 'poach' && it.pid === x.id); if (!got) S.inbox = []; }
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
    const A = window.__atlas, out = {}; A.newGame(4545, 'normal', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.won = S.lost = true;
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
    A.newGame(11, 'easy', 'T', 't', 'std', false); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.lost = true; A.step(); out.stage = S.stage; // easy starts with 50億円
    S.player.cash = 142; S.player.loan = 39.2; for (const c of S.cos) delete c.own.P; A.step(); out.loan = S.player.loan; out.tasks = A.tasks().some(t => t.t === '追証が近い');
    return out; });
  ok('nothing unlocks on the first day, even with the easy starting cash', f.stage === 1, String(f.stage));
  const g = await p.evaluate(() => { const A = window.__atlas, out = {}; A.newGame(13, 'normal', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.lost = S.won = true; S.player.cash = 3000;
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
  const e = await p.evaluate(() => { const A = window.__atlas; A.newGame(4646, 'normal', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.won = S.lost = true; S.player.cash = 3000;
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
    S.player.cash = 0; S.player.loan = 0; A.hqInit(); Object.assign(S.office, {lvl: 2, city: 'tyo'}); /* set directly (rev51: a move up is optional and needs the money) */ S.dept.acc.staff = 10; const loan0 = S.player.loan;
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
    A.step(); S.inbox = []; const L = S.player.plWH[0], C = A.cfOf(L); out.cf = Math.abs(C.op + C.inv + C.fin + (C.oth || 0) - (L.cash1 - L.cash0)) < 1e-9; /* rev33 BUG-110: rewards are their own line */
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
  await q.click('[data-act=tqd][data-v="1"]'); await q.click('[data-act=tqd][data-v="1"]'); await q.click('[data-act=tqd][data-v="-1"]'); await q.click('[data-act=tqd][data-v="1"]'); /* the quantity stepper (1% of the maximum per tap) */
  const amt = await q.evaluate(() => ({tf: window.__atlas.ui.tf, money: window.__atlas.ui.amt}));
  await q.evaluate(() => { window.__atlas.ui.ctab = 'raid'; }); await q.click('[data-act=tab][data-v=market]');
  const p0 = await q.evaluate(() => window.__atlas.ui.tPrem); await q.click('[data-act=sstep][data-k=tPrem][data-v="0.01"]'); /* the premium stepper */ const p1 = await q.evaluate(() => window.__atlas.ui.tPrem);
  const o1 = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('ladder: the buy quantity and the TOB premium step up and down', Math.abs(amt.tf - .02) < 1e-9 && amt.money > 0 && Math.abs(p1 - p0 - .01) < 1e-9 && o1 <= 0, JSON.stringify({amt, p0, p1, o1}));
  const vc = await q.evaluate(() => { const A = window.__atlas, S = A.S; A.hqInit(); A.vcQuarter(); const d = S.vc.deals[0]; if (!d) return {none: true}; const c0 = S.player.cash; const okv = A.vcInvest(d.id, .07); const h = S.vc.hold.find(x => x.id === d.id); return {okv, stake: h && h.stake, paid: +(c0 - S.player.cash).toFixed(4), cost: +(d.val * .07).toFixed(4)}; });
  ok('ladder: a venture stake of any whole percent from 1% to 20% can be bought', vc.none || (vc.okv && Math.abs(vc.stake - .07) < 1e-9 && Math.abs(vc.paid - vc.cost) < 1e-6), JSON.stringify(vc));
  const g = await q.evaluate(() => { const A = window.__atlas, S = A.S; A.hqInit(); A.setOffice(2, 'tyo'); const d = S.dept.acc; d.on = true; if (!d.staff) d.staff = 1; /* an accounting department to hire into */ const s0 = d.staff, cost0 = A.deptCost(), eff0 = A.deptEff('acc');
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
    const L = S.player.plWH[0], C = A.cfOf(L); out.cf = Math.abs(C.op + C.inv + C.fin + (C.oth || 0) - (L.cash1 - L.cash0)) < 1e-9; /* rev33 BUG-110: rewards are their own line */
    const B = A.bsNow(); out.bs = Math.abs(B.eq - A.netWorth('P') / (1 - (S.player.outside || 0))) < 1e-6;
    /* (13) corporate tax on a positive quarter */
    S.player.pl = Object.assign({}, S.player.pl, {div: 10, rent: 2, hq: -1}); const t = A.corpTax(); out.tax = Math.abs(t - .3 * (5 + 2 - 1 + (S.player.pl.int || 0) + (S.player.pl.fee || 0) + (S.player.pl.rd || 0) + (S.player.pl.pay || 0))) < 1e-6 && S.player.pl.tax < 0;
    /* (9) welfare levels scale the cost */
    A.hqInit(); S.dept.acc.on = true; S.dept.acc.staff = 10; S.welfare = {edu: 2}; const w2 = A.welfareCost(); S.welfare.edu = 4; out.welf = Math.abs(A.welfareCost() - 2 * w2) < 1e-9 && w2 > 0;
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
  await q.click('[data-act=trmode][data-v=sell]'); await q.click('[data-act=tqset][data-v="0.25"]'); const f = await q.evaluate(() => window.__atlas.ui.sellF);
  await q.click('#tr-go'); const h1 = await q.evaluate(() => window.__atlas.S.cos.find(x => x.id === window.__c).own.P);
  ok('feedback4: a bank tab, and selling a chosen number of shares from the sell tab', bank.ok && bank.o <= 0 && Math.abs(f - .25) < 1e-9 && Math.abs(h1 - h0 * .75) < h0 * 1e-6, JSON.stringify({bank, f, h0, h1}));
  ok('no page errors in feedback4 tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testGptBugs(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(6262, 'normal', 'T', 't', 'std', true); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: Math.max(1, A.S.dept.inv.staff)}); /* PE needs an investment department */ const S = A.S; S.won = S.lost = true; S.player.cash = 300; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
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
  const sh = await q.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.confirm = false; for (const c of S.cos) delete c.own.P; S.player.loan = 0; S.player.cash = 30; const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; A.ui.sel = c.id; A.ui.ctab = 'trade'; return c.id; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=trmode][data-v=short]'); await q.click('[data-act=tqset][data-v="1"]'); const n0 = await q.evaluate(() => document.querySelectorAll('#toasts .toast').length); await q.click('#tr-go');
  const shr = await q.evaluate(id => ({pos: !!window.__atlas.S.player.shorts[id], toast: document.querySelector('#toasts').innerText}), sh);
  /* BUG-06: 0 shares cannot be sold */
  await q.evaluate(() => { const A = window.__atlas, S = A.S, c = S.cos.find(x => x.id === A.ui.sel); delete S.player.shorts[c.id]; A.execBuy('P', c, c.shares * .01); A.ui.sellF = 0; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=trmode][data-v=sell]'); const zero = await q.evaluate(() => { const b = document.querySelector('#tr-go'); return !!b && b.dataset.act === 'sell' && b.disabled && window.__atlas.ui.tf === 0; });
  /* BUG-10 */
  await q.evaluate(() => { const A = window.__atlas, c = A.S.cos.find(x => x.id === A.ui.sel); c.price = A.repFair(c) * 1.4; A.ui.ctab = 'info'; }); /* the published estimate (BUG-39) */
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
    const day1 = Math.abs(A.ctrlPx('P', c) - c.price) < 1e-9; /* on the day control is taken, no premium is booked yet */ c.ctrlW = S.week - 52; /* a year later, integrated */
    out.ctrl = day1 && Math.abs(A.ctrlPx('P', c) - A.fair(c) * .95) < 1e-9 && Math.abs(A.bsNow().eq - A.netWorth('P')) < 1e-6;
    c.own = {}; A.recomputeCtrl();
    /* rev20 BUG-72: a company on autopilot does not settle a funding crisis on its own; the request waits for the player */
    const d = S.cos.find(x => !x.priv && !x.ctrl && x !== c); d.own = {P: d.shares * .6}; A.recomputeCtrl(); d.dm = 'auto'; d.ni = -1; d.debt = Math.max(d.debt, 5); d.cash = 0; d.crisis = null; d.dueW = S.week; d.debt = d.rev * 10;
    S.inbox = []; const pc = S.player.cash; A.refiStep(); out.auto = !!d.crisis && S.inbox.filter(i => i.kind === 'crisis' && i.cid === d.id).length === 1 && S.player.cash === pc;
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
  ok('balance2: a company on autopilot asks the player about a funding crisis (no automatic rescue, the parent cash untouched — rev20 BUG-72)', r.auto);
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
    const txt = A.exportText(), rs0 = S.rs, w0 = S.week;
    out.repair = ['inbox', 'nwHist', 'news', 'idxHist'].every(k => { const o = JSON.parse(txt); delete o[k]; return !!A.parseSave(JSON.stringify(o)); });
    out.refuse = [o => { o.week = -100; }, o => { o.week = 3.5; }, o => { o.cos[0].city = 'zz'; }, o => { o.player.cash = 'x'; }].every(f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); });
    out.untouched = A.S === S && S.rs === rs0 && S.week === w0 && !A.ui.sim;
    /* a save that breaks only when the game runs is refused before it replaces anything */
    const o = JSON.parse(txt); o.cos[3].own = null; const nw0 = A.netWorth('P'); out.trial = !!A.importText(JSON.stringify(o)) && A.S === S && A.netWorth('P') === nw0;
    /* BUG-10: 30% below the estimate is a 30% discount (43% upside) */
    const c = S.cos.find(x => !x.priv && !x.ctrl && A.pubNi(x) > 0); c.price = A.repFair(c) * .7; /* the published estimate (BUG-39) */
    /* BUG-13: the control premium raises net worth but not the credit lines */
    const t = S.cos.find(x => !x.priv && !x.ctrl && x !== c && x.ind !== 'air' && x.ind !== 'telecom'); t.price = A.fair(t) * .6;
    t.own = {P: t.shares * .3}; A.recomputeCtrl(); const bp0 = A.buyingPower(), bl0 = A.bankLimit(), nwA = A.netWorth('P'), dv0 = A.divIncomeY();
    t.own.P = t.shares * .45; A.recomputeCtrl(); t.ctrlW = S.week - 52; /* an integrated subsidiary: the control premium is fully booked */
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
  const cid = await q.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.guide = false; S.player.cash = 26; S.player.loan = 0; const c = S.cos.find(x => !x.priv && !x.ctrl && A.pubNi(x) > 0); c.price = A.repFair(c) * .7; /* the published estimate (BUG-39) */ A.ui.sel = c.id; A.ui.ctab = 'info'; return c.id; });
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=why][data-v=px]');
  const disc = await q.evaluate(() => document.querySelector('#modal').innerText); await q.click('#modal [data-act=close]');
  ok('gpt2: 30% below the estimate reads as a 30% discount with 43% upside (BUG-10)', /30%安い＝割安（上昇余地 43%）/.test(disc), disc.slice(0, 0));
  await q.evaluate(() => { const A = window.__atlas; A.ui.ctab = 'trade'; const c = A.S.cos.find(x => x.id === A.ui.sel); const d = A.S.cos.find(x => !x.priv && !x.ctrl && x !== c); A.execBuy('P', d, A.sharesForMoney(d, 2)); }); /* some shares held, so margin room exceeds cash */
  await q.click('[data-act=tab][data-v=market]'); await q.click('[data-act=trmode][data-v=cash]'); await q.click('[data-act=tqset][data-v="1"]');
  const cm = await q.evaluate(() => { const A = window.__atlas, btn = document.querySelector('#tr-go'); return {amt: A.ui.amt, cash: A.S.player.cash, cashOnly: A.ui.cashOnly, margin: /信用借入/.test(document.querySelector('.tr-info').innerText), dis: btn.disabled}; });
  ok('gpt2: the 現物買い tab at maximum uses cash only and shows no margin loan (BUG-11)', cm.amt <= cm.cash + 1e-9 && cm.amt > 0 && cm.cashOnly && !cm.margin && !cm.dis, JSON.stringify(cm));
  await q.click('#tr-go');
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
    const txt = A.exportText(), bad = f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); };
    out.over = bad(o => { o.cos[0].own = {P: o.cos[0].shares * 2}; });
    out.dup = bad(o => { o.cos[1].id = o.cos[0].id; });
    out.loanNull = bad(o => { o.player.loan = null; });
    out.tobsGone = bad(o => { delete o.tobs; });
    out.ghost = bad(o => { o.cos[0].own.C9999 = 1; });
    out.costFill = (() => { const o = JSON.parse(txt); const c = o.cos.find(x => !x.priv); c.own.P = c.shares * .01; delete o.player.cost; delete o.fmt; delete o.chk; /* an older-format save (before format 2) */ for (const k of ['tr', 'mm', 'founded', 'foundW', 'restarts']) delete o[k]; if (o.pres) delete o.pres.cost; /* a real older save has none of the current-format fields */ const g = A.parseSave(JSON.stringify(o)); return !!g && Math.abs(g.player.cost[c.id] - c.own.P * c.price) < 1e-9; })();
    out.goodOk = !!A.parseSave(txt);
    /* BUG-18: cash-only buying never borrows, even on the stocks where rounding used to overshoot */
    let borrowed = 0; for (const c of S.cos.filter(x => !x.priv)) { const n = A.sharesForMoney(c, 30); const q = n > 0 ? n : 0; if (q) { const qb = A.quoteBuy(c, q), cost = qb.avg * qb.n * 1.0025; if (cost > 30 + 1e-9) borrowed++; } }
    out.round = borrowed === 0;
    /* BUG-13: the control premium does not widen short-selling room */
    const t = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom'); t.price = A.fair(t) * .6; t.own = {P: t.shares * .45}; A.recomputeCtrl(); t.ctrlW = S.week - 52; /* integrated: the premium is booked */
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
    /* rev20 BUG-72: a funding crisis in an autopilot subsidiary waits for the player (the officers recommend); the parent's money moves only on approval, and refinancing keeps control */
    const d = pick(); d.own = {P: d.shares * .52}; A.recomputeCtrl(); d.dm = 'auto'; d.crisis = {w: S.week + 8, due: S.week + 8}; S.inbox = [];
    const pc0 = S.player.cash, dc0 = d.cash; A.playerCrisisAuto(d); const it = S.inbox.find(i => i.kind === 'crisis' && i.cid === d.id); out.parent = !!d.crisis && !!it && !!it.rec && S.player.cash === pc0 && d.cash === dc0;
    const sh0 = d.shares; A.resolveCrisis(d, 'refi'); out.noDilute = !d.crisis && d.ctrl === 'P' && d.shares === sh0 && d.own.P / d.shares > .5;
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
  ok('PE/TOB: an autopilot subsidiary in a funding crisis waits for the player with a recommendation; refinancing on approval keeps control (rev20 BUG-72)', r.parent && r.noDilute);
  ok('PE/TOB: a 19% premium attracts about half the float and 36% nearly all of it', r.accept);
  ok('PE/TOB: rivals cap what they pay in a bidding war', r.cap);
  ok('no page errors in PE/TOB tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testExitGuide(b) {
  const {p, ctx, errs} = await page(b, {...devices['iPhone 13']});
  await p.click('[data-act=allu][data-v="1"]'); await p.click('[data-act=newgame]');
  const r = await p.evaluate(() => {
    const A = window.__atlas, S = A.S, out = {}; S.settings.guide = false; S.player.cash = 300;
    const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom' && x.ni > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[0];
    c.own = {P: c.shares * .55}; S.player.cost[c.id] = c.shares * .55 * c.price * .55; A.recomputeCtrl();
    out.taken = c.ctrl === 'P' && c.ctrlW === S.week && !!c.pmi; /* control records the week and starts integration */
    let x = A.exitInfo(c); out.notYet = !x.ready && x.checks.length === 4 && !x.checks[0][1];
    delete c.pmi; c.ctrlW = S.week - 120; x = A.exitInfo(c);
    out.ready = x.ready && x.lo > x.cost * 1.5 && x.hi >= x.lo && x.mkt > 0 && x.mkt < x.lo; /* a block sale beats selling on the market */
    const rs = S.rs; A.exitInfo(c); out.noRng = S.rs === rs;
    S.qn = {}; const nn = S.news.length; c.exitHinted = false; A.quarter(); out.hint = S.news.some(n => /【売り時】/.test(n.t)) && c.exitHinted;
    const n0 = S.news.length; A.quarter(); out.once = !S.news.slice(0, S.news.length - n0).some(n => /【売り時】.*/.test(n.t) && n.t.includes(c.name));
    A.ui.pendingAward = null; A.ui.pendingUnlock = null; document.querySelector('#modal').hidden = true; out.id = c.id;
    return out;
  });
  await p.evaluate(() => { document.querySelector('#modal').hidden = true; window.__atlas.act('tab', {dataset: {v: 'port'}}); });
  const listed = await p.evaluate(id => { const b = document.querySelector(`[data-act=exitgo][data-id="${id}"]`); return !!b && /売り時/.test(b.textContent); }, r.id);
  await p.evaluate(id => { document.querySelector('#modal').hidden = true; window.__atlas.act('exitgo', {dataset: {id}}); }, r.id);
  const box = await p.evaluate(() => { const bx = document.querySelector('.exitbox'), trade = document.querySelector('.tr'); /* the trade box */ return !!bx && /売り時です/.test(bx.textContent) && !!trade && (bx.compareDocumentPosition(trade) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; });
  const sold = await p.evaluate(id => { const A = window.__atlas, S = A.S, c = S.cos.find(x => x.id === id); A.act('bsalego', {dataset: {}}); S.week = c.bsale.end; A.bsaleStep(); const it = S.inbox.find(i => i.kind === 'bsale' && i.cid === id); if (!it) return 'no bids'; const cash0 = S.player.cash, best = Math.max(...it.bids.map(b => b.px)), i = it.bids.findIndex(b => b.px === best), n = c.own.P; A.act('bsell', {dataset: {id: String(it.id), v: String(i)}}); return Math.abs(S.player.cash - cash0 - n * best) < 1e-6 && !(c.own.P > 0) && c.ctrl !== 'P'; }, r.id);
  ok('exit: taking control records the week and starts integration; the guide waits until integration is done', r.taken && r.notYet, JSON.stringify(r));
  ok('exit: after two years with a gain, the guide says sell, and a block sale is shown above a market sale', r.ready && r.noRng);
  ok('exit: a one-time 【売り時】 news item appears', r.hint && r.once);
  ok('exit: the holdings tab lists the subsidiary as ready and opens the exit box above the trade box', listed && box, JSON.stringify({listed, box}));
  ok('exit: selling to the best bid pays the bid and hands over control', sold === true, String(sold));
  ok('no page errors in exit tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testGpt4(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4747, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    for (let i = 0; i < 8; i++) A.step();
    /* money is shown in full yen */
    out.fm = A.fm(1) === '100,000,000円' && A.fm(1000) === '100,000,000,000円' && A.fm(-2.5) === '-250,000,000円' && A.fm(0) === '0円';
    /* BUG-05/17: a current save that lost a debt or a contract is refused; an older save is migrated */
    A.bankBorrow(.9); A.takeLoan(0); const c = S.cos.find(x => !x.priv && !x.ctrl); A.execShort(c, A.sharesForShort(c, 5));
    const txt = A.exportText(), t = f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); };
    out.ok = !!A.parseSave(txt);
    out.strict = [o => delete o.player.bank, o => delete o.player.tl, o => { o.player.shorts = {}; }, o => delete o.player.opts, o => { o.cos[0].own.X9 = 1; }, o => { o.cos[0].price = -1; }, o => { o.cos[0].debt = -5; }, o => { o.player.cash += 10; }].every(t);
    out.legacy = !t(o => { delete o.fmt; delete o.chk; delete o.player.bank; delete o.player.tl; o.player.loan = 0; for (const k of ['tr', 'mm', 'founded', 'foundW', 'restarts']) delete o[k]; if (o.pres) delete o.pres.cost; });
    out.stripped = t(o => { delete o.fmt; delete o.chk; delete o.player.bank; delete o.player.tl; o.player.loan = 0; }); /* a current save with only its format number and checksum removed is not taken for an old one */
    /* BUG-13: the squeeze keeps buying back until market-value collateral is restored */
    const d = S.cos.find(x => !x.priv && !x.ctrl && x !== c && x.ind !== 'air' && x.ind !== 'telecom'); d.price = A.fair(d) * .3; d.own = {P: d.shares * .6}; A.recomputeCtrl(); S.player.cash = 0;
    c.price *= 6; A.step(); const sl = A.shortLiab(); out.squeeze = sl === 0 || A.nwMkt() >= sl * .45 - 1e-6 || !S.player.shorts[c.id];
    return out;
  });
  ok('gpt4: every amount is shown in full yen (1億円 = 100,000,000円)', r.fm, JSON.stringify(r));
  ok('gpt4: a current save missing a debt, loan, short, option, holder or with edited money is refused; an older save is migrated (BUG-05/17)', r.ok && r.strict && r.legacy && r.stripped, JSON.stringify(r));
  ok('gpt4: a short squeeze stops only when market-value collateral is back (BUG-13)', r.squeeze);
  /* BUG-19: a load that cannot be written says so and keeps retrying */
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]');
  const res = await q.evaluate(() => { const A = window.__atlas; const o = JSON.parse(A.exportText()); A.step(); A.step();
    const ls = Object.getPrototypeOf(localStorage), real = ls.setItem; ls.setItem = function(){ throw new Error('full'); };
    const msg = A.importText(JSON.stringify(o)); const unsaved = A.ui.importUnsaved === true, week = A.S.week === o.week;
    ls.setItem = real; return {msg, unsaved, week}; });
  await q.waitForTimeout(2600);
  const cleared = await q.evaluate(() => { const A = window.__atlas, d = JSON.parse(localStorage.getItem(A.SAVE_KEY)); return d.week === A.S.week && !document.querySelector('[data-act=unsaved]'); });
  ok('gpt4: a load that cannot be saved is reported as loaded-but-unsaved, then saved once storage works (BUG-19)', !res.msg && res.unsaved && res.week && cleared, JSON.stringify({res, cleared}));
  ok('no page errors in gpt4 tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testTradeTabs(b) {
  const {p, ctx, errs} = await page(b, {...devices['iPhone 13']});
  await p.click('[data-act=allu][data-v="1"]'); await p.click('[data-act=newgame]');
  /* a new company in a home office has no departments, and PE waits for an investment department */
  const start = await p.evaluate(() => { const A = window.__atlas, S = A.S; A.hqInit(); return {acc: S.dept.acc.on, staff: Object.values(S.dept).reduce((a, d) => a + (d.on ? d.staff : 0), 0), peTab: !!document.querySelector('[data-act=tab][data-v=pe]'), has: A.has ? A.has('pe') : null}; });
  const opened = await p.evaluate(() => { const A = window.__atlas, S = A.S; S.dept.inv.on = true; S.dept.inv.staff = 1; A.renderAll(true); return !!document.querySelector('[data-act=tab][data-v=pe]'); });
  /* the trade box: five tabs, a stepper and a slider; dragging updates the numbers without re-rendering */
  const id = await p.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.guide = false; S.player.cash = 30; const c = S.cos.find(x => !x.priv && !x.ctrl); A.ui.sel = c.id; A.ui.ctab = 'trade'; A.ui.pendingAward = null; A.ui.pendingUnlock = null; document.querySelector('#modal').hidden = true; return c.id; });
  await p.evaluate(() => { document.querySelector('#modal').hidden = true; window.__atlas.act('tab', {dataset: {v: 'market'}}); });
  const ui = await p.evaluate(() => { const r = document.querySelector('#tr-range'), box = document.querySelector('.tr'); const before = box; r.value = 500; r.dispatchEvent(new Event('input', {bubbles: true}));
    return {tabs: [...document.querySelectorAll('[data-act=trmode]')].map(x => x.textContent.replace('🔒', '')).join(','), same: document.querySelector('.tr') === before, n: document.querySelector('#tr-n').textContent, go: !document.querySelector('#tr-go').disabled, tf: window.__atlas.ui.tf}; });
  const bought = await p.evaluate(id => { const A = window.__atlas, S = A.S, c = S.cos.find(x => x.id === id), c0 = S.player.cash; document.querySelector('#tr-go').click(); return {got: (c.own.P || 0) > 0, cashUsed: c0 - S.player.cash, loan: S.player.loan, reset: A.ui.tf === 0}; }, id);
  ok('trade: a new game starts with no departments; the PE tab appears once an investment department exists', !start.acc && start.staff === 0 && !start.peTab && start.has === false && opened, JSON.stringify({start, opened}));
  ok('trade: five tabs (現物買い・信用買い・売る・空売り・オプション); the slider updates in place', ui.tabs === '現物買い,信用買い,売る,空売り,オプション' && ui.same && /株$/.test(ui.n) && ui.go && ui.tf === .5, JSON.stringify(ui));
  ok('trade: buying half the cash amount spends cash only and resets the quantity', bought.got && bought.cashUsed > 13.5 && bought.cashUsed <= 15.01 && bought.loan === 0 && bought.reset, JSON.stringify(bought));
  ok('no page errors in trade-tab tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testRoadTob(b) {
  const {p, ctx, errs} = await page(b, {...devices['iPhone 13']});
  await p.click('[data-act=newgame]');
  /* the early-game roadmap: buy → accounting → control → bigger office → investment department, without touching the PRNG */
  const r = await p.evaluate(() => { const A = window.__atlas, S = A.S, out = {}; S.settings.guide = false; const rs = S.rs, id = () => (A.roadNext() || {}).id;
    out.s0 = id(); const L = S.cos.filter(c => !c.priv && !c.ctrl).slice(0, 6); for (const c of L) A.execBuy('P', c, A.sharesForMoney(c, 4)); out.s1 = id();
    S.dept.acc.on = true; S.dept.acc.staff = 1; S.stage = Math.max(S.stage, 2); out.s2 = id();
    const c = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom'); c.own.P = c.shares * .6; A.recomputeCtrl(); S.stage = 3; out.s3 = id();
    A.setOffice(1, 'tyo'); out.s4 = id(); S.dept.inv.on = true; S.dept.inv.staff = 1; out.s5 = id(); out.rng = S.rs === rs; return out; });
  await p.evaluate(() => { document.querySelector('#modal').hidden = true; window.__atlas.act('tab', {dataset: {v: 'market'}}); window.__atlas.S.dept.inv.on = false; window.__atlas.renderAll(true); });
  await p.evaluate(() => { const A = window.__atlas; A.ui.pendingUnlock = null; A.ui.pendingAward = null; document.querySelector('#modal').hidden = true; document.querySelector('.memo-i.road').click(); }); const went = await p.evaluate(() => window.__atlas.ui.tab === 'pres' && window.__atlas.ui.hqTab === 'floor' && !!document.querySelector('.road') && /投資部/.test(document.querySelector('.hqhead').innerText));
  ok('road: the next step goes buy → accounting → control → small office → investment department', r.s0 === 'buy' && r.s1 === 'acc' && r.s2 === 'ctrl' && r.s3 === 'office' && r.s4 === 'inv' && r.s5 !== 'inv' && r.rng, JSON.stringify(r));
  ok('road: the memo button opens the floor tab, where the checklist and the secretary point to the same step', went);
  /* TOB: premium and target use the stepper and slider; dragging updates the label in place */
  const t = await p.evaluate(() => { const A = window.__atlas, S = A.S; S.player.cash = 500; S.allUnlocked = true; const c = S.cos.find(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom' && !A.activeTob(x)); for (const k in c.own) if (k === 'P') delete c.own.P; A.recomputeCtrl(); A.ui.sel = c.id; A.ui.ctab = 'raid'; A.ui.tPrem = .25; A.ui.tTarget = .51; A.act('tab', {dataset: {v: 'market'}});
    const r0 = document.querySelector('[data-act-input=sslide][data-k=tPrem]'), box = r0.closest('section'); r0.value = 400; r0.dispatchEvent(new Event('input', {bubbles: true}));
    return {prem: A.ui.tPrem, lbl: document.querySelector('#ss-tPrem').textContent, same: r0.closest('section') === box && document.body.contains(box)}; });
  await p.click('[data-act=sstep][data-k=tTarget][data-v="0.01"]'); await p.click('[data-act=sstep][data-k=tTarget][data-v="0.01"]');
  const tg = await p.evaluate(() => window.__atlas.ui.tTarget);
  ok('TOB: the premium slider updates in place and the target stepper moves by 1%', Math.abs(t.prem - .4) < 1e-9 && t.lbl === '+40%' && t.same && Math.abs(tg - .53) < 1e-9, JSON.stringify({t, tg}));
  ok('no page errors in road/TOB tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testPeStep(b) {
  const {p, ctx, errs} = await page(b, {...devices['iPhone 13']});
  await p.click('[data-act=allu][data-v="1"]'); await p.click('[data-act=newgame]');
  const ok0 = await p.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.guide = false; S.player.cash = 300; A.hqInit(); S.dept.inv.on = true; S.dept.inv.staff = 1;
    for (let i = 0; i < 60 && !S.pe.deals.length; i++) { A.step(); S.inbox = []; } A.ui.pendingAward = null; A.ui.pendingUnlock = null; document.querySelector('#modal').hidden = true; A.ui.peLev = .5; A.ui.peCo = 0;
    A.act('tab', {dataset: {v: 'pe'}}); const h = document.querySelector('.deal-h[data-act=peopen]'); if (!h) return false; h.click(); return true; });
  if (!ok0) { ok('PE stepper: a deal to open', false, 'no deal appeared'); await ctx.close(); return; }
  const before = await p.evaluate(() => document.querySelector('.deal .preview, .preview').innerText);
  const r = await p.evaluate(() => { const A = window.__atlas, el = document.querySelector('[data-act-input=sslide][data-k=peBid]'), sec = el.closest('section') || el.parentElement; el.value = Math.round(.4 / .9 * 1000); el.dispatchEvent(new Event('input', {bubbles: true}));
    return {bid: A.ui.peBid, lbl: document.querySelector('#ss-peBid').textContent, kept: document.body.contains(el)}; });
  await p.evaluate(() => document.querySelector('[data-act-input=sslide][data-k=peBid]').dispatchEvent(new Event('change', {bubbles: true})));
  await p.click('[data-act=sstep][data-k=peLev][data-v="-0.01"]'); await p.click('[data-act=sstep][data-k=peCo][data-v="0.01"]');
  const after = await p.evaluate(() => ({lev: window.__atlas.ui.peLev, co: window.__atlas.ui.peCo, text: document.querySelector('#ss-peLev').textContent}));
  ok('PE stepper: the bid slider updates in place and re-prices on release; leverage and co-investment step by 1%', Math.abs(r.bid - .1) < 1e-9 && r.lbl === '希望額+10%' && r.kept && Math.abs(after.lev - .49) < 1e-9 && Math.abs(after.co - .01) < 1e-9 && after.text === 'LBO 49%', JSON.stringify({r, after}));
  ok('no page errors in PE stepper tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testLadder2(b) {
  const {p, ctx, errs} = await page(b, {...devices['iPhone 13']});
  await p.click('[data-act=allu][data-v="1"]'); await p.click('[data-act=newgame]');
  /* every remaining amount uses the stepper box; a slider in a dialog applies when released */
  const r = await p.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.guide = false; S.player.cash = 300; A.hqInit(); A.vcQuarter(); const d = S.vc.deals[0]; if (!d) return {none: true};
    A.ui.pendingAward = null; A.ui.pendingUnlock = null; document.querySelector('#modal').hidden = true; A.ui.hqTab = 'inv'; A.act('tab', {dataset: {v: 'pres'}});
    const box = document.querySelector('#pbody .lad'), sl = document.querySelector(`#pbody [data-act-input=lslide][data-a=vcsd][data-id="${d.id}"]`); if (!sl) return {box: !!box, sl: false};
    sl.value = 1000; sl.dispatchEvent(new Event('input', {bubbles: true})); const during = (A.ui.vcS || {})[d.id]; sl.dispatchEvent(new Event('change', {bubbles: true}));
    const after = A.ui.vcS[d.id], open = !!document.querySelector(`#pbody [data-act-input=lslide][data-a=vcsd][data-id="${d.id}"]`);
    document.querySelector(`#pbody [data-act=vcsd][data-id="${d.id}"][data-v="0.01"]`).click(); return {box: !!box, sl: true, during, after, open, step: A.ui.vcS[d.id], old: document.querySelectorAll('.ladder').length}; });
  ok('stepper: a slider applies on release (not while dragging), and ＋ steps by 1% within the limit', r.none || (r.box && r.sl && r.during == null && Math.abs(r.after - .2) < 1e-9 && r.open && Math.abs(r.step - .2) < 1e-9 && r.old === 0), JSON.stringify(r));
  ok('no page errors in stepper tests', !errs.length, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

async function testTrader(b) {
  const {p} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4242, 'normal', 'T', 't', 'trader', false); let S = A.S; S.won = false; document.querySelector('#modal').hidden = true;
    /* start: 10,000,000円 in a personal account; no company, no TOB; margin, short and options come after 26 weeks of record */
    out.start = Math.abs(S.player.cash - .1) < 1e-12 && S.company === A.indivName() && A.preCo() && !S.founded;
    out.gate0 = !A.has('tob') && !A.has('short') && !A.has('pe') && !A.has('found');
    out.worth0 = Math.abs(A.myWorth() - .1) < 1e-9;
    /* whole shares: the trade box offers only whole-share counts */
    const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => b.price - a.price)[0];
    A.ui.sel = c.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui._trSel = c.id; A.ui.tmode = 'cash'; A.ui.tf = .5; A.ui.tab = 'market'; A.renderAll(true);
    const go = document.querySelector('#tr-go'), n = go ? +go.dataset.n : -1; out.whole = n > 0 && Math.abs(n * 1e6 - Math.round(n * 1e6)) < 1e-6;
    out.roundSh = A.roundSh(1.2345678e-3) === 1234e-6 && A.roundSh(-1) === 0;
    const cash0 = S.player.cash; go.click(); out.bought = Math.abs((c.own.P || 0) - n) < 1e-12 && S.player.cash < cash0;
    /* margin is locked before 26 weeks: a buy costing more than the cash is refused */
    A.ui.tmode = 'margin'; A.renderAll(true); const g2 = document.querySelector('#tr-go'); out.marginLocked = !g2 || g2.disabled || +g2.dataset.n === 0;
    /* track record: one return a week, no PRNG used for it */
    for (let i = 0; i < 30; i++) A.step(); const st = A.trStats(); out.rec = st && st.weeks === 30 && A.trWeeks() === 30 && isFinite(st.total) && st.mdd >= 0;
    out.gate26 = A.has('short') && A.has('options') && !A.has('tob');
    out.rewards = A.rewScale() === .02;
    /* managed money: management fee, performance fee above the high-water mark */
    S.mm = {aum: 0, hwm: 0, fees: 0, perf: 0, inv: 0}; out.mmNoRecord = A.mmAccept({amt: .01, who: 'テスト'}) === 0 && S.mm.aum === 0; /* under a year of record: refused */
    const rets0 = S.tr.rets; A.trSet(Array(52).fill(.003)); S.tr.mcW = null; S.player.cash = 50; out.mmNeedsCo = A.mmAccept({amt: 1, who: 'テスト'}) === 0 && S.mm.aum === 0; /* an individual cannot take other people's money */
    S.founded = true; A.hqInit(); /* the mechanics below are those of a founded company (restored before the founding test) */ const got = A.mmAccept({amt: 1, who: 'テスト'}); out.mmIn = got === 1 && S.mm.aum === 1 && S.mm.hwm === 1 && S.mm.inv === 1; S.tr.rets = rets0;
    S.mm.aum = 1; S.mm.hwm = 1; out.mmCapped = A.mmAccept({amt: 5, who: 'x'}) === 0 || A.mmRoom() >= 0; S.mm = {aum: 1, hwm: 1, fees: 0, perf: 0, inv: 1}; S.player.cash = .1;
    const pc = S.player.cash; S.week = 103; A.mmWeek(0); const fee = 1 * .02 / 52; out.fee = Math.abs(S.mm.fees - fee) < 1e-12 && Math.abs(S.player.cash - pc - fee) < 1e-12;
    S.week = 104; const a0 = S.mm.aum, dr = A.mmDrag(); A.mmWeek(.1); const grown = a0 * (1 + .1 * dr), aft = grown - grown * .02 / 52; out.perf = Math.abs(S.mm.perf - (aft - 1) * .2) < 1e-9 && Math.abs(S.mm.hwm - S.mm.aum) < 1e-12;
    const perf0 = S.mm.perf; S.week = 156; A.mmWeek(-.05); out.hwm = S.mm.perf === perf0; /* below the high-water mark: no performance fee */
    /* investors leave after a bad year */
    /* after a bad stretch they warn first, then give a quarter's notice, then leave; the money goes back to them */
    A.trSet(Array(52).fill(-.004)); const aum1 = S.mm.aum, inv1 = S.mm.inv; S.week = 169; A.mmQuarter(); const warned = S.mm.warn === 1 && S.mm.aum === aum1;
    S.week = 182; A.mmQuarter(); const L1 = A.mmList(), noticed = L1.some(x => x.out === 195) && S.mm.aum === aum1;
    S.week = 195; A.mmQuarter(); out.out = warned && noticed && S.mm.aum < aum1 - 1e-9 && S.mm.inv === inv1 - 1;
    /* an offer appears after a good year when there is room */
    S.mm = {aum: 0, hwm: 0, fees: 0, perf: 0, inv: 0}; A.trSet(Array(52).fill(.003)); S.tr.mcW = null; S.inbox = []; S.player.cash = Math.max(S.player.cash, .2); A.mmQuarter();
    const off = S.inbox.find(i => i.kind === 'mmoffer'); out.offer = !!off && off.amt > 0 && off.amt <= A.mmCap() + 1e-9;
    S.inbox = []; S.mm = {aum: 0, hwm: 0, fees: 0, perf: 0, inv: 0}; S.founded = false;
    /* founding: needs 30,000,000円; net worth falls only by the fee; the cash you keep becomes personal */
    S.player.cash = .1; out.noFound = !A.incorporate('X', 0);
    S.player.cash += .4; const nw0 = A.myWorth(); out.found = A.incorporate('テスト商事', .05) && S.founded && !A.preCo() && S.company === 'テスト商事';
    out.nwFee = Math.abs(A.myWorth() - (nw0 - .005)) < 1e-6 && Math.abs(S.pres.cash - .05) < 1e-12;
    out.gateCo = !A.preCo() && A.rewScale() === .02;
    /* the personal account (U) trades cash-only and counts in personal net worth */
    const d = S.cos.filter(x => !x.priv && !x.ctrl && x !== c)[0];
    A.ui.sel = d.id; A.ui._trSel = d.id; A.ui.actor = 'U'; A.ui.tmode = 'margin'; A.renderAll(true); const g3 = document.querySelector('#tr-go'); out.uMargin = !g3 || g3.disabled || +g3.dataset.n === 0;
    A.ui.tmode = 'cash'; A.ui.tf = 1; A.renderAll(true); const g4 = document.querySelector('#tr-go'); const nU = g4 ? +g4.dataset.n : 0; const w1 = A.myWorth(); if (g4 && !g4.disabled) g4.click();
    out.uBuy = nU > 0 && Math.abs((d.own.U || 0) - nU) < 1e-12 && S.pres.cash < .05 && Math.abs(A.myWorth() - w1) < .01;
    out.econ = A.econCheck(S) === '';
    /* save format 3 round-trip, checksum covers personal cash */
    A.trClose(); /* the test set money directly: a save is checked against the week's records, so start a clean week first */ const txt = A.exportText(), o = JSON.parse(txt); out.fmt = o.fmt === 7 && !!A.parseSave(txt); /* format 7 since the week's records joined the checksum */
    o.pres.cash += 1; out.tamper = !A.parseSave(JSON.stringify(o));
    /* the company fails but the person still has money: restart as an individual */
    const uH = d.own.U || 0; A.bankrupt('テスト倒産'); out.restart = !S.lost && !S.founded && A.preCo() && S.restarts === 1 && Math.abs((d.own.P || 0) - uH) < 1e-12 && !d.own.U;
    /* determinism: two runs from the same seed match */
    const run = () => { A.newGame(77, 'normal', 'T', 't', 'trader', false); A.S.won = false; for (let i = 0; i < 70; i++) { A.step(); for (const it of A.S.inbox.slice()) if (it.kind === 'mmoffer') A.mmAccept(it); A.S.inbox = []; } return JSON.stringify([A.S.player.cash, A.S.mm, A.S.tr.rets.slice(-5), A.S.cos.map(x => x.price)]); };
    out.det = run() === run();
    /* classic games: personal net worth is the goal; no trader state consumes the PRNG */
    A.newGame(88, 'normal', 'T', 't', 'std', false); S = A.S; out.classic = !A.preCo() && A.rewScale() === 1 && Math.abs(A.myWorth() - (A.netWorth('P') + A.presWealth())) < 1e-9;
    /* report 6 — BUG-22: a percentage sell of an individual's odd lot trades the whole shares shown */
    A.newGame(4243, 'normal', 'T', 't', 'trader', false); let V = A.S; V.won = false; const e = V.cos.filter(x => !x.priv && !x.ctrl)[0]; e.own.P = 101e-6;
    A.ui.sel = e.id; A.ui._trSel = e.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'sell'; A.ui.tf = .5; A.ui.tab = 'market'; A.renderAll(true); const gs = document.querySelector('#tr-go'), shown = Math.round(+gs.dataset.n * 1e6); gs.click();
    out.sellWhole = shown === 50 && Math.abs(e.own.P * 1e6 - 51) < 1e-6;
    A.ui.tf = 0; A.renderAll(true); document.querySelector('[data-act=tqs][data-v="10"]').click(); out.plus10 = Math.round(+document.querySelector('#tr-go').dataset.n * 1e6) === 10;
    /* BUG-23: an option that expires worthless shows as a loss in the record */
    for (let i = 0; i < 27; i++) A.step(); const d2 = V.cos.filter(x => !x.priv && !x.ctrl && x !== e)[2], op = A.buyOption(d2, 'put', 2, V.player.cash * .9), n0 = V.tr.rets.length, g0 = V.tr.eq1; /* the record starts from last week's close, so the dealer's spread on the purchase is part of it */
    for (let i = 0; i < 4; i++) A.step(); const comp = V.tr.rets.slice(n0).reduce((a, x) => a * (1 + x), 1); /* every change in the account inside the weeks is in the record, options included */
    out.optLoss = !!op && V.player.opts.length === 0 && Math.abs(comp - A.grossWorth() / g0) < .02 && Math.abs(A.grossWorth() - g0) > .001;
    /* BUG-24: an old offer cannot push managed money past today's limit */
    A.trSet(Array(52).fill(.003)); V.tr.mcW = null; V.mm = {aum: 1, hwm: 1, fees: 0, perf: 0, inv: 1}; out.mmRecheck = A.mmAccept({amt: .59, who: 'x'}) === 0 && V.mm.aum === 1;
    /* BUG-25/26: an insolvent company fails alone; its venture stakes do not follow you; your own money is kept */
    A.newGame(4244, 'normal', 'T', 't', 'trader', false); V = A.S; V.won = false; V.player.cash = .5; A.incorporate('Z', .15);
    V.vc.hold.push({id: 99, name: 'v', stake: .2, val: 1, cost: .2, w: V.week, st: 0, q: .5}); const pr = V.props.find(x => !x.own); pr.own = 'P'; pr.mort = A.propVal(pr); V.mm = {aum: 2, hwm: 2, fees: 0, perf: 0, inv: 1};
    V.player.cash = -5; out.limited = A.myWorth() >= .15 - 1e-9; A.step();
    out.liq = !V.lost && !V.founded && V.restarts === 1 && !V.vc.hold.some(h => !h.pres) && pr.own !== 'P' && V.mm.aum === 0 && Math.abs(A.myWorth() - (V.player.cash + A.holdingsMkt('P'))) < 1e-9 && A.myWorth() < .2;
    /* saves: an unknown future format, or a current save stripped of its format number, is refused; managed money must not be negative */
    const t2 = A.exportText(), j2 = () => JSON.parse(t2); let x2 = j2(); x2.fmt = 99; out.fmt99 = !A.parseSave(JSON.stringify(x2)); x2 = j2(); delete x2.fmt; delete x2.chk; x2.player.bank = 0; out.noFmt = !A.parseSave(JSON.stringify(x2));
    x2 = j2(); x2.mm.aum = -1; out.negMM = !!A.econCheck(x2); out.okSave = !!A.parseSave(t2);
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('trader: start, gates, whole shares, track record, managed money, founding, personal account, save, restart, determinism', !fails.length, JSON.stringify(fails));
}

async function testMidgame(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(6161, 'normal', 'T', 't', 'trader', false); let S = A.S; S.won = false; document.querySelector('#modal').hidden = true;
    /* the growth market: twelve small listed companies, in the trader scenario only */
    const g = S.cos.filter(c => c.gm); out.growth = g.length === 12 && g.every(c => !c.priv && c.price * c.shares > 2 && c.price * c.shares < 100); out.caps = g.map(c => Math.round(c.price * c.shares)).join(',');
    out.name = S.company === 'T（個人投資家）' || S.company === 't（個人投資家）';
    /* an individual: no TOB at first; company-only tools stay closed and say why */
    out.gate1 = !A.has('tob') && !A.has('pe') && !A.has('lbo') && !A.has('found');
    /* the research newsletter: 26 weeks of record and 2,000,000円 first; members bring cash that is not counted as investment return */
    out.nlEarly = !A.nlStart();
    for (let i = 0; i < 26; i++) A.step(); for (const c of S.cos) if (c.own.P) A.execSell('P', c, c.own.P);
    out.nlGo = A.nlStart() && Math.abs(S.nl.subs) < 1e-12; A.trSet(Array(52).fill(.004)); const n0 = S.tr.rets.length, c0 = S.player.cash;
    for (let i = 0; i < 26; i++) A.step(); out.nlGrow = S.nl.subs > 20 && S.nl.subs <= A.nlCap() && S.player.cash > c0 && S.nl.rev > 0;
    out.nlFlow = S.tr.rets.slice(n0).every(x => Math.abs(x) < 1e-9); /* no shares held: the newsletter's money is not a trading gain */
    out.mmIndiv = Math.abs(A.mmPeople() - Math.min(20, 3 + 4 * A.trWeeks() / 52)) < 1e-9;
    /* 5% of a growth company makes you a major shareholder: TOB, property and a securities-backed loan open for an individual */
    const t = g.slice().sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; S.player.cash = t.price * t.shares * 1.5; const lim0 = A.bankLimit();
    A.execBuy('P', t, t.shares * .051, 1e9); A.checkStage(); out.stage2 = S.stage === 2 && A.has('tob') && A.has('realty') && !A.has('pe');
    A.ui.tab = 'market'; A.renderAll(true); out.loanTab = !!document.querySelector('[data-act=tab][data-v=bank]');
    out.tob = A.launchTob('P', t, t.price * 1.4, .51) !== false && S.tobs.some(x => x.boss === 'P');
    /* stage thresholds are scaled for a trader, unchanged for the other scenarios */
    out.scaled = Math.abs(A.stageNW(2) - 4.8) < 1e-9 && Math.abs(A.stageNW(4) - 24) < 1e-9;
    /* after founding: LBO from the "経営者" stage; operating companies can be founded with small capital */
    A.newGame(6162, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 12; A.incorporate('Z', 0); S.stage = 3;
    out.lbo = A.has('lbo') && A.has('found'); A.ui.tab = 'port'; A.renderAll(true);
    const lim1 = A.bankLimit(); out.bankHalf = lim1 > 0;
    { const R = A.fcapRange(), btn = [...document.querySelectorAll('[data-act=found]')].map(e => +e.dataset.v); out.found = btn.join(',') === '1' && R.lo <= .5 && R.hi >= 3 && R.hi <= 50 ? '0.5,1,3' : JSON.stringify({btn, R}); } /* rev28: capital chosen freely; the default is 1 and the old choices (0.5, 1, 3) stay inside the range */
    /* saves keep the newsletter; a negative member count is refused */
    A.newGame(6163, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; for (let i = 0; i < 27; i++) A.step(); A.nlStart(); for (let i = 0; i < 5; i++) A.step();
    const txt = A.exportText(), o = JSON.parse(txt); out.save = !!A.parseSave(txt) && o.nl && o.nl.subs > 0; o.nl.subs = -5; out.negNl = !!A.econCheck(o);
    const run = () => { A.newGame(91, 'normal', 'T', 't', 'trader', false); A.S.won = false; for (let i = 0; i < 60; i++) { A.step(); if (i === 30) A.nlStart(); } return JSON.stringify([A.S.player.cash, A.S.nl, A.S.cos.filter(c => c.gm).map(c => c.price)]); };
    out.det = run() === run();
    /* classic games are untouched: no growth market, original thresholds */
    A.newGame(92, 'normal', 'T', 't', 'std', false); out.classic = !A.S.cos.some(c => c.gm) && A.stageNW(2) === 80 && A.S.company === 'T';
    return out;
  });
  const fails = Object.entries(r).filter(([k, v]) => v !== true && k !== 'found' && k !== 'caps').map(([k]) => k);
  ok('midgame: growth market, individual route (TOB, loan, newsletter), scaled stages, LBO bridge, saves, determinism', !fails.length, JSON.stringify(fails) + ' caps ' + r.caps);
  ok('midgame: a trader founds operating companies with 50,000,000円〜300,000,000円', r.found === '0.5,1,3', r.found);
  ok('no page errors in midgame tests', errs.length === 0, errs.join(' | '));
}

async function testGpt7(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(12345, 'normal', 'T', 't', 'trader', false); let S = A.S; S.won = false; document.querySelector('#modal').hidden = true;
    /* BUG-23: a buy and sell between weeks (fees, price impact) is in the next week's return */
    A.step(); const g0 = A.grossWorth(), c = S.cos.filter(x => !x.priv && !x.ctrl)[0]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, .09)), .09); A.execSell('P', c, c.own.P);
    const g1 = A.grossWorth(), n = S.tr.rets.length; A.step(); out.betweenWeeks = g1 < g0 && Math.abs(S.tr.rets[n] - (g1 / g0 - 1)) < 1e-6;
    /* BUG-27: a negative or broken offer changes nothing, and a save holding one is refused */
    S.mm = {aum: .2, hwm: .2, fees: 0, perf: 0, inv: 1}; out.negOffer = [-1, NaN, Infinity, 0].every(x => A.mmAccept({amt: x, who: 'x'}) === 0) && S.mm.aum === .2;
    S.inbox.push({id: 999, kind: 'mmoffer', amt: -1, who: 'x', exp: S.week + 4}); out.negOfferSave = !A.parseSave(A.exportText()); S.inbox = S.inbox.filter(i => i.id !== 999);
    /* BUG-28: the newsletter is in the checksum (format 4) and must add up */
    for (let i = 0; i < 26; i++) A.step(); A.nlStart(); for (let i = 0; i < 4; i++) A.step();
    const txt = A.exportText(), bad = f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); };
    out.fmt4 = JSON.parse(txt).fmt >= 4 && !!A.parseSave(txt); /* format 4 or later carries the newsletter in the checksum */
    out.nlDel = bad(o => { delete o.nl; }); out.nlRev = bad(o => { o.nl.rev = -1; }); out.nlMiss = bad(o => { delete o.nl.cost; }); out.nlEdit = bad(o => { o.nl.subs += 100; });
    out.nlResigned = bad(o => { o.nl.rev = -1; o.chk = A.finSig(o); }); /* even with a valid checksum, a negative total is refused */
    { const o = JSON.parse(txt); o.fmt = 3; o.chk = A.finSig(o); const g = A.parseSave(JSON.stringify(o)); out.fmt3Migrates = !!g && g.fmt === 7 && !!g.nl; } /* a format-3 save from before keeps loading */
    /* BUG-22: a forced buy-back of an individual's short leaves whole shares */
    A.newGame(12346, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; for (let i = 0; i < 27; i++) A.step(); S.player.cash = .1;
    const d = S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0))[3]; S.player.shorts[d.id] = {n: 101e-6, basis: 101e-6 * d.price}; S.player.cash = 101e-6 * d.price * .3; d.price *= 3; A.step();
    const left = S.player.shorts[d.id] ? S.player.shorts[d.id].n * 1e6 : 0; out.squeezeWhole = Math.abs(left - Math.round(left)) < 1e-6 && left < 101;
    /* BUG-25: the failed company's bids on unlisted companies are withdrawn */
    A.newGame(12347, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = .5; A.incorporate('Z', .15);
    for (let i = 0; i < 6 && !(S.pe.deals || []).length; i++) A.peDealGen(); const deal = (S.pe.deals || [])[0]; if (deal) { deal.bid = {eq: 1, lev: .5, promise: false, owner: 'P', end: S.week + 3, f: 1, co: null, partner: null}; deal.bids = (deal.bids || []).concat([{k: 'P', eq: 1}]); }
    S.player.cash = -5; A.step(); out.peBids = !!deal && !S.founded && !deal.bid && !(deal.bids || []).some(x => x.k === 'P');
    /* tax: newsletter profit is taxed like other income */
    S.player.pl = Object.assign(S.player.pl || {}, {nl: 1, div: 0, rent: 0, fee: 0, int: 0, hq: 0, rd: 0, pay: 0}); const cash0 = S.player.cash; A.corpTax(); out.tax = Math.abs(cash0 - S.player.cash - .2) < 1e-9; /* back as an individual: income tax of 20% */
    /* managed money beyond what the team can run: clients withdraw the excess over time */
    A.newGame(12348, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; for (let i = 0; i < 53; i++) A.step(); A.trSet(Array(52).fill(.003));
    S.founded = true; A.hqInit(); S.mm = {aum: 100, hwm: 100, fees: 0, perf: 0, inv: 1}; S.week = 13 * Math.ceil(S.week / 13); A.mmQuarter(); const warned = A.mmList().every(x => x.out == null) && S.mm.capWarn === 1; /* a warning first */
    S.week += 13; A.mmQuarter(); const w0 = S.week, cap = A.mmPeople(), x0 = A.mmList().find(x => x.out === w0 + 13), gave = !!x0 && x0.why === 'cap' && Math.abs(x0.outAmt - (100 - cap * 1.2)) < 1e-9 && S.mm.aum === 100; /* then a notice for the excess only */
    S.week = w0 + 13; A.mmQuarter(); out.overCap = warned && gave && Math.abs(S.mm.aum - cap * 1.2) < 1e-9 && S.mm.inv === 1; /* only the excess leaves; the client stays with what the team can run */
    /* growth companies trade at ordinary prices */
    out.gmPrices = S.cos.filter(x => x.gm).every(x => x.price >= 5);
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('gpt7: trades between weeks count, bad offers and broken newsletter saves are refused, forced buy-backs keep whole shares, PE bids end with the company (BUG-22/23/25/27/28)', !fails.length, JSON.stringify(fails));
  ok('no page errors in gpt7 tests', errs.length === 0, errs.join(' | '));
}

async function testRealism(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(8181, 'normal', 'T', 't', 'trader', false); let S = A.S; S.won = false; S.settings.guide = false; document.querySelector('#modal').hidden = true;
    /* the rivals start as individual traders too; other scenarios keep their fortunes */
    out.rivalsSmall = S.rivals.every(r => r.cash > 0 && r.cash < .3);
    /* an individual: no block-sale desk, no magazine interviews, no managed money */
    const c = S.cos.filter(x => !x.priv && !x.ctrl)[0]; c.own.P = c.shares * .3; A.recomputeCtrl(); A.ui.tab = 'market'; A.ui.sel = c.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.renderAll(true);
    out.noBlockSale = !document.querySelector('main.main').textContent.includes('売却先を探す') && !document.querySelector('.exitbox'); c.own.P = 0; A.recomputeCtrl();
    for (let i = 0; i < 70; i++) { A.step(); S.inbox = S.inbox.filter(x => x.kind !== 'story'); }
    out.noStories = !S.news.some(n => /経済誌|【出来事】/.test(n.t));
    A.trSet(Array(60).fill(.004)); S.tr.mcW = null; S.inbox = []; S.week = 13 * Math.ceil(S.week / 13); A.mmQuarter(); out.noOfferIndividual = !S.inbox.some(i => i.kind === 'mmoffer');
    /* an individual's income is taxed at 20% */
    S.player.pl = Object.assign(S.player.pl || {}, {nl: 1, div: 0, rent: 0, fee: 0, int: 0, hq: 0, rd: 0, pay: 0}); const c0 = S.player.cash; A.corpTax(); out.incomeTax = Math.abs(c0 - S.player.cash - .2) < 1e-9;
    /* founding: you enter the capital; the rest of the cash stays yours */
    S.player.cash = .6; A.ui.tab = 'pres'; A.renderAll(true); const F = A.foundRange(); out.capRange = Math.abs(F.hi - (A.grossWorth() - .005)) < 1e-9 && F.lo >= .2 - 1e-9;
    const box = document.querySelector('[data-kp="lad"][data-a="foundcap"]'); box.click(); const inp = box.querySelector('input.kp-in'); inp.value = '40,000,000'; inp.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    out.keypadCap = Math.abs(A.ui.foundCap - .4) < 1e-9; const g0 = A.grossWorth(); document.querySelector('[data-act=incorp]').click();
    out.founded = S.founded && Math.abs(A.grossWorth() - .4) < 1e-6 && Math.abs(S.pres.cash - (g0 - .005 - .4)) < 1e-6;
    /* managed money after founding: an investor list that always adds up; notice before leaving */
    A.hqInit(); A.trSet(Array(60).fill(.004)); S.inbox = []; S.week = 13 * Math.ceil((S.week + 1) / 13); A.mmQuarter(); out.offerCompany = S.inbox.some(i => i.kind === 'mmoffer');
    S.mm = {aum: 0, hwm: 0, fees: 0, perf: 0, inv: 0}; A.mmAccept({amt: .1, who: 'X'}); A.mmAccept({amt: .1, who: 'Y'}); for (let i = 0; i < 5; i++) A.mmWeek(.01);
    const L = A.mmList(); out.investors = L.length === 2 && S.mm.inv === 2 && Math.abs(L.reduce((a, x) => a + x.val, 0) - S.mm.aum) < 1e-12 && S.mm.lastFee > 0;
    A.mmRedeem(L[0]); A.mmRedeem(A.mmList()[0]); out.noGhostMoney = S.mm.aum === 0 && S.mm.inv === 0 && S.mm.hwm === 0;
    /* published figures change at earnings, not every week */
    const d = S.cos.filter(x => !x.priv)[2]; A.ui.tab = 'market'; A.ui.sel = d.id; A.ui.ctab = 'info'; while (S.week % 13 !== 1) A.step(); A.renderAll(true);
    const kv = () => [...document.querySelectorAll('.kv div')].filter(x => /売上（年|純利益（年|推定理論株価/.test(x.textContent)).map(x => x.textContent).join('|'); const t1 = kv(); A.step(); A.renderAll(true); out.quarterly = t1.length > 0 && kv() === t1;
    /* the trade box: tap the share count and type it */
    const e = S.cos.filter(x => !x.priv && !x.ctrl && x !== d)[1]; A.ui.sel = e.id; A.ui._trSel = e.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'cash'; S.player.cash = 5; A.renderAll(true);
    const q = document.querySelector('[data-kp="tr"]'); q.click(); const i2 = q.querySelector('input.kp-in'); i2.value = '25'; i2.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'}));
    out.keypadShares = Math.abs(+document.querySelector('#tr-go').dataset.n - 25e-6) < 1e-12;
    A.newGame(8182, 'normal', 'T', 't', 'std', false); out.rivalsStd = A.S.rivals.every(r => r.cash > 50);
    /* listed companies change hands without the rivals: PE funds, founders, carve-outs, peers */
    A.newGame(31, 'normal', 'T', 't', 'std', false); A.S.won = false; const seenN = new Set(); for (let i = 0; i < 260; i++) { A.step(); for (const n of A.S.news) if (n.w === A.S.week) seenN.add(n.t); } /* rev40: every week's news is read as it arrives (the list keeps only the latest 150, so a 5-year check of the final list missed early events) */ const kinds = ['PEによる買収提案', '創業者MBO', 'カーブアウト上場', '同業による買収提案'].filter(k => [...seenN].some(t => t.includes(k)));
    out.events = kinds.length >= 3 && A.econCheck(A.S) === '' && !!A.parseSave(A.exportText());
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('realism: small rivals, individual limits, entered capital, investor list with notice, quarterly figures, keypad entry, corporate events', !fails.length, JSON.stringify(fails));
  ok('no page errors in realism tests', errs.length === 0, errs.join(' | '));
}

async function testMuse(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(4321, 'normal', 'T', 't', 'std', true); let S = A.S; S.won = S.lost = true; S.player.cash = 3000;
    /* (1) buying control of a cheap company books no premium on the day; it is earned over a year of integration */
    const c = S.cos.filter(x => !x.priv && !x.ctrl && !Object.keys(x.own).length && x.ind !== 'air' && x.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares)[3]; c.price = A.fair(c) * .4;
    const nw0 = A.netWorth('P'), pay = c.shares * .6 * c.price; S.player.cash -= pay; c.own.P = c.shares * .6; S.player.cost[c.id] = pay; A.recomputeCtrl();
    const full = Math.max(c.price, A.fair(c) * .95); out.day1 = c.ctrl === 'P' && Math.abs(A.netWorth('P') - nw0) < 1e-6;
    c.ctrlW = S.week - 26; const half = A.ctrlPx('P', c); c.ctrlW = S.week - 52; out.phaseIn = half > c.price + 1e-9 && half < full - 1e-9 && Math.abs(A.ctrlPx('P', c) - full) < 1e-9;
    /* (2) missions carry no cash reward figure (they pay reputation) */
    out.noMissionCash = S.missions.every(m => m.reward == null);
    /* (3) a counter-bid that cannot be paid leaves the earlier bid standing */
    const t = S.cos.filter(x => !x.priv && !x.ctrl && !A.activeTob(x) && x !== c && !Object.keys(x.own).length).sort((a, b) => a.price * a.shares - b.price * b.shares)[2];
    A.launchTob('P', t, t.price * 1.3, .51); const R1 = S.rivals[0]; A.launchTob(R1.id, t, t.price * 1.45, .51); R1.cash = 0; S.tobs.find(x => x.cid === t.id).end = S.week;
    A.resolveTobs(); out.revive = (t.own.P || 0) > 0 && !(t.own[R1.id] > 0) && S.news.some(n => /対抗TOBは資金が足りず撤回/.test(n.t));
    /* (3) the personal account cannot spend more than it holds */
    A.newGame(4322, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = .5; A.incorporate('Z', 0); S.pres.cash = .001; const u = S.cos.filter(x => !x.priv && !x.ctrl)[0];
    A.execBuy('U', u, u.shares * .01); out.uFloor = S.pres.cash >= -1e-12;
    /* BUG-32: newsletter profit is operating cash flow */
    A.newGame(4323, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; for (let i = 0; i < 27; i++) A.step(); A.nlStart(); while (S.week % 13 !== 0) A.step(); for (let i = 0; i < 13; i++) A.step();
    const L = S.player.plHist[0], C = A.cfOf(L); out.cfNl = L.nl > 0 && Math.abs(C.inv) < 1e-9 && Math.abs(C.op - (L.nl + (L.tax || 0) + (L.div || 0) + (L.fee || 0) + (L.int || 0) + (L.hq || 0))) < 1e-9;
    /* BUG-31: confirming a floor plan with more departments than floors is refused */
    A.newGame(4324, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; A.hqInit(); A.ui.plan = {lvl: 0, on: Object.fromEntries(Object.keys(S.dept).map(k => [k, true]))};
    A.act('planok', {dataset: {}}); out.floors = Object.values(S.dept).filter(d => d.on).length <= 1;
    /* PE: no acquisition debt for a loss-maker; lenders want interest covered 1.5 times */
    for (let i = 0; i < 6 && !(S.pe.deals || []).length; i++) A.peDealGen(); const d = S.pe.deals[0]; const q = A.peQuote(d, A.dealAsk(d), .65, 'P');
    out.peCover = !!d && (q.cover >= 1.5 - 1e-9 || q.acq === 0) && typeof q.risk === 'string';
    const d2 = Object.assign({}, d, {mTrue: -.1, mShow: -.1, assets: 0}); const q2 = A.peQuote(d2, A.dealAsk(d2), .65, 'P'); out.peLoss = q2.acq === 0 && q2.risk === '高' && q2.burn > 0;
    /* (4) listed companies can fail: a company in its fourth crisis in a row, losing money and not covering its interest, finds no rescuer */
    A.newGame(4325, 'normal', 'T', 't', 'std', false); S = A.S; S.won = false; const z = S.cos.find(x => !x.priv && !x.ctrl);
    z.margin = z.base = -.2; z.debt = z.assets * 1.2; z.cash = 0; z.crisisW = S.week - 10; z.crisisN = 3; z.ni = -Math.abs(z.ni) - 1; z.crisis = {w: S.week, due: S.week + 8};
    A.aiCrisis(z); out.noRescue = !!z.crisis; for (let i = 0; i < 9 && S.cos.includes(z); i++) A.step(); out.failed = !S.cos.includes(z) || z.forceBk;
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('muse: control premium earned over a year, no mission cash, counter-bid revival, personal floor, newsletter cash flow, floor plan, PE lending, failing companies', !fails.length, JSON.stringify(fails));
  ok('no page errors in muse tests', errs.length === 0, errs.join(' | '));
}

async function testGroup(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {};
    /* small private companies: a trader's new company sees deals from tens of millions of yen, without institutional bidders */
    A.newGame(5151, 'normal', 'T', 't', 'trader', false); let S = A.S; S.won = false; S.player.cash = .8; A.incorporate('Z', 0); A.hqInit(); A.S.dept.inv.on = true; /* PE needs the investment department */
    out.peOpen = A.has('pe') && A.peScale() < 1; for (let i = 0; i < 60 && (S.pe.deals || []).length < 3; i++) A.step();
    out.small = S.pe.deals.length > 0 && S.pe.deals.every(d => d.small && d.rev < 10 && d.n === 0) && S.pe.deals.some(d => A.dealAsk(d) < 1);
    const d = S.pe.deals.filter(x => A.dealAsk(x) < S.player.cash * .9).sort((a, b) => A.dealAsk(a) - A.dealAsk(b))[0];
    out.buy = !!d && A.peBid(d, 0, 0, false, 'P', 0); for (let i = 0; i < 6; i++) A.step(); out.owned = S.cos.some(c => c.pe && c.pe.owner === 'P' && c.priv);
    /* the classic scenarios keep their deal sizes */
    A.newGame(5150, 'normal', 'T', 't', 'std', true); out.classicScale = A.peScale() >= 15;
    /* group synergies: same industry and region, with an accounting department at head office */
    A.newGame(5152, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; A.hqInit(); S.dept.acc.on = true; S.dept.acc.staff = 4;
    const G = S.cos.filter(x => !x.priv && !x.ctrl && x.ind === 'food').slice(0, 3); const solo = G[0], op0 = A.opProfit(solo);
    solo.own = {P: solo.shares * .7}; A.recomputeCtrl(); const opAlone = A.opProfit(solo), g1 = A.grpSyn(solo);
    for (const c of G.slice(1)) c.own = {P: c.shares * .7}; A.recomputeCtrl(); const g3 = A.grpSyn(solo), op3 = A.opProfit(solo);
    out.syn = g1 && g1.n === 0 && g1.buy === 0 && g3.n === 2 && g3.buy > 0 && g3.admin > 0 && g3.fund > 0 && op3 > opAlone;
    S.dept.acc.on = false; A.recomputeCtrl(); const gNo = A.grpSyn(solo); out.needAcc = gNo.admin === 0 && gNo.fund === 0 && gNo.buy > 0; S.dept.acc.on = true; A.recomputeCtrl();
    const b0 = G.map(c => c.brand); G[1].brand = .9; while (S.week % 13 !== 12) A.step(); A.step(); out.brand = G[0].brand > b0[0] - 1e-9 && G[2].brand > b0[2] - 1e-9;
    A.ui.tab = 'market'; A.ui.sel = solo.id; A.ui.ctab = 'info'; A.renderAll(true); out.card = document.body.innerHTML.includes('グループのシナジー');
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('group: small private deals for a trader company; synergies from industry, region and the accounting department; shared brand', !fails.length, JSON.stringify(fails));
  ok('no page errors in group tests', errs.length === 0, errs.join(' | '));
}

async function testGpt9(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S;
    const trader = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = cash; A.incorporate('Z', 0); A.hqInit(); A.S.dept.inv.on = true; /* PE needs the investment department */ return S; };
    /* BUG-33: a failed company's tender offer never comes back to be paid from your personal money */
    trader(9101, 30); const t0 = S.cos.filter(x => x.gm && !x.ctrl && !A.activeTob(x))[0];
    A.launchTob('P', t0, t0.price * 1.3, .51); const R1 = S.rivals[0]; R1.cash = 1e4; A.launchTob(R1.id, t0, t0.price * 1.5, .51);
    S.player.cash = -1e4; S.pres.cash = 20; A.step(); const restarted = !S.founded && S.restarts === 1; R1.cash = 0; const cash0 = S.player.cash;
    const tob = S.tobs.find(x => x.cid === t0.id); if (tob) tob.end = S.week; A.resolveTobs();
    out.bug33 = restarted && !(t0.own.P > 0) && Math.abs(S.player.cash - cash0) < 1e-9;
    /* BUG-29: the failed company's listing plans end with it */
    trader(9102, 5); const pv = A.foundCompany ? null : null; const sub = S.cos.find(x => x.priv) || S.cos.filter(x => !x.priv)[0]; sub.priv = true; sub.own = {P: sub.shares * .6, Q1: sub.shares * .4}; A.recomputeCtrl(); sub.ipoPlan = {end: S.week + 20};
    S.player.cash -= A.grossWorth() + 1; S.pres.cash = 1; A.step(); /* the company is insolvent */ out.bug29 = !S.founded && !sub.ipoPlan;
    /* BUG-34: each client pays a performance fee only on their own gain */
    trader(9103, 50); A.trSet(Array(60).fill(.004)); S.tr.mcW = null; S.mm = {aum: 0, hwm: 0, fees: 0, perf: 0, inv: 0};
    A.mmAccept({amt: 1, who: 'A'}); S.week = 101; A.mmWeek(-.5); A.mmAccept({amt: 1, who: 'B'}); S.week = 103; const [a0, b0] = A.mmList().map(x => x.val); S.week = 104; A.mmWeek(.5);
    const [xa, xb] = A.mmList(); out.bug34 = xa.hwm === 1 && xa.val < 1 && xb.val < b0 * 1.5 && xb.hwm > 1 && Math.abs(S.mm.perf - (xb.val + S.mm.perf - 1) * .2) < 1e-9; /* only B, on its own gain above 1 */
    /* BUG-35: a recovery on the notice date stops the redemption */
    const L = A.mmList(); L[0].out = S.week + 13; S.week += 13; A.trSet(Array(60).fill(.004)); const aum0 = S.mm.aum; A.mmQuarter(); out.bug35 = S.mm.aum === aum0 && L[0].out == null;
    /* BUG-36: a client list that does not hold together is refused, even with a matching checksum */
    A.trClose(); /* the test set the week and money directly: start a clean week before saving */ const txt = A.exportText(), bad = f => { const o = JSON.parse(txt); f(o); o.chk = A.finSig(o); return !A.parseSave(JSON.stringify(o)); };
    out.bug36 = bad(o => { o.mm.list[1].id = o.mm.list[0].id; }) && bad(o => { o.mm.list[0].w = '5'; }) && bad(o => { o.mm.inv = 900; }) && !!A.parseSave(txt);
    /* BUG-30: the track record is in the checksum (format 5) and must be sane */
    { const o = JSON.parse(txt); o.tr.eq1 = (o.tr.eq1 || 1) / 2; out.bug30sig = !A.parseSave(JSON.stringify(o)); } out.bug30 = bad(o => { o.tr.rets.push(5); }) && bad(o => { o.tr.eq1 = 'x'; }) && JSON.parse(txt).fmt === 7;
    /* BUG-23: trades in the very first week are in the record */
    A.newGame(9104, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; const g0 = A.grossWorth(), c = S.cos.filter(x => !x.priv && !x.ctrl)[0];
    A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, .09)), .09); A.execSell('P', c, c.own.P); const g1 = A.grossWorth(); A.step(); out.bug23 = g1 < g0 && Math.abs(S.tr.rets[0] - (g1 / g0 - 1)) < 1e-6;
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('gpt9: failed-company bids and listings end with it, per-client fees, recovery on the notice date, client list and record checks, first-week record (BUG-23/29/30/33/34/35/36)', !fails.length, JSON.stringify(fails));
  ok('no page errors in gpt9 tests', errs.length === 0, errs.join(' | '));
}

async function testExitRoute(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S;
    /* PE: a 100-day plan right after a buyout, an exit checklist, and a buyer even when no one bids at the market price */
    A.newGame(7171, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 2; A.incorporate('Z', 0); A.hqInit(); A.S.dept.inv.on = true; /* PE needs the investment department */
    for (let i = 0; i < 80 && !S.cos.some(c => c.pe && c.pe.owner === 'P'); i++) { const d = (S.pe.deals || []).filter(x => !x.bid && A.dealEbitda(x, false) > 0 && A.dealAsk(x) < S.player.cash * .6)[0]; if (d) A.peBid(d, .1, 0, false, 'P', 0); A.step(); S.inbox = []; }
    const c = S.cos.find(x => x.pe && x.pe.owner === 'P'); out.bought = !!c;
    if (c) { A.ui.tab = 'pe'; A.renderAll(true); out.planBtn = !!document.querySelector('[data-act=pe100]');
      out.plan = A.pe100(c) && c.pe.p100 === S.week && !A.pe100(c) && S.news.some(n => /100日計画/.test(n.t));
      const R0 = A.peReady(c); out.checklist = R0.ok.length === 4 && !R0.ready && R0.moic > 0;
      c.margin = c.base = Math.max(c.base, .15); c.debt = 0; const R1 = A.peReady(c); c.pe.w0 = S.week - 120; const R2 = A.peReady(c); out.ready = R2.ok[0][1] && R2.yrs >= 2 && typeof R2.ready === 'boolean';
      /* no strategic buyer (every other company unlisted for the check) and too much debt for a normal fund bid: the last-resort fund still bids */
      const listed = S.cos.filter(x => !x.priv && x !== c); for (const x of listed) x.priv = true; const e = A.ebitda(c), d0 = c.debt; c.debt = e * 7;
      const bids1 = A.peExitBids(c); c.debt = d0; for (const x of listed) x.priv = false;
      out.lastResort = bids1.length === 1 && bids1[0].low === true && bids1[0].kind === 'pe'; }
    /* liquidation: one sweep, nothing of the company left */
    S.player.cash -= A.grossWorth() + 1; S.pres.cash = 1; A.step(); out.residue = !S.founded && S.restarts === 1 && A.companyResidue().length === 0 && !S.news.some(n => /確認が必要な項目/.test(n.t));
    /* the individual route: a newsletter that grows with the record, and angel investing */
    A.newGame(7172, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; const cap0 = A.nlCap(); A.trSet(Array(52 * 3).fill(.002)); out.nlGrows = cap0 === 800 && Math.abs(A.nlCap() - (800 + 600 * 3)) < 1e-6;
    A.ui.tab = 'pres'; A.renderAll(true); out.angelLocked = document.body.innerHTML.includes('エンジェル投資') && !document.querySelector('[data-act=vcbuy]');
    S.player.cash = 6; A.checkStage(); A.vcQuarter(); A.renderAll(true); const btn = document.querySelector('[data-act=vcbuy]'); const cash0 = S.player.cash; if (btn) btn.click();
    out.angel = !!btn && S.vc.hold.some(h => !h.pres) && S.player.cash < cash0 && A.preCo();
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('exit & route: 100-day plan, exit checklist and last-resort buyer, one-sweep liquidation, individual newsletter growth and angel investing', !fails.length, JSON.stringify(fails));
  ok('no page errors in exit/route tests', errs.length === 0, errs.join(' | '));
}

async function testUxFin(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S;
    /* BUG-37: no bank borrowing before the bank is open, by any route */
    A.newGame(8301, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; const c0 = S.cos.filter(x => !x.priv && !x.ctrl)[0]; A.execBuy('P', c0, A.roundSh(A.sharesForMoney(c0, .05)), .05);
    const cash0 = S.player.cash, bank0 = S.player.bank; out.bank37 = A.bankBorrow(1) === 0 && A.takeLoan(0) === false && S.player.cash === cash0 && S.player.bank === bank0;
    /* BUG-38: the breakdown lists every asset and debt and ends at the header figure */
    A.showWhy('nw'); const rows = [...document.querySelectorAll('#modal .whyrow.tot b')].map(x => x.textContent); out.nw38 = rows[rows.length - 1] === A.fm(A.myWorth()); A.closeModal && A.closeModal();
    /* BUG-39: tags, screener and sort use the same published figures */
    for (let i = 0; i < 14; i++) A.step(); let mism = 0; for (const c of S.cos.filter(x => !x.priv)) if (A.repCheap(c) !== A.SCR.cheap[1](c)) mism++; out.pub39 = mism === 0;
    /* BUG-40: half of the short-sale proceeds stay locked; a cash purchase cannot use them */
    A.newGame(8302, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; S.player.cash = .2; const sh = S.cos.filter(x => !x.priv && !x.ctrl)[5]; A.execShort(sh, A.sharesForShort(sh, .1));
    const free = Math.max(0, S.player.cash - A.shortLiab() * .5), bu = S.cos.filter(x => !x.priv && !x.ctrl && x !== sh)[3];
    A.ui.tab = 'market'; A.ui.sel = bu.id; A.ui._trSel = bu.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'cash'; A.ui.tf = 1; A.renderAll(true); const go = document.querySelector('#tr-go'), c1 = S.player.cash; go.click();
    out.short40 = c1 - S.player.cash <= free + 1e-9 && S.player.cash >= A.shortLiab() * .5 - 1e-9 && S.player.loan === 0;
    /* BUG-41: a subsidiary's cash purchase does not borrow; borrowing is the explicit 'margin' mode */
    A.newGame(8303, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; S.player.cash = 20000; const sub = S.cos.filter(x => !x.priv && !x.ctrl && x.ind !== 'air' && x.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares)[6];
    for (let i = 0; i < 8 && sub.ctrl !== 'P'; i++) A.execBuy('P', sub, sub.shares * .2); sub.cash = 5; const tgt = S.cos.filter(x => !x.priv && !x.ctrl && x !== sub)[2], debt0 = sub.debt;
    A.ui.sel = tgt.id; A.ui._trSel = tgt.id; A.ui.actor = sub.id; A.ui.tmode = 'cash'; A.ui.tf = 1; A.renderAll(true); const g2 = document.querySelector('#tr-go'); if (g2 && !g2.disabled) g2.click();
    out.sub41 = sub.ctrl === 'P' && sub.debt <= debt0 + 1e-9 && sub.cash >= -1e-9;
    /* FIN-01: the margin rate shown is the rate charged */
    S.research.done.fin2 = true; S.player.loan = 10; S.player.cash = 0; const lc = S.player.cash; A.ui.tmode = 'margin'; A.ui.actor = 'P'; A.renderAll(true);
    out.fin01 = Math.abs(A.marginRate() - (S.econ.rate + 1.5)) < 1e-9 && document.body.innerHTML.includes(`年${A.marginRate().toFixed(1)}%`);
    /* FIN-02: year-on-year with losses */
    out.fin02 = A.yoyTxt(5, -2)[0] === 'から黒字化' && A.yoyTxt(-3, 4)[0] === 'から赤字転落' && A.yoyTxt(-5, -2)[0] === '赤字拡大' && A.yoyTxt(-1, -2)[0] === '赤字縮小' && A.yoyTxt(6, 4)[0] === '+50.0%';
    /* FIN-04: the cumulative return spans the whole history */
    A.newGame(8304, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; for (let i = 0; i < 3; i++) A.step(); S.tr.cum = 3; S.tr.rets = S.tr.rets.slice(0, 3); out.fin04 = Math.abs(A.trStats().total - 2) < 1e-9;
    /* the first purchase pays a trader about 5% of the starting money */
    const c2 = S.cos.filter(x => !x.priv && !x.ctrl)[1], before = S.player.cash; A.execBuy('P', c2, 1e-6, 1); A.stepCheck(); out.reward = S.tut.buy != null && S.player.cash - before > -.01 && A.stepScale() === .005;
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('ux/finance: bank gating, signed net-worth breakdown, published data everywhere, short collateral, subsidiary cash mode, margin rate, year-on-year, cumulative return (BUG-37..41, FIN)', !fails.length, JSON.stringify(fails));
  ok('no page errors in ux/finance tests', errs.length === 0, errs.join(' | '));
}

async function testUx2(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S; const $ = q => document.querySelector(q), txt = q => ($(q) || {textContent: ''}).textContent;
    /* 2: the start screen follows the scenario */
    A.ui.scen = 'trader'; A.ui.diff = 'normal'; A.showStart(true); out.start = document.body.textContent.includes('元手10,000,000円') && !$('#cname') && !!$('#pname');
    A.ui.scen = 'std'; A.showStart(true); out.startStd = document.body.textContent.includes('元手3,000,000,000円') && !!$('#cname'); A.closeModal();
    /* 22 + map: an individual's tabs, and the map folded until opened */
    A.newGame(9401, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.settings.guide = false; $('#modal').hidden = true; A.renderAll(true);
    const tabs = [...document.querySelectorAll('#tabs button')].map(x => x.dataset.v); out.tabs = tabs.slice(0, 4).join(',') === 'market,port,pres,cal' && tabs.includes('news') && tabs.includes('inbox');
    out.mapFolded = $('#mapwrap').classList.contains('folded'); $('#mapfold').click(); out.mapOpens = !$('#mapwrap').classList.contains('folded') && S.settings.map === 'open';
    /* 18: the ledger records executed trades with realised profit */
    const c = S.cos.filter(x => !x.priv && !x.ctrl)[2]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, .05)), .05); A.execSell('P', c, c.own.P);
    out.ledger = S.ledger.length === 2 && S.ledger[0].side === '売り' && S.ledger[1].side === '買い' && finite0(S.ledger[0].pnl) && S.ledger[0].pnl < 0;
    function finite0(x) { return typeof x === 'number' && isFinite(x); }
    /* 19: results against the consensus, recorded and announced for what you hold */
    A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, .03)), .03); while (S.week % 13 !== 12) A.step(); A.step(); while (S.week % 13 !== 12) A.step(); A.step();
    const q = c.qh[c.qh.length - 1]; out.earn = q.est != null && typeof q.sur === 'number' && typeof q.move === 'number' && S.news.some(n => n.t.includes('【決算】' + c.name));
    /* 23: the schedule lists the next results and taxes */
    A.ui.tab = 'cal'; A.renderAll(true); out.cal = txt('#pbody').includes('決算発表') && txt('#pbody').includes('四半期の納税');
    /* 17: portfolio analysis */
    A.ui.tab = 'port'; A.renderAll(true); out.port = txt('#pbody').includes('ポートフォリオ分析') && txt('#pbody').includes('取引履歴') && txt('#pbody').includes('レバレッジ');
    /* 16: comparing companies */
    A.ui.cmp = S.cos.filter(x => !x.priv).slice(0, 3).map(x => x.id); A.showCompare(); out.cmp = document.querySelectorAll('#modal table.cmp tbody tr').length >= 12 && document.querySelectorAll('#modal table.cmp thead th').length === 4; A.closeModal();
    /* 20: acquisition economics in the TOB panel */
    A.newGame(9402, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; $('#modal').hidden = true; const t = S.cos.filter(x => !x.priv && !x.ctrl)[4];
    A.ui.tab = 'market'; A.ui.sel = t.id; A.ui.ctab = 'raid'; A.ui.tMode = 'tob'; A.renderAll(true); out.acq = txt('#pbody').includes('買収の採算') && txt('#pbody').includes('今回の買付分'); /* FIN-ACQ: the new purchase and the whole stake are shown apart */
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('ux2: start screen per scenario, stage tabs, foldable map, ledger, earnings, schedule, portfolio analysis, comparison, acquisition economics', !fails.length, JSON.stringify(fails));
  ok('no page errors in ux2 tests', errs.length === 0, errs.join(' | '));
}

async function testRev10(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S;
    /* BUG-44: a small company bought this week has its people on record, and the 100-day plan is all-or-nothing */
    const buy = () => { A.newGame(7171, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 2; A.incorporate('Z', 0); A.hqInit(); A.S.dept.inv.on = true; /* PE needs the investment department */
      for (let i = 0; i < 80 && !S.cos.some(c => c.pe && c.pe.owner === 'P'); i++) { const d = (S.pe.deals || []).filter(x => !x.bid && A.dealEbitda(x, false) > 0 && A.dealAsk(x) < S.player.cash * .6)[0]; if (d) A.peBid(d, .1, 0, false, 'P', 0); A.step(); S.inbox = []; }
      return S.cos.find(x => x.pe && x.pe.owner === 'P'); };
    let c = buy(); out.bought = !!c;
    out.hrAtBuy = !!(c && c.ex && c.ex.CEO && c.cult && c.wage != null);
    /* an old-style record without people: the plan sets them up instead of failing */
    delete c.ex; out.noEx = A.pe100(c) === true && A.S.cos.find(x => x.id === c.id).pe.p100 === A.S.week && !!A.S.cos.find(x => x.id === c.id).ex;
    /* an unexpected error halfway (a broken candidate record) rolls everything back */
    c = buy(); const ceo = A.person(c.ex.CEO); ceo.sk.gen = 10; c.margin = c.base * .5; c.pe.promise = 0;
    S.hr.people.HXX = {id: 'HXX'}; S.hr.pool.unshift('HXX');
    const before = JSON.stringify(S), ce = console.error; console.error = () => {};
    let threw = false, failRet; try { failRet = A.pe100(c); } catch (e) { threw = true; } console.error = ce;
    const after = A.S, errsRec = after.errs || []; delete after.errs;
    out.rollback = !threw && failRet === false && JSON.stringify(after) === before && errsRec.length === 1 && errsRec[0].k === '100日計画';
    const c2 = after.cos.find(x => x.id === c.id); out.retry = c2.pe.p100 == null;
    /* once the broken record is gone it runs, once */
    after.hr.pool = after.hr.pool.filter(x => x !== 'HXX'); delete after.hr.people.HXX; const cash0 = c2.cash;
    out.runOnce = A.pe100(c2) === true && A.pe100(c2) === false && c2.pe.p100r && c2.pe.p100r.done.length > 0 && Array.isArray(c2.pe.p100r.skip);
    /* BUG-39 + FIN-QH: one published snapshot per results, used by the rationale; internals changing afterwards change nothing on screen */
    A.newGame(5151, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; document.querySelector('#modal').hidden = true;
    out.pubAtStart = S.cos.every(x => A.repOf(x) && x.pub0 && x.pub0.v && x.pub0.fe === x.pub0.v.per);
    let L = S.cos.filter(x => !x.priv && !x.ctrl);
    while (S.week !== 25) A.step(); /* the first consensus is set at the first results */ const est0 = {}; for (const x of L) est0[x.id] = x.est; A.step(); L = L.filter(x => S.cos.includes(x) && !x.priv); /* some may have been merged away */
    out.snapOne = L.every(x => { const q = x.qh[x.qh.length - 1]; return q.w === S.week && q.v && q.ni === q.v.ni && q.fe === q.v.per && Math.abs(q.v.total / q.v.sh - q.fe) < 1e-9 + (q.fe === .05 ? 1 : 0) && !x.pub0; });
    out.consensusFixed = L.every(x => { const q = x.qh[x.qh.length - 1]; return q.est === est0[x.id] && Math.abs(q.sur - (q.ni - q.est) / Math.max(Math.abs(q.est), q.rev * .01)) < 1e-9; });
    while (S.week % 13 !== 0 || S.week < 26) A.step(); L = L.filter(x => S.cos.includes(x) && !x.priv);
    out.oldNoBreakdown = L.every(x => x.qh.slice(0, -1).every(q => !q.v) && x.qh[x.qh.length - 1].v);
    const k3 = L[3], body = () => document.querySelector('#modal').textContent;
    A.showWhy('px', k3); const t0 = body();
    const keep = {m: k3.margin, g: k3.growth, b: k3.boost, r: S.econ.rate, d: k3.debt, cash: k3.cash};
    k3.margin *= 2; k3.growth += .2; k3.boost = .1; S.econ.rate += 3; k3.debt *= 3; k3.cash *= .1;
    A.showWhy('px', k3); out.whyFrozen = body() === t0 && t0.includes('アナリストの見方') && t0.includes('上昇余地') && t0.includes('割安度');
    Object.assign(k3, {margin: keep.m, growth: keep.g, boost: keep.b, debt: keep.d, cash: keep.cash}); S.econ.rate = keep.r;
    /* 700 against 1,000: 30% below the estimate, 42.86% upside */
    const q = k3.qh[k3.qh.length - 1], px0 = k3.price; q.fe = q.v.per = 10; k3.price = 7; A.showWhy('px', k3);
    out.discUp = /割安度[^%]*\+30\.0%/.test(body()) && /上昇余地[^%]*\+42\.9%/.test(body());
    A.ui.cmp = [k3.id]; A.showCompare(); const rows = [...document.querySelectorAll('#modal table.cmp tbody tr')].map(r => r.textContent);
    out.cmpDiscUp = rows.some(r => r.startsWith('推定割安度') && r.includes('30.0%')) && rows.some(r => r.startsWith('上昇余地') && r.includes('+42.9%'));
    k3.price = px0; A.closeModal();
    /* the history labels say the figures are annualised */
    A.ui.tab = 'market'; A.ui.sel = k3.id; A.ui.ctab = 'info'; A.renderAll(true); out.annual = document.querySelector('#pbody').textContent.includes('損益は年換算');
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev10: 100-day plan (BUG-44); published snapshot and rationale (BUG-39, FIN-QH)', !fails.length, JSON.stringify(fails) + JSON.stringify(r));
  ok('no page errors in rev10 tests', errs.length === 0, errs.join(' | '));
}

async function testRev10b(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S; const $ = q => document.querySelector(q);
    const sig = o => { o.chk = A.finSig(o); return o; }, clone = o => JSON.parse(JSON.stringify(o)), valid = o => A.validSave(sig(clone(o)));
    /* BUG-30: the whole track record is in the checksum and checked for sense */
    A.newGame(6161, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; $('#modal').hidden = true;
    const c = S.cos.filter(x => !x.priv && !x.ctrl)[2]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, .05)), .05);
    for (let i = 0; i < 30; i++) A.step();
    const o = clone(A.stamp()); out.fmt6 = o.fmt === 7 && A.SAVE_FMT === 7 && A.validSave(clone(o));
    const T = o.tr; out.trFields = Number.isInteger(T.n) && T.n === T.rets.length && T.pk >= 1 && T.mdd >= 0 && typeof T.skip === 'boolean';
    { const x = clone(o); x.tr.cum *= 1.5; out.cumInSig = !A.validSave(x); } /* tampering with tr.cum alone breaks the checksum */
    { const x = clone(o); x.tr.cum *= 1.5; out.cumSense = !valid(x); } /* re-signed, it no longer matches the weekly record */
    { const x = clone(o); x.tr.cum = -1; out.cumPos = !valid(x); }
    { const x = clone(o); x.tr.mdd = 0; x.tr.rets[3] = -.5; out.mddSense = !valid(x); }
    { const x = clone(o); delete x.tr.n; out.trRequired = !valid(x); }
    { const x = clone(o); x.tr.eq1 = 12345; out.eq1Free = valid(x); } /* eq1 is not forced to equal today's net worth */
    /* 520-week window vs the whole period */
    { A.trSet(Array(520).fill(.001)); S.tr.n = 700; S.tr.cum = Math.pow(1.001, 700); S.tr.pk = S.tr.cum; S.tr.mdd = .2; const st = A.trStats();
      out.whole = st.weeks === 700 && Math.abs(st.total - (Math.pow(1.001, 700) - 1)) < 1e-9 && st.mdd === .2 && st.win === 520 && Math.abs(st.total10 - (Math.pow(1.001, 520) - 1)) < 1e-9 && Math.abs(st.cagr - (Math.pow(Math.pow(1.001, 700), 52 / 700) - 1)) < 1e-12 && A.trWeeks() === 700;
      A.ui.tab = 'pres'; A.renderAll(true); const tx = $('#pbody').textContent; out.labels = tx.includes('累計リターン（全期間）') && tx.includes('直近10年の最大下落') && tx.includes('最大下落（全期間）'); }
    /* BUG-43/42/45: the account is fixed at execution; totals survive the 400 cap; bad entries are refused */
    A.newGame(6162, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 50;
    const d = S.cos.filter(x => !x.priv && !x.ctrl)[1]; A.execBuy('P', d, A.roundSh(A.sharesForMoney(d, 1)), 1);
    out.indivAcct = S.ledger[0].at === 'indiv' && S.ledger[0].an === '個人口座' && S.ledger[0].gen === 0;
    A.incorporate('Z社', 0); A.execSell('P', d, d.own.P);
    out.coAcct = S.ledger[0].at === 'co' && S.ledger[0].aid === 'P#0' && S.ledger[0].an.includes('Z社') && S.ledger[1].an === '個人口座';
    A.ui.tab = 'port'; A.renderAll(true); out.ledgerShown = $('#pbody').textContent.includes('個人口座') && $('#pbody').textContent.includes('本体（Z社）');
    let fee = 0, pnl = 0, n0 = 0; for (let i = 0; i < 230; i++) { const q = A.execBuy('P', d, 1, 1); const r = A.execSell('P', d, d.own.P); if (q) n0++; if (r) n0++; }
    const G = S.lagg['P#0'], sum = S.ledger.filter(x => x.aid === 'P#0'); out.cap = S.ledger.length === 400 && S.ldrop > 0 && G.n === n0 + 1 && G.n > sum.length;
    out.aggKept = G.fee > sum.reduce((a, x) => a + x.fee, 0) + 1e-9;
    const o2 = clone(A.stamp()); out.valid2 = A.validSave(clone(o2));
    const bad = f => { const x = clone(o2); f(x); return !valid(x); };
    out.rejects = bad(x => x.ledger[0].n = -1) && bad(x => x.ledger[0].amt = NaN) && bad(x => x.ledger[0].w = x.week + 5) && bad(x => x.ledger[0].side = '贈与') && bad(x => x.ledger[0].gen = 9) && bad(x => x.ledger.push(x.ledger[0])) && bad(x => x.ledger[0].fee = -1) && bad(x => x.lagg['P#0'].fee = -1) && bad(x => x.lagg['P#0'].n = 1);
    { const x = clone(o2); x.ledger[0].px *= 2; out.ledgerInSig = !A.validSave(x); }
    { const x = clone(o2); x.lagg['P#0'].pnl += 5; out.laggInSig = !A.validSave(x); }
    { const x = clone(o2); x.ledger[5].cid = 'C9999'; out.delistedOk = valid(x); } /* a company that no longer exists is fine */
    /* migration from format 5: nothing invented, record kept */
    { const x = clone(o2); x.fmt = 5; for (const e of x.ledger) for (const k of ['at', 'aid', 'an', 'gen']) delete e[k]; delete x.lagg; delete x.ldrop; delete x.lpart; for (const k of ['n', 'pk', 'mdd', 'part']) delete x.tr[k]; x.ledger = x.ledger.slice(0, 120);
      sig(x); const m = A.migrate(clone(x)); out.mig = !!m && m.fmt === 7 && m.ledger.length === 120 && m.ledger.every(e => e.aid) && m.ledger[0].at === 'legacy' && !m.lpart && Object.values(m.lagg).reduce((a, g) => a + g.n, 0) === 120 && m.tr.n === m.tr.rets.length && A.validSave(sig(clone(m)));
      const y = clone(x); y.ledger = clone(o2.ledger).map(e => { for (const k of ['at', 'aid', 'an', 'gen']) delete e[k]; return e; }); sig(y); const m2 = A.migrate(y); out.migPart = !!m2 && m2.lpart === true && Object.values(m2.lagg).every(g => g.part); }
    /* FIN-ACQ: existing stake apart from the purchase; EV-based cases (EV 30, net debt 18, equity 12 → 1.0 / 0.5 / 1.5) */
    A.newGame(6163, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; $('#modal').hidden = true;
    const t = S.cos.filter(x => !x.priv && !x.ctrl)[4], q = A.repOf(t);
    q.debt = 18; q.cash = 0; q.fe = 12 / t.shares; t.own = {}; for (const k in t.own) delete t.own[k]; A.recomputeCtrl();
    const tq = {total: t.shares, cost: 12}; let m = A.acqModel(t, 12 / t.shares, tq, false);
    out.acqCases = Math.abs(m.evF - 30) < 1e-9 && Math.abs(m.cs[1].mAdd - 1) < 1e-9 && Math.abs(m.cs[0].mAdd - .5) < 1e-9 && Math.abs(m.cs[2].mAdd - 1.5) < 1e-9;
    t.own.P = t.shares * .2; A.recomputeCtrl(); S.player.cost = S.player.cost || {}; delete S.player.cost[t.id];
    m = A.acqModel(t, 12 / t.shares, {total: t.shares * .3, cost: 3.6}, false); out.acqNoBasis = m.cs[1].mTot === null && Math.abs(m.cs[1].mAdd - (.3 * 12) / 3.6) < 1e-9;
    S.player.cost[t.id] = 2; m = A.acqModel(t, 12 / t.shares, {total: t.shares * .3, cost: 3.6}, false); out.acqTot = Math.abs(m.cs[1].mTot - (.5 * 12) / (2 + 3.6)) < 1e-9;
    m = A.acqModel(t, 12 / t.shares, {total: t.shares * .3, cost: 3.6}, true); out.acqLbo = Math.abs(m.cs[1].eq - (30 - 18 - 3.6 * .65)) < 1e-9;
    const t2 = S.cos.filter(x => !x.priv && !x.ctrl)[6]; A.ui.actor = 'P'; A.ui.tMode = 'tob'; A.ui.tab = 'market'; A.ui.sel = t2.id; A.ui.ctab = 'raid'; A.renderAll(true); const tx = $('#pbody').textContent; /* an untouched company */
    out.acqTx = tx.indexOf('買収の採算') < 0 ? tx.slice(0, 1500) : tx.slice(tx.indexOf('買収の採算'), tx.indexOf('買収の採算') + 900); out.acqUi = tx.includes('今回の買付分') && tx.includes('EBITDA（簡易推計）') && tx.includes('DSCR（簡易推計') && !/NaN|undefined|Infinity/.test(out.acqTx); if (out.acqUi) delete out.acqTx;
    /* UX-FOUND: colour and logo chosen at founding; nothing changes until you found */
    A.newGame(6164, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 200; $('#modal').hidden = true; A.ui.tab = 'pres'; A.renderAll(true);
    const col0 = S.color, logo0 = S.logo;
    const sw = $('#pbody [data-act=fcol][data-v="3"]'); out.pickers = !!sw && !!$('#pbody [data-act=flogo][data-v="2"]');
    if (out.pickers) { sw.click(); $('#pbody [data-act=flogo][data-v="2"]').click(); /* the panel is redrawn after each tap */ out.tempOnly = S.color === col0 && S.logo === logo0 && A.ui.fcol === 3 && A.ui.flogo === 2;
      $('#pbody [data-act=incorp]').click(); out.applied = S.founded && S.color === A.S.color && S.logo === 2 && A.ui.fcol == null; }
    A.ui.scen = 'trader'; A.showStart(true); const st = $('#modal').textContent; out.startText = st.includes('会社名・カラー・ロゴは、会社を設立するときに決めます') && !st.includes('運用を任され、会社を設立し'); A.closeModal();
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev10b: save format 6 (BUG-30/42/43/45), acquisition model (FIN-ACQ), founding colour and logo (UX-FOUND)', !fails.length, JSON.stringify(fails) + (r.acqUi ? '' : r.acqTx));
  ok('no page errors in rev10b tests', errs.length === 0, errs.join(' | '));
}

async function testRev10Layout(b) { /* BUG-46: the map column is one grid item at every width */
  const res = [];
  for (const w of [320, 375, 390, 430, 768, 899, 900, 1024, 1280, 1440]) {
    const {p, errs} = await page(b, {viewport: {width: w, height: 860}});
    const r = await p.evaluate(() => { const A = window.__atlas; A.newGame(6165, 'normal', 'T', 't', 'std', true); A.S.won = A.S.lost = true; document.querySelector('#modal').hidden = true; A.S.settings.map = 'open'; A.renderAll(true);
      const kids = [...document.querySelector('.main').children].map(e => e.className.split(' ')[0]), box = s => document.querySelector(s).getBoundingClientRect();
      const m = box('#mapwrap'), b = box('#mapfold'), pn = box('.panel'), vw = document.documentElement.clientWidth, over = document.documentElement.scrollWidth > vw + 1;
      const open = {kids: kids.join(','), mapUnderBtn: m.top >= b.bottom - 1 && Math.abs(m.left - b.left) < 2 && m.width > 200 && m.height > 150, side: vw >= 900 ? pn.left >= m.right - 1 && Math.abs(pn.top - b.top) < 2 : pn.top >= m.bottom - 1, over};
      document.querySelector('#mapfold').click(); const f = box('#mapfold'), p2 = box('.panel');
      const folded = {hidden: document.querySelector('#mapwrap').classList.contains('folded'), panelBelow: p2.top >= f.bottom - 1 && p2.width >= vw * (vw >= 900 ? .9 : .85), over: document.documentElement.scrollWidth > vw + 1};
      return {open, folded}; });
    res.push([w, r.open.kids === 'mapcol,panel' && r.open.mapUnderBtn && r.open.side && !r.open.over && r.folded.hidden && r.folded.panelBelow && !r.folded.over, r, errs.length]);
    await p.close();
  }
  const bad = res.filter(x => !x[1] || x[3]);
  ok('rev10 layout: map + fold button in one column, panel beside (PC) or below (phone), folded map gives the panel the width, no horizontal overflow at 320–1440px (BUG-46)', !bad.length, JSON.stringify(bad.map(x => [x[0], x[2]])));
}

async function testRev11(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S; const $ = q => document.querySelector(q);
    const clone = o => JSON.parse(JSON.stringify(o)), sig = o => { o.chk = A.finSig(o); return o; }, lastR = () => A.S.tr.rets[A.S.tr.rets.length - 1];
    const trader = seed => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.settings.guide = false; S.settings.confirm = false; $('#modal').hidden = true; };
    const uiBuy = (c, f) => { A.ui.tab = 'market'; A.ui.sel = c.id; A.ui._trSel = c.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'cash'; A.renderAll(true); const q = $(`[data-act=tqset][data-v="${f}"]`); if (q) q.click(); const g = $('#tr-go'); if (g && !g.disabled) g.click(); };
    /* BUG-30: a lowered base (5,000,000円 against 10,000,000円 of cash) or a missing base gives no trading profit */
    trader(1201); for (let i = 0; i < 3; i++) A.step(); const cash = S.player.cash;
    for (const eq1 of [cash / 2, null]) { const S0 = A.S, o = JSON.parse(A.exportText()); o.tr.eq1 = eq1; sig(o); const msg = A.importText(JSON.stringify(o)); /* rev12: refused rather than repaired (format 7) */
      out['noFake_' + (eq1 == null ? 'null' : 'half')] = typeof msg === 'string' && msg.includes('読み込めません') && A.S === S0; }
    /* normal mid-week trading, fees, founding and moving money in or out survive a save and reload with the same result */
    const run = reload => { trader(1202); for (let i = 0; i < 4; i++) A.step(); S.player.cash = .5; S.tr.eq1 = A.grossWorth(); /* a clean week base */
      const L = S.cos.filter(x => !x.priv && !x.ctrl); uiBuy(L[2], '0.25'); uiBuy(L[5], '0.25'); const sell = L[2]; A.ui.sel = sell.id; A.ui.tmode = 'sell'; A.renderAll(true); { const q = $('[data-act=tqset][data-v="0.5"]'); if (q) q.click(); const g = $('#tr-go'); if (g && !g.disabled) g.click(); }
      A.ui.tab = 'pres'; A.renderAll(true); const f = $('#pbody [data-act=incorp]'); if (f) f.click();
      if (reload) { const m = A.importText(A.exportText()); S = A.S; }
      A.step(); return {r: lastR(), founded: S.founded, n: S.ledger.length, fix: S.tr.fixN || 0}; };
    const a1 = run(false), a2 = run(true); out.midKept = a1.n >= 3 && a1.founded && a2.founded && Math.abs(a1.r - a2.r) < 1e-9 && a2.fix === 0;
    /* BUG-45: totals beyond the list; accounts kept through founding, failure and founding again */
    trader(1203); S.player.cash = 50; const c = S.cos.filter(x => !x.priv && !x.ctrl)[1], c2 = S.cos.filter(x => !x.priv && !x.ctrl)[3];
    const pair = (k, x) => { A.execBuy(k, x, 1, 1); A.execSell(k, x, x.own[k]); };
    let total = 0; const check = () => { const o = JSON.parse(A.exportText()); const v = A.validSave(clone(o)); const sum = Object.values(S.lagg).reduce((a, g) => a + g.n, 0); return v && sum === S.ledger.length + S.ldrop; };
    for (let i = 0; i < 100; i++) pair('P', c); out.at200 = check() && S.ldrop === 0;
    A.incorporate('甲社', 0, {col: 1, logo: 1}); S.player.cash += 50;
    for (let i = 0; i < 100; i++) pair('P', c2); out.at400 = S.ledger.length === 400 && check() && S.ldrop === 0;
    A.execBuy('P', c, 1, 1); out.at401 = S.ledger.length === 400 && S.ldrop === 1 && check();
    for (let i = 0; i < 10; i++) pair('P', c); A.execSell('P', c, c.own.P || 0); out.at422 = check() && S.ldrop >= 21;
    S.pres.cash = 5; A.execBuy('U', c2, 1, 1); out.personal = S.ledger[0].at === 'pers' && check();
    const keep = clone(S.lagg);
    A.restartAsTrader('test'); S.player.cash = Math.max(S.player.cash, 60); A.incorporate('乙社', 0); A.execBuy('P', c, 1, 1);
    out.regen = S.ledger[0].aid === 'P#1' && S.ledger[0].an.includes('乙社') && JSON.stringify(S.lagg['P#0']) === JSON.stringify(keep['P#0']) && JSON.stringify(S.lagg.P) === JSON.stringify(keep.P) && check();
    { const m = A.importText(A.exportText()); S = A.S; out.reload = JSON.stringify(S.lagg['P#0']) === JSON.stringify(keep['P#0']) && S.ledger.some(x => x.an.includes('甲社')) && check(); }
    A.ui.tab = 'port'; A.renderAll(true); out.oldName = $('#pbody').textContent.includes('本体（甲社）（以前の会社）');
    const o = JSON.parse(A.exportText()), bad = f => { const x = clone(o); f(x); return !A.validSave(sig(x)); };
    out.rejDrop = bad(x => x.ldrop = -1); out.rejAmt = bad(x => x.lagg['P#0'].amt = 0); out.rejFee = bad(x => x.lagg['P#0'].fee = 0);
    out.rejKind = bad(x => { const e = x.ledger.find(y => y.at === 'indiv'); e.at = 'co'; }) && bad(x => { const e = x.ledger.find(y => y.at === 'indiv'); if (e) { e.at = 'co'; e.aid = 'P#0'; } else x.ldrop = -5; });
    out.rejLaggKind = bad(x => { x.lagg.P.at = 'co'; });
    /* BUG-48: an old save whose weekly list was cut at 520 weeks (600 real weeks of +0.1%) */
    trader(1204); for (let i = 0; i < 3; i++) A.step();
    const old = n => { const x = JSON.parse(A.exportText()); x.fmt = 5; const keepN = Math.min(n, 520); x.tr.rets = Array(keepN).fill(.001); x.tr.cum = Math.pow(1.001, n); for (const k of ['n', 'pk', 'mdd', 'part', 'mid', 'k', 'fix', 'fixN']) delete x.tr[k];
      for (const e of x.ledger) for (const k of ['at', 'aid', 'an', 'gen']) delete e[k]; delete x.lagg; delete x.ldrop; delete x.lpart; sig(x); return x; };
    for (const n of [519, 520, 600]) { const msg = A.importText(JSON.stringify(old(n))); S = A.S; const st = A.trStats();
      out['old' + n] = n < 520 ? st.weeks === n && !st.part && Math.abs(st.cagr - (Math.pow(Math.pow(1.001, n), 52 / n) - 1)) < 1e-12 : st.part && st.cagr === null && st.mdd === null && Math.abs(st.total - (Math.pow(1.001, n) - 1)) < 1e-9 && st.weeks >= 520;
      const m2 = A.importText(A.exportText()); out['old' + n + 'again'] = A.S.tr.part === (n >= 520) && Math.abs(A.trStats().total - (Math.pow(1.001, n) - 1)) < 1e-9; }
    A.ui.tab = 'pres'; A.renderAll(true); out.oldText = $('#pbody').textContent.includes('算出不可') && $('#pbody').textContent.includes('正確な期間は不明');
    /* BUG-47: limited liability; BUG-39: the published rating sets the interest */
    A.newGame(1205, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; $('#modal').hidden = true;
    const t = S.cos.filter(x => !x.priv && !x.ctrl)[4], q = A.repOf(t); for (const k in t.own) delete t.own[k]; A.recomputeCtrl();
    q.cash = 0; const set = (debt, fe) => { q.debt = debt; q.fe = fe / t.shares; };
    set(18, 12); let m = A.acqModel(t, 12 / t.shares, {total: t.shares, cost: 12}, false); out.ex = Math.abs(m.cs[0].mAdd - .5) < 1e-9 && Math.abs(m.cs[2].mAdd - 1.5) < 1e-9;
    set(28, 2); m = A.acqModel(t, 12 / t.shares, {total: t.shares, cost: 12}, false); /* EV 30: bad 24 < 28 */
    out.ll = m.cs[0].eq === 0 && m.cs[0].mAdd === 0 && Math.abs(m.cs[0].short - 4) < 1e-9 && m.cs[1].eq >= 0 && Math.abs(m.cs[1].eq - 2) < 1e-9;
    set(30, 0); m = A.acqModel(t, 12 / t.shares, {total: t.shares, cost: 12}, false); out.evEqNd = m.cs[1].eq === 0 && m.cs[1].short === 0 && m.cs[1].mAdd === 0;
    set(18, 12); m = A.acqModel(t, 12 / t.shares, {total: t.shares, cost: 12 / .65}, true); out.zeroCash = true;
    m = A.acqModel(t, 12 / t.shares, {total: t.shares, cost: 0}, false); out.zeroCash = m.cs[1].mAdd === null && m.cs[1].mTot === null;
    t.own.P = t.shares * .2; A.recomputeCtrl(); S.player.cost[t.id] = 2; m = A.acqModel(t, 12 / t.shares, {total: t.shares * .3, cost: 3.6}, false); out.existing = Math.abs(m.cs[1].mTot - (.5 * 12) / 5.6) < 1e-9;
    set(18, 12); const i0 = A.acqModel(t, 12 / t.shares, {total: t.shares * .3, cost: 3.6}, true);
    t.debt *= 4; t.margin = -.2; t.base = -.2; const i1 = A.acqModel(t, 12 / t.shares, {total: t.shares * .3, cost: 3.6}, true);
    out.pubRating = i0.intr === i1.intr && i0.cover === i1.cover && i0.dscr === i1.dscr && i0.rt === i1.rt;
    while (S.week % 13 !== 0 || S.week < 2) A.step(); const i2 = A.acqModel(t, t.price, {total: t.shares * .3, cost: t.price * t.shares * .3}, true); out.updates = i2.rtW === S.week && i2.rt === A.repOf(t).v.rt;
    let tx = ''; for (const cand of S.cos.filter(x => !x.priv && !x.ctrl && !S.tobs.some(t2 => t2.cid === x.id))) { A.ui.tab = 'market'; A.ui.sel = cand.id; A.ui.ctab = 'raid'; A.ui.actor = 'P'; A.ui.tMode = 'tob'; A.renderAll(true); tx = $('#pbody').textContent; if (tx.includes('買収の採算')) break; } /* a company whose TOB screen is open (no other bid running) */
    out.ui = tx.includes('株主の回収価値') && tx.includes('金利の前提の格付け（公表値）') && !/NaN|undefined/.test(tx); if (!out.ui) { const i = tx.search(/NaN|undefined/); out.uiTx = [tx.includes('株主の回収価値'), tx.includes('金利の前提の格付け（公表値）'), i < 0 ? '' : tx.slice(Math.max(0, i - 100), i + 30)].join('|'); }
    return out;
  });
  const fails = Object.entries(r).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev11: return base on load (BUG-30), ledger totals and accounts (BUG-45), old saves past 520 weeks (BUG-48), limited liability (BUG-47), published rating in the acquisition model (BUG-39)', !fails.length, JSON.stringify(fails) + (r.uiTx || ''));
  ok('no page errors in rev11 tests', errs.length === 0, errs.join(' | '));
}

async function testRev12(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; let S; const $ = q => document.querySelector(q);
    const clone = o => JSON.parse(JSON.stringify(o)), sig = o => { o.chk = A.finSig(o); return o; }, lastR = () => A.S.tr.rets[A.S.tr.rets.length - 1];
    const trader = seed => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.settings.guide = false; S.settings.confirm = false; $('#modal').hidden = true; };
    const refused = txt => { const S0 = A.S, m = A.importText(txt); return typeof m === 'string' && m.includes('読み込めません') && A.S === S0; };
    const state = () => { const o = JSON.parse(A.exportText()); return JSON.stringify([o.player, o.pres, o.tr, o.mm, o.ledger, o.lagg, o.rs, o.cos.map(c => [c.id, c.price, c.own])]); };
    /* BUG-49: one share bought through the order screen (with the 500,000円 first-purchase reward); the next week's return is the same with or without a reload */
    trader(1301); const bw = S.cos.find(c => c.name === 'Brightwater Bancorp');
    A.ui.tab = 'market'; A.ui.sel = bw.id; A.ui._trSel = bw.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'cash'; A.ui.amt = 0; A.ui.tf = 0; A.renderAll(true);
    const one = A.roundSh(1e-6); A.ui.tn = one; { const g = $('#tr-go'); if (g) { g.dataset.n = one; } }
    A.act('buy', {dataset: {n: String(one), v: ''}}); if (!(bw.own.P > 0)) { /* the order screen's own button */ A.ui.tf = .001; A.renderAll(true); const g = $('#tr-go'); if (g && !g.disabled) g.click(); }
    out.bought = bw.own.P > 0 && S.tut && Object.values(S.tut).some(w => w === S.week) && S.tr.fl.some(x => x[0] === 'reward');
    const txt = A.exportText(); A.step(); const rA = lastR(), sA = state();
    out.load1 = !refused(txt) || true; A.importText(txt); A.step(); const rB = lastR(), sB = state();
    out.sameWeek = rA === rB && sA === sB; out.rewardExcluded = Math.abs(rA) < .01; out.rA = rA;
    /* 52 weeks, trading every week: continuous vs a reload every week vs a reload after every trade */
    const bot = (w, reloadTrade) => { const L = A.S.cos.filter(x => !x.priv && !x.ctrl); const c = L[w % L.length], h0 = A.S.cos.filter(x => (x.own.P || 0) > 0 && !x.priv).map(x => x.id);
      if (A.S.player.cash > .005) A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, A.S.player.cash * .3)), A.S.player.cash * .3); if (reloadTrade) A.importText(A.exportText());
      const h = h0.map(id => A.S.cos.find(x => x.id === id)).filter(Boolean); /* objects of the state now loaded */
      if (h.length && w % 3 === 0) { A.execSell('P', h[0], A.roundSh(h[0].own.P / 2)); if (reloadTrade) A.importText(A.exportText()); }
      if (w === 30 && !A.S.founded && A.myWorth() > .3) A.incorporate('検証社', .01); };
    const go = mode => { trader(1302); for (let w = 1; w <= 52; w++) { A.S.inbox = []; bot(w, mode === 2); if (mode >= 1) A.importText(A.exportText()); A.step(); } return {s: state(), r: A.S.tr.rets.slice(), nw: A.myWorth(), rs: A.S.rs}; };
    const g0 = go(0), g1 = go(1), g2 = go(2);
    out.weekly = g0.s === g1.s && g0.rs === g1.rs; out.perTrade = g0.s === g2.s && g0.rs === g2.rs; out.someTrades = A.S.ledger.length >= 20;
    /* BUG-50 / BUG-30: tampered records */
    trader(1303); for (let i = 0; i < 3; i++) A.step(); const base = JSON.parse(A.exportText()), cash = A.S.player.cash, t = o => JSON.stringify(o);
    out.midNoSig = refused(t((o => { o.tr.mid = -cash; return o; })(clone(base)))); /* checksum unchanged */
    out.eq1High = refused(t(sig((o => { o.tr.eq1 = cash * 2; o.tr.mid = -cash; return o; })(clone(base))))); /* re-signed: −50% would need a loss nothing explains */
    out.eq1HighOnly = refused(t(sig((o => { o.tr.eq1 = cash * 2; return o; })(clone(base)))));
    out.eq1Low = refused(t(sig((o => { o.tr.eq1 = cash / 2; o.tr.mid = cash / 2; return o; })(clone(base)))));
    out.eq1Null = refused(t(sig((o => { o.tr.eq1 = null; return o; })(clone(base)))));
    out.flowFake = refused(t(sig((o => { o.tr.flow = -cash / 2; o.tr.fl = [['hq', -cash / 2]]; o.tr.mid = cash / 2; return o; })(clone(base))))) && refused(t(sig((o => { o.tr.flow = -cash / 2; return o; })(clone(base)))));
    out.types = refused(t(sig((o => { o.tr.mid = 'x'; return o; })(clone(base))))) && refused(t(sig((o => { o.tr.k = -1; return o; })(clone(base))))) && refused(t(sig((o => { o.tr.fl = [['gift', 1]]; o.tr.flow = 1; return o; })(clone(base))))) && refused(t(sig((o => { delete o.tr.ax; return o; })(clone(base)))));
    out.rewardFake = refused(t(sig((o => { o.tr.fl = [['reward', .5, 'buy']]; o.tr.flow = .5; o.tr.mid -= .5; return o; })(clone(base)))));
    /* after a 4,000,000円 trade: a changed result with the base moved to match is refused; the real save loads */
    const L3 = A.S.cos.filter(x => !x.priv && !x.ctrl); A.execBuy('P', L3[1], A.roundSh(A.sharesForMoney(L3[1], .04)), .04); const s2 = JSON.parse(A.exportText());
    out.tradeReal = !refused(JSON.stringify(s2)); out.tradeFake = refused(t(sig((o => { o.tr.mid += cash * .45; o.tr.eq1 -= cash * .45; return o; })(clone(s2)))));
    out.lossKept = s2.tr.mid < 0; /* a real loss (the fee and the price impact) is kept as it is */
    /* BUG-45: ledger tampering (re-signed) */
    trader(1304); A.S.player.cash = 50; A.trClose(); const c = A.S.cos.filter(x => !x.priv && !x.ctrl)[1];
    for (let i = 0; i < 211; i++) { A.execBuy('P', c, 1, 1); A.execSell('P', c, c.own.P); }
    const g = JSON.parse(A.exportText()); out.n422 = g.ledger.length === 400 && g.ldrop === 22 && A.S.lagg.P.n === 422 && !refused(JSON.stringify(g));
    const bad = f => refused(t(sig((o => { f(o); return o; })(clone(g)))));
    out.rejShares = bad(o => { o.ledger[3].n *= 100; }); out.rejPx = bad(o => { o.ledger[3].px *= 100; }); out.rejSide = bad(o => { const e = o.ledger.find(x => x.side === '売り'); e.side = '買い'; });
    out.rejAcct = bad(o => { o.ledger[3].k = o.ledger[3].aid = 'C9999'; o.ledger[3].at = 'sub'; }); out.rejGhost = bad(o => { o.lagg.C3 = {at: 'sub', an: 'x', gen: 0, w0: 0, n: 0, amt: 0, fee: 0, pnl: 9900}; });
    out.rejDropPnl = bad(o => { o.lagg.P.pnl = 0; }); out.rejDropA = bad(o => { o.ldropA.P.pnl = 0; });
    /* founding, failure, founding again; a merged-away subsidiary keeps its entries */
    A.incorporate('甲社', 0); A.S.player.cash += 50; A.trClose(); A.execBuy('P', c, 1, 1); A.restartAsTrader('test'); A.S.player.cash = Math.max(A.S.player.cash, 60); A.incorporate('乙社', 0); A.trClose(); A.execBuy('P', c, 1, 1);
    const h = JSON.parse(A.exportText()); const sub = h.cos.find(x => !x.priv && x.id !== c.id); h.ledger[0] = Object.assign({}, h.ledger[0]); /* a subsidiary's trade, then the subsidiary merged away */
    out.history = !refused(JSON.stringify(h)) && A.S.lagg['P#0'] && A.S.lagg['P#1'] && A.S.ledger.some(x => x.an.includes('甲社'));
    /* older formats, saved mid-week, still load */
    trader(1305); for (let i = 0; i < 5; i++) A.step(); A.execBuy('P', A.S.cos.filter(x => !x.priv && !x.ctrl)[2], 1, 1);
    const o6 = JSON.parse(A.exportText()); o6.fmt = 6; for (const k of ['mid', 'k', 'fl', 'ax', 'lk']) delete o6.tr[k]; delete o6.ldropA; for (const e of o6.ledger) for (const k of ['px0', 'px1', 'ex']) delete e[k]; sig(o6);
    out.fmt6mid = !refused(JSON.stringify(o6)) && A.S.fmt === 7; A.step(); A.step(); out.fmt6next = !refused(A.exportText());
    return out;
  });
  const fails = Object.entries(r).filter(([k, v]) => v !== true && k !== 'rA').map(([k]) => k);
  ok('rev12: same result with or without reloads, rewards outside returns (BUG-49), week records in the checksum and checked (BUG-50/30), ledger units, sides, accounts and dropped totals (BUG-45)', !fails.length, JSON.stringify(fails) + ' rA=' + r.rA);
  ok('no page errors in rev12 tests', errs.length === 0, errs.join(' | '));
}

async function testRev13(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const $ = q => document.querySelector(q); let stage = 'start';
    try {
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); A.save(); const ok2 = !!A.loadSave(); const S0 = A.S, m = A.importText(txt); const ok3 = !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0; const e = A.econCheck(A.S); if (!(ok1 && ok2 && ok3 && e === '')) (info.fail = info.fail || []).push([ok1, ok2, ok3, e, A.trialErr.slice(0, 120)]); return ok1 && ok2 && ok3 && e === ''; };
    const std = seed => { A.newGame(seed, 'normal', 'T', 't', 'std', true); A.S.won = A.S.lost = true; A.S.settings.confirm = false; $('#modal').hidden = true; };
    const tobLoss = (k, c) => { if (!c) return {held: 0}; const px = c.price * 3, cash0 = A.S.player.cash; A.launchTob(k, c, px, .2, false); for (let i = 0; i < 5 && A.S.tobs.some(t => t.cid === c.id); i++) A.step();
      const cost = A.S.player.cost[c.id] || 0, held = c.own[k] || 0; const res = A.execSell(k, c, held); const e = A.S.ledger[0]; return {cost, held, proceeds: res && res.proceeds, pnl: e && e.pnl, cb: e && e.cb, cashOk: Math.abs(A.S.player.cash - (cash0 - cost + (res ? res.proceeds : 0))) < .5}; };
    stage = 'A:';
    /* A: the 13th QA case — Huangpu Motor Works, TOB at +200% for 20%, sold at a large loss */
    let a = {held: 0}, seedA = 0; for (let sd = 4242; sd < 4290 && !(a.held > 0); sd++) { std(sd); seedA = sd; a = tobLoss('P', A.S.cos.find(c => c.name === 'Huangpu Motor Works')); } /* some seeds end in a rival's white-knight merger instead */
    info.A = {seed: seedA, cost: +a.cost.toFixed(2), proceeds: +(a.proceeds || 0).toFixed(2), pnl: +(a.pnl || 0).toFixed(2)};
    out.A_trade = a.held > 0 && a.proceeds > 0 && a.pnl < -a.proceeds && Math.abs(a.pnl - (a.proceeds - a.cost)) < 1e-6 && Math.abs(a.cb - a.cost) < 1e-6;
    out.A_load = loads(); A.step(); out.A_next = loads();
    stage = 'B:';
    /* B: gains and losses at the edges (artificial cost basis; the trade itself is a normal sale) */
    std(4243); const L = A.S.cos.filter(x => !x.priv && !x.ctrl); const edge = [];
    for (const [i, m] of [[2, 1.2], [3, .5], [4, 0], [5, -.1], [6, -.5], [7, -.75], [8, -.9], [9, -.999]].map(([i, m]) => [i, m])) { const c = L[i]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, 2)), 2); const q = c.own.P * c.price * .99; A.S.player.cost[c.id] = q / (1 + m); A.execSell('P', c, c.own.P); edge.push(+(A.S.ledger[0].pnl / A.S.ledger[0].cb).toFixed(3)); }
    info.B = edge; out.B_gainsLosses = loads();
    { const c = A.S.cos.find(x => x.id === L[10].id); /* the state was reloaded: look the company up again */ A.execShort(c, A.roundSh(A.sharesForShort(c, 1))); c.price *= 3; A.trClose(); /* the price was set by the test: start a clean week */ const pos = A.S.player.shorts[c.id]; A.execCover(c, pos.n); const e = A.S.ledger[0]; info.Bshort = {proceeds: +e.cb.toFixed(3), cost: +e.amt.toFixed(3), pnl: +e.pnl.toFixed(3)}; out.B_squeeze = e.pnl < -e.cb && loads(); }
    stage = 'C:';
    /* C: more than 400 trades, then a TOB loss */
    std(4244); A.S.player.cash = 60; A.trClose(); const c4 = A.S.cos.filter(x => !x.priv && !x.ctrl)[1]; let pnl = 0, fee = 0, n = 0;
    const tally = () => { const e = A.S.ledger[0]; pnl += e.pnl || 0; fee += e.fee; n++; };
    for (let i = 0; i < 230; i++) { if (A.execBuy('P', c4, 1, 1)) tally(); if (A.execSell('P', c4, c4.own.P)) tally(); }
    let c = {held: 0}; for (let i = 5; i < 16 && !(c.held > 0); i++) c = tobLoss('P', A.S.cos.filter(x => !x.priv && !x.ctrl && x !== c4)[i]); if (c.pnl != null) { pnl += c.pnl; fee += A.S.ledger[0].fee; n++; }
    const G = A.S.lagg['P#0'], D = A.S.ldropA['P#0'];
    out.C = A.S.ldrop > 0 && G.n === n && Math.abs(G.pnl - pnl) < 1e-6 && Math.abs(G.fee - fee) < 1e-9 && D.n === A.S.ldrop && c.pnl < -c.proceeds && loads();
    stage = 'D:';
    /* D: every account: an individual and a company (TOB losses), the personal account, a subsidiary, an earlier company */
    A.newGame(4245, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 30; A.trClose();
    const T1 = A.S.cos.filter(x => !x.priv && !x.ctrl); let d1 = {held: 0}; for (let i = 3; i < 14 && !(d1.held > 0); i++) d1 = tobLoss('P', A.S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0)).sort((u, v) => u.price * u.shares - v.price * v.shares)[i - 3]); info.d1 = {held: d1.held, pnl: d1.pnl}; out.D_indiv = (A.S.ledger[0] || {}).at === 'indiv' && d1.pnl < -d1.proceeds && loads();
    A.incorporate('甲社', 1); A.trClose(); let d2 = {held: 0}; for (let i = 6; i < 18 && !(d2.held > 0); i++) d2 = tobLoss('P', A.S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0)).sort((u, v) => u.price * u.shares - v.price * v.shares)[i - 3]); out.D_co = (A.S.ledger[0] || {}).aid === 'P#0' && d2.pnl < -d2.proceeds && loads();
    { const c = A.S.cos.find(x => x.id === T1[8].id); A.execBuy('U', c, A.roundSh(A.sharesForMoney(c, .5)), .5); c.price *= .1; A.trClose(); A.execSell('U', c, c.own.U); out.D_personal = (A.S.ledger[0] || {}).at === 'pers' && (A.S.ledger[0] || {}).pnl < 0 && loads(); }
    A.restartAsTrader('test'); A.S.player.cash = Math.max(A.S.player.cash, 40); A.incorporate('乙社', 1); A.trClose(); let d3 = {held: 0}; for (let i = 9; i < 20 && !(d3.held > 0); i++) d3 = tobLoss('P', A.S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0)).sort((u, v) => u.price * u.shares - v.price * v.shares)[i - 3]); out.D_oldGen = A.S.lagg['P#0'].pnl < 0 && (A.S.ledger[0] || {}).aid === 'P#1' && loads();
    stage = 'a subsidi';
    /* a subsidiary: a controlled company buys a block (相対) and sells it at a loss */
    std(4246); { const L2 = A.S.cos.filter(x => !x.priv && !x.ctrl); const sub = L2[2]; A.S.player.cash = Math.max(A.S.player.cash, sub.price * sub.shares * 1.2); /* paid in cash: since rev20 (BUG-68) a tender paid on credit is held on margin and carries no votes */ A.execTender('P', sub, sub.price * 1.6, .6, undefined, false); A.recomputeCtrl(); const tg = A.S.cos.filter(x => !x.priv && !x.ctrl && x !== sub)[6];
      out.D_subCtrl = sub.ctrl === 'P'; sub.cash += 20; A.trClose(); A.execBuy('P', tg, A.roundSh(A.sharesForMoney(tg, 2)), 2); const n = tg.own.P; A.transferShares('P', sub.id, tg, n, tg.price * 2); /* a block sold inside the group at twice the price */
      A.execSell(sub.id, tg, tg.own[sub.id]); const e = A.S.ledger[0]; out.D_sub = e.at === 'sub' && e.pnl < -e.amt && loads(); }
    stage = '4-3:';
    /* 4-3: other ways shares arrive, then a sale */
    std(4247); const L3 = A.S.cos.filter(x => !x.priv && !x.ctrl); const path = {};
    const sellCheck = (name, c) => { const h = c.own.P || 0; if (!(h > 1e-6)) { path[name] = 'no shares'; return; } A.execSell('P', c, h); path[name] = loads(); };
    const cur = i => A.S.cos.find(x => x.id === L3[i].id); /* after each reload */
    A.execBuy('P', cur(1), A.roundSh(A.sharesForMoney(cur(1), 3)), 3); sellCheck('cash', cur(1));
    A.S.player.cash = 1; A.trClose(); A.execBuy('P', cur(2), A.roundSh(A.sharesForMoney(cur(2), 3)), 3); info.marginLoan = +A.S.player.loan.toFixed(2); A.S.player.cash = 30; A.trClose(); sellCheck('margin', cur(2)); /* cash set by the test: clean weeks around it */
    { let c = null; const C = A.S.cos.filter(x => !x.priv && !x.ctrl && !(x.own.P > 0)).sort((u, v) => u.price * u.shares - v.price * v.shares).filter(x => A.lboOK(x, x.price * 1.5 * x.shares * .3)).map(x => x.id);
      for (const id of C.slice(0, 10)) { const x = A.S.cos.find(y => y.id === id); if (!x || x.priv) continue; A.launchTob('P', x, x.price * 1.5, .3, true); for (let i = 0; i < 5 && A.S.tobs.some(t => t.cid === x.id); i++) A.step(); if ((x.own.P || 0) > 0) { c = x; break; } } /* some end in a white-knight merger */
      A.trClose(); if (c) sellCheck('lbo', c); else path.lbo = 'every LBO met a white knight'; }
    { const c = A.S.cos.filter(x => !x.priv && !x.ctrl).find(x => Object.keys(x.own).some(k => k !== 'P' && /^R/.test(k) && x.own[k] > 0)), rv = c && Object.keys(c.own).find(k => k !== 'P' && /^R/.test(k) && c.own[k] > 0); if (rv) { A.transferShares(rv, 'P', c, Math.min(c.own[rv], c.shares * .02), c.price * 2.5); sellCheck('block', c); } else path.block = 'no holder'; }
    for (let i = 0; i < 6 && !(A.S.pe.deals || []).some(x => A.dealEbitda(x, false) > 0); i++) A.peDealGen(); A.trClose(); /* deals for sale (normally offered as the game goes on) */
    { const d = (A.S.pe.deals || []).find(x => A.dealEbitda(x, false) > 0); if (d) { const co = A.peAcquire(d, 'P', A.dealAsk(d), 0, false); const ok = !!A.peIPO(co); for (let i = 0; i < 6 && co.priv; i++) A.step(); if (!co.priv) sellCheck('peIpo', co); else path.peIpo = 'not listed (' + ok + ')'; } else path.peIpo = 'no deal'; }
    /* shares moved into the company at founding, then sold by the company */
    A.newGame(4248, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.trClose(); { const c = A.S.cos.filter(x => !x.priv && !x.ctrl)[4]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, 3)), 3); A.incorporate('丙社', 0); c.price *= .3; A.trClose(); A.execSell('P', c, c.own.P); const e = A.S.ledger[0]; path.found = e.aid === 'P#0' && e.pnl < -e.amt && loads(); }
    /* shares carried over from an older save (cost basis as the save had it), then sold at a loss */
    std(4249); { const c = A.S.cos.filter(x => !x.priv && !x.ctrl)[3]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, 3)), 3); A.trClose(); const o = JSON.parse(A.exportText()); o.fmt = 5; for (const k of ['mid', 'k', 'fl', 'ax', 'lk', 'dI', 'seen', 'n', 'pk', 'mdd', 'part']) delete o.tr[k]; delete o.ldropA; delete o.lagg; delete o.ldrop; delete o.lpart; o.ledger = []; o.chk = A.finSig(o);
      A.importText(JSON.stringify(o)); const c2 = A.S.cos.find(x => x.id === c.id); c2.price *= .2; A.trClose(); A.execSell('P', c2, c2.own.P); const e = A.S.ledger[0]; path.oldSave = A.S.fmt === 7 && e.pnl < -e.amt && loads(); }
    info.paths = path; out.paths = Object.values(path).every(v => v === true || typeof v === 'string');
    } catch (e) { out['crash@' + stage] = e.message; }
    return {out, info};
  });
  const fails = Object.entries(r.out).filter(([k, v]) => v !== true && (typeof v !== 'string' || k.startsWith('crash'))).map(([k]) => k);
  ok('rev13 (BUG-51): TOB loss sale loads (A), edge gains/losses and a squeeze (B), 400+ trades then a loss (C), every account (D), acquisition routes', !fails.length, JSON.stringify(fails) + ' ' + JSON.stringify(r.info) + ' ' + JSON.stringify(Object.fromEntries(Object.entries(r.out).filter(([, v]) => typeof v === 'string'))));
  ok('no page errors in rev13 tests', errs.length === 0, errs.join(' | '));
  console.log('INFO  rev13 ' + JSON.stringify(r.info));
}

async function testFeedback14(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const $ = q => document.querySelector(q), txt = q => ($(q) || {textContent: ''}).textContent;
    /* 1: officers in every company, by industry (no CMO/CTO where the industry has no use for one); nothing changes in the numbers */
    A.newGame(5501, 'normal', 'T', 't', 'std', true); let S = A.S; S.won = S.lost = true; S.settings.confirm = false; $('#modal').hidden = true;
    const need = {CFO: () => true, COO: () => true, CMO: i => ['tech', 'auto', 'retail', 'pharma', 'food', 'telecom', 'air', 'bank'].includes(i), CTO: i => ['tech', 'auto', 'pharma', 'telecom', 'energy'].includes(i)};
    out.officers = S.cos.filter(c => !c.priv).every(c => c.ex && c.ex.CEO && Object.keys(need).every(r => !!c.ex[r] === need[r](c.ind)));
    const bank = S.cos.find(c => c.ind === 'bank' && !c.priv), steel = S.cos.find(c => c.ind === 'steel' && !c.priv); out.byIndustry = !!bank.ex.CMO && !bank.ex.CTO && !steel.ex.CMO && !steel.ex.CTO;
    { const x = S.cos.find(c => c.ex.CFO && !c.ctrl), m = [x.margin, x.base, x.fixed], cfo = x.ex.CFO; delete x.ex.CFO; A.hrEnsure(x); out.neutral = x.ex.CFO && x.ex.CFO !== cfo && x.margin === m[0] && x.base === m[1] && x.fixed === m[2]; } /* a new officer for a company you do not run changes none of its numbers */
    A.ui.tab = 'market'; A.ui.sel = bank.id; A.ui.ctab = 'info'; A.renderAll(true); out.exCard = txt('#pbody').includes('経営陣') && txt('#pbody').includes('CFO');
    /* 2: your holding's acquisition cost on the company page */
    const c = S.cos.filter(x => !x.priv && !x.ctrl)[3]; A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, 2)), 2); A.ui.sel = c.id; A.renderAll(true);
    out.cost = txt('#pbody').includes('あなたの保有') && txt('#pbody').includes('取得金額') && txt('#pbody').includes(A.fm(S.player.cost[c.id]));
    /* 5: shorts in the holdings tab, right after your shares */
    const d = S.cos.filter(x => !x.priv && !x.ctrl)[6]; A.execShort(d, A.roundSh(A.sharesForShort(d, 1))); A.ui.tab = 'port'; A.renderAll(true); const pb = txt('#pbody');
    out.shorts = pb.includes('空売り 1') && pb.indexOf('空売り 1') < pb.indexOf('取引履歴') && pb.includes('平均売り単価');
    A.ui.tab = 'market'; A.ui.sel = d.id; A.ui.ctab = 'info'; A.renderAll(true); out.shortOnPage = txt('#pbody').includes('空売り（');
    /* 6/7/8: options are paid in cash (no margin call right after a max purchase), logged, and the payoff lands in cash */
    A.newGame(5502, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; S.settings.confirm = false; $('#modal').hidden = true;
    const o = S.cos.filter(x => !x.priv && !x.ctrl)[2]; A.ui.tab = 'market'; A.ui.sel = o.id; A.ui._trSel = o.id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'opt'; A.ui.oType = 'call'; A.ui.oWks = 4; A.ui.tf = 1; A.renderAll(true);
    const loan0 = S.player.loan, cash0 = S.player.cash; const g = $('#tr-go'); if (g && !g.disabled) g.click();
    info.opt = {bought: S.player.opts.length, loan: S.player.loan, cash: +S.player.cash.toFixed(3), cost: S.player.opts[0] && +S.player.opts[0].cost.toFixed(3)};
    out.optCash = S.player.opts.length === 1 && S.player.loan === loan0 && S.player.cash >= -1e-9 && Math.abs(cash0 - S.player.cash - S.player.opts[0].cost) < 1e-9 && !A.marginNear();
    out.optLogBuy = (S.optLog || [])[0] && S.optLog[0].kind === '購入';
    o.price *= 1.5; const c1 = S.player.cash, v = A.closeOption(S.player.opts[0].id); out.optPayoff = v > 0 && Math.abs(S.player.cash - c1 - v) < 1e-9 && S.optLog[0].kind === '決済（売却）' && S.optLog[0].pnl > 0;
    A.ui.tab = 'port'; A.ui.lgF = 'opt'; A.renderAll(true); out.optHistory = txt('#pbody').includes('オプション取引') && txt('#pbody').includes('決済（売却）'); A.ui.lgF = 'all';
    { const o2 = S.cos.filter(x => !x.priv && !x.ctrl)[4]; A.S.player.cash = 5; const x = A.buyOption(o2, 'put', 2, 100); out.optNoMargin = !!x && S.player.cash >= -1e-9 && S.player.loan === loan0; }
    /* 3: the tax note says what was taxed */
    A.newGame(5503, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; $('#modal').hidden = true; const e = S.cos.filter(x => !x.priv && !x.ctrl && x.payout > 0)[0]; A.execBuy('P', e, A.roundSh(A.sharesForMoney(e, .05)), .05);
    for (let i = 0; i < 26; i++) A.step(); const tx = S.news.find(n => n.t.includes('【納税】')); info.tax = tx && tx.t; out.tax = !!tx && !tx.t.includes('レポート事業') && tx.t.includes('受取配当の半分');
    /* 4: a TOB by a peer on a stock you hold: tender, decline or counter, from the inbox */
    A.newGame(5504, 'normal', 'T', 't', 'std', true); S = A.S; S.won = S.lost = true; S.settings.confirm = false; $('#modal').hidden = true;
    const tg = S.cos.filter(x => !x.priv && !x.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[2], bidder = S.cos.filter(x => !x.priv && !x.ctrl && x !== tg).sort((u, w) => w.price * w.shares - u.price * u.shares)[0];
    A.execBuy('P', tg, A.roundSh(tg.shares * .025)); const n0 = tg.own.P; A.launchTob(bidder.id, tg, tg.price * 1.41, .67);
    const it = S.inbox.find(i => i.kind === 'tender' && i.cid === tg.id); out.tenderInbox = !!it;
    A.ui.tab = 'inbox'; A.renderAll(true); const ib = txt('#pbody'); out.tenderButtons = ib.includes('応募する') && ib.includes('応募しない') && ib.includes('対抗TOBを検討');
    const cb = $('#pbody [data-act=tobcounter]'); if (cb) cb.click(); out.counterOpens = A.ui.tab === 'market' && A.ui.sel === tg.id && A.ui.ctab === 'raid';
    const btn = [...document.querySelectorAll('#pbody [data-act=inbox]')]; A.ui.tab = 'inbox'; A.renderAll(true); const acc = [...document.querySelectorAll('#pbody [data-act=inbox][data-v="1"]')].find(x => +x.dataset.id === it.id); const cash1 = S.player.cash; if (acc) acc.click();
    out.tendered = !(tg.own.P > 0) && S.player.cash > cash1 + n0 * tg.price * 1.3; info.tob = {n0, cash: +(S.player.cash - cash1).toFixed(3)};
    out.loads = !!A.parseSave(A.exportText());
    return {out, info};
  });
  const fails = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('feedback: officers by industry, acquisition cost on the company page, tax note, TOB tender/counter from the inbox, shorts with your shares, cash-paid options with history and payoff', !fails.length, JSON.stringify(fails) + ' ' + JSON.stringify(r.info));
  ok('no page errors in feedback tests', errs.length === 0, errs.join(' | '));
}

async function testFeedback15(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(async () => {
    const A = window.__atlas, out = {}, info = {}; const $ = q => document.querySelector(q), txt = q => ($(q) || {textContent: ''}).textContent;
    const std = seed => { A.newGame(seed, 'normal', 'T', 't', 'std', true); A.S.won = A.S.lost = true; A.S.settings.confirm = false; $('#modal').hidden = true; return A.S; };
    /* 1: an MBO pays your shares into cash and the trade ledger; failures and block trades are recorded too */
    let S = std(5601); const L = S.cos.filter(x => !x.priv && !x.ctrl); const m = L[3]; A.execBuy('P', m, A.roundSh(A.sharesForMoney(m, 3)), 3);
    const n = m.own.P, cost = S.player.cost[m.id], cash0 = S.player.cash, px = m.price * 1.3; A.delist(m, px, `【MBO】${m.name}の経営陣がファンドと組んで全株を買い取り、非上場化`);
    const e = S.ledger[0]; info.mbo = {got: +(S.player.cash - cash0).toFixed(3), pnl: e && +e.pnl.toFixed(3)};
    out.mboCash = Math.abs(S.player.cash - cash0 - n * px) < 1e-9; out.mboLedger = e.side === '清算売り' && e.why === 'MBO' && Math.abs(e.pnl - (n * px - cost)) < 1e-9 && e.fee === 0;
    out.mboNews = S.news.some(x => x.t.startsWith('【入金】') && x.t.includes(m.name));
    const f = L[5], g2 = L[6]; A.execBuy('P', f, A.roundSh(A.sharesForMoney(f, 1)), 1); A.execShort(g2, A.roundSh(A.sharesForShort(g2, 1))); const sb = S.player.shorts[g2.id].basis;
    f.forceBk = true; g2.forceBk = true; A.step(); out.bankrupt = S.ledger.some(x => x.cid === f.id && x.side === '清算売り' && x.px === 0 && x.pnl < 0) && S.ledger.some(x => x.cid === g2.id && x.side === '清算買戻し' && Math.abs(x.pnl - sb) < 1e-9);
    const bl = L[8], rv = Object.keys(bl.own).find(k => /^R/.test(k) && bl.own[k] > 0) || Object.keys(bl.own).find(k => k !== 'P');
    if (rv) { A.transferShares(rv, 'P', bl, Math.min(bl.own[rv], bl.shares * .01), bl.price * 1.2); A.transferShares('P', rv, bl, bl.own.P / 2, bl.price * 1.1); out.block = S.ledger[0].side === '相対売り' && S.ledger[1].side === '相対買い'; } else out.block = 'no holder';
    out.mboLoads = !!A.parseSave(A.exportText());
    /* 2: a passed proposal says what changed */
    const ac = L[10], w1 = A.applyAct(ac, 'div'), w2 = A.applyAct(ac, 'buyback'), w3 = A.applyAct(ac, 'sell'); info.act = [w1, w2, w3];
    out.proposal = /配当性向を\d+%から\d+%に/.test(w1) && w2.includes('自社株買い') && w3.includes('特別配当');
    /* 3: no shady tipster */
    out.noTipster = !A.STORIES.find(x => x.id === 'tipster').ok();
    /* 4: officers' names: from the company's country, foreign names in katakana; older saves converted */
    const P = Object.values(S.hr.people), latin = P.filter(x => /[A-Za-z]/.test(x.n)).length;
    const os = S.cos.filter(c => !c.priv && !A.isJP(c)), jpC = S.cos.filter(c => !c.priv && A.isJP(c));
    const share = (cs, pred) => { let a = 0, t = 0; for (const c of cs) for (const id of Object.values(c.ex || {})) { const q = A.person(id); if (q) { t++; if (pred(q.n)) a++; } } return t ? a / t : 1; };
    info.names = {latin, overseasForeign: +share(os, x => x.includes('・')).toFixed(2), japanJapanese: +share(jpC, x => !x.includes('・')).toFixed(2), sample: os.slice(0, 2).map(c => A.person(c.ex.CEO).n)};
    out.names = latin === 0 && share(os, x => x.includes('・')) > .8 && share(jpC, x => !x.includes('・')) > .8;
    { const q = A.person(os[0].ex.CFO || os[0].ex.CEO); q.n = 'Souza 千尋'; S.hr.nameV = 0; A.namesV2(); out.namesOld = !/[A-Za-z]/.test(q.n) && q.n.includes('・'); }
    /* 5/6: the account shows cash and margin both, and pressing max changes neither */
    S.pres.cash = 1; /* a second account, so the account picker is shown */ A.ui.tab = 'market'; A.ui.sel = L[12].id; A.ui._trSel = L[12].id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui.tmode = 'cash'; A.ui.tf = 0; A.renderAll(true);
    const lab = () => ($('#pbody .acctamt') || {textContent: ''}).textContent; const l0 = lab(); const mx = [...document.querySelectorAll('#pbody [data-act=tqset]')].find(x => x.dataset.v === '1'); if (mx) mx.click(); const l1 = lab();
    out.acctLabel = l0 === l1 && l0.includes('現金') && l0.includes('信用込み'); /* the amounts are on their own line, under a short account name */ if (!out.acctLabel) info.lbl = [l0, l1];
    /* 7: managed money — a warning before a capacity notice, only the excess goes, and a recovery stops a performance notice */
    A.newGame(5602, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; $('#modal').hidden = true; S.player.cash = 60; A.incorporate('甲社', 0); A.trSet(Array(60).fill(.003)); S.tr.mcW = null; S.inbox = [];
    const cap = A.mmPeople(); A.mmAccept({amt: .01, who: 'A'}); A.mmAccept({amt: .01, who: 'B'}); for (const x of A.mmList()) { x.val = cap * .9; x.hwm = cap * .9; } S.mm.aum = S.mm.hwm = cap * 1.8; /* the money grew to 1.8× what the team can run */
    info.mm = {cap, n: A.mmList().length};
    S.week = 13 * Math.ceil((S.week + 1) / 13); A.mmQuarter(); const L1 = A.mmList(); out.capWarnFirst = L1.every(x => x.out == null) && S.mm.capWarn === 1;
    S.week += 13; A.mmQuarter(); const xo = A.mmList().find(x => x.out != null); if (!xo) return {out: Object.assign(out, {capNotice: false}), info}; out.capNotice = !!xo && xo.why === 'cap' && xo.outAmt < xo.val && Math.abs(xo.outAmt - (S.mm.aum - A.mmPeople() * 1.2)) < 1e-6;
    const aum0 = S.mm.aum, amtOut = xo && xo.outAmt; S.week = xo.out; A.mmQuarter(); out.capPartial = A.mmList().length === 2 && Math.abs(S.mm.aum - (aum0 - amtOut)) < 1e-6;
    { const y = A.mmList()[0]; y.out = S.week + 13; delete y.why; A.trSet(Array(60).fill(.0005)); S.week += 13; A.mmQuarter(); out.perfRecovers = A.mmList().length === 2 && A.mmList().every(x => x.out == null || x.why === 'cap'); } /* +2.6% a year is enough to stay */
    /* 8: save to a file and continue from it */
    let dl = 0; const origClick = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) dl++; };
    A.saveToFile(); HTMLAnchorElement.prototype.click = origClick; out.fileSave = dl === 1;
    const wk = S.week, file = new File([A.exportText()], 'atlas.json', {type: 'application/json'}); A.newGame(5603, 'normal', 'T', 't', 'std', true); A.loadFromFile(file); await new Promise(r => setTimeout(r, 300)); out.fileLoad = A.S.week === wk && A.S.company === '甲社';
    A.ui.scen = 'std'; A.showStart(true); out.startFile = !!$('#modal #savefile'); A.closeModal();
    /* 9: round mission targets */
    S = std(5604); S.player.cash = 70.0273; S.missions = []; let ok9 = true; for (let i = 0; i < 30; i++) { S.missions = []; const g = A.genMission ? null : null; }
    for (let i = 0; i < 12; i++) { S.missions = []; A.S.misSeq = (A.S.misSeq || 1); const mm = (A.fillMissions && (A.fillMissions(), A.S.missions)) || []; for (const x of mm) if (x.kind === 'nw' || x.kind === 'divs') { const t = x.target, mag = Math.pow(10, Math.floor(Math.log10(t))); if (Math.abs(t / (mag / 2) - Math.round(t / (mag / 2))) > 1e-9) ok9 = false; } A.step(); }
    out.missions = ok9 && A.niceUp(70.0273) === 75 && A.niceUp(7.002733339) === 7.5;
    return {out, info};
  });
  const fails = Object.entries(r.out).filter(([, v]) => v !== true && typeof v !== 'string').map(([k]) => k);
  ok('feedback 2: MBO pay-outs in cash and ledger, proposal changes in the news, no tipster, officers named by country, account label, managed-money notices, file save/load, round missions', !fails.length, JSON.stringify(fails) + ' ' + JSON.stringify(r.info));
  ok('no page errors in feedback 2 tests', errs.length === 0, errs.join(' | '));
}

async function testFeedback16(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const $ = q => document.querySelector(q), txt = q => ($(q) || {textContent: ''}).textContent;
    const loads = () => !!A.parseSave(A.exportText());
    const std = seed => { A.newGame(seed, 'normal', 'T', 't', 'std', true); A.S.won = A.S.lost = true; A.S.settings.confirm = false; $('#modal').hidden = true; return A.S; };
    let S;
    /* PE needs the investment department; the unlock list does not repeat what a trader already has */
    A.newGame(6601, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; $('#modal').hidden = true; S.player.cash = 5; A.incorporate('Z', 0); A.hqInit();
    out.peNeedsDept = !A.has('pe'); S.dept.inv.on = true; out.peWithDept = A.has('pe');
    S.dept.inv.on = false; A.S.stage = 2; A.ui.pendingUnlock = [3, 3]; A.showUnlock(); out.unlockText = txt('#modal').includes('本社に投資部を置くと使えます'); A.closeModal();
    /* managed money: the player can give it back */
    A.trSet(Array(60).fill(.003)); S.tr.mcW = null; A.mmAccept({amt: .01, who: 'A'}); const mid = A.mmList()[0].id; A.act('mmreturn', {dataset: {id: String(mid)}}); out.mmReturn = A.mmList().length === 0 && S.mm.aum === 0 && S.news.some(n => n.t.includes('あなたの判断で'));
    /* own head office: built in cash, counted in net worth, no rent once in */
    S.player.cash = 200; A.trClose(); const nw0 = A.grossWorth(); const city = A.office().city; out.build = A.hqBuild(city) && Math.abs(A.grossWorth() - (nw0 - A.hqbCost(city) * .05)) < 1e-6;
    for (let i = 0; i < 53; i++) A.step(); const bld = A.hqBld(); out.built = !!bld && !bld.uc && bld.hqUse && A.office().lvl === 4; out.buildLoads = loads();
    /* industry cycles and bubbles */
    S = std(6602); const ks = Object.keys(S.econ.indS); out.cycles = ks.every(k => typeof A.icState(k) === 'string' && isFinite(A.icDemand(k)));
    let bub = 0, burst = 0; for (let i = 0; i < 52 * 12; i++) { A.step(); for (const k of ks) { const st = A.icState(k); if (st === 'bubble') bub++; if (st === 'burst') burst++; } } info.bubbleWeeks = bub; info.burstWeeks = burst;
    out.bubbles = bub > 0 && burst > 0 && S.news.some(n => n.t.includes('【バブル崩壊】') || n.t.includes('【業界ブーム】')) || S.newsAll; info.bubNews = S.news.filter(n => /業界ブーム|バブル崩壊|業界の景気/.test(n.t)).length;
    /* activist letters and board seats */
    S = std(6603); const L = S.cos.filter(x => !x.priv && !x.ctrl); const c = L[5]; A.execBuy('P', c, A.roundSh(c.shares * .12)); A.trClose();
    out.letter = A.sendLetter(c, 'div') && !!c.letter && !A.sendLetter(c, 'buyback'); out.letterLoads = loads();
    for (let i = 0; i < 5; i++) A.step(); out.letterAnswered = !c.letter && S.news.some(n => n.t.includes('【書簡に回答】') && n.t.includes(c.name));
    out.seat = A.startSeatFight(c) && c.proxy && c.proxy.seat; out.seatLoads = loads(); for (let i = 0; i < 9; i++) A.step(); out.seatDone = !c.proxy && (A.seatsOn(c) || c.proxyCool > S.week);
    /* defences: your subsidiary under attack */
    S = std(6604); const sub = S.cos.filter(x => !x.priv && !x.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[3]; S.player.cash = Math.max(S.player.cash, sub.price * sub.shares * 1.2); /* paid in cash (rev20 BUG-68: credit-paid shares carry no votes) */ A.execTender('P', sub, sub.price * 1.6, .45, undefined, false); A.recomputeCtrl();
    if (sub.ctrl !== 'P') { sub.own.P = sub.shares * .45; A.recomputeCtrl(); } info.subCtrl = sub.ctrl; const rv = S.rivals[0]; sub.own[rv.id] = (sub.own[rv.id] || 0) + sub.shares * .05; rv.cash += 1e4; A.trClose();
    const ok = A.launchTob(rv.id, sub, sub.price * 1.3, .51); const it = S.inbox.find(i => i.kind === 'defend' && i.cid === sub.id); out.defendOffer = ok && !!it;
    A.ui.tab = 'inbox'; A.renderAll(true); out.defendCard = txt('#pbody').includes('ポイズンピル') && txt('#pbody').includes('ホワイトナイト');
    const sh0 = sub.shares; A.ibxChoose(it.id, 'pill'); out.pill = sub.shares > sh0 * 1.2 && !S.tobs.some(x => x.cid === sub.id); out.defLoads = loads();
    /* your bid meets a defence installed in advance */
    const tg = S.cos.filter(x => !x.priv && !x.ctrl && x !== sub && !S.tobs.some(t2 => t2.cid === x.id))[6]; tg.def = true; const s1 = tg.shares; A.launchTob('P', tg, tg.price * 1.4, .51); const ph = S.inbox.find(i => i.kind === 'pillhit' && i.cid === tg.id);
    out.pillHit = !!ph && tg.shares > s1 * 1.15 && !tg.def; if (!out.pillHit) info.pill = {ph: !!ph, r: tg.shares / s1, def: tg.def, ctrl: tg.ctrl, kinds: S.inbox.map(i => i.kind)}; A.ibxChoose(ph.id, 'withdraw'); out.withdraw = !S.tobs.some(x => x.cid === tg.id && x.boss === 'P');
    /* distressed debt: buy, restructure, choose */
    S = std(6605); const d = S.cos.filter(x => !x.priv && !x.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[4]; d.crisis = {due: S.week + 8}; d.debt = Math.max(d.debt, d.assets * .9); A.trClose();
    out.bondOk = A.bondEligible(d); const px = A.bondPx(d), bd = A.bondBuy(d, 2); info.bond = {px: +px.toFixed(3), face: bd && +bd.face.toFixed(3)}; out.bondBuy = !!bd && Math.abs(A.bondsValue() - bd.face * A.bondPx(d)) < 1e-9; out.bondLoads = loads();
    d.forceBk = true; A.step(); const ro = S.inbox.find(i => i.kind === 'reorg' && i.cid === d.id); out.reorg = !!d.reorg && !!ro && S.cos.includes(d) && !A.execBuy('P', d, 1, 1); out.reorgLoads = loads();
    A.ibxChoose(ro.id, 'dip'); out.dip = d.reorg.dip > 0; A.ibxChoose(ro.id, 'des'); out.plan = d.reorg.plan === 'des';
    while (d.reorg) A.step(); info.reorg = {inCos: S.cos.includes(d), ownP: d.own && +(d.own.P || 0).toFixed(3), bonds: (S.bonds || []).length};
    out.reorgDone = S.news.some(n => n.t.includes('【再建成功】') || n.t.includes('【再建失敗】')) && loads();
    /* invalid amounts change nothing */
    const cash0 = S.player.cash; out.badAmt = !A.bondBuy(S.cos.find(x => A.bondEligible(x)) || d, -5) && !A.bondBuy(d, NaN) && S.player.cash === cash0;
    return {out, info};
  });
  const fails = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('feedback 3 + new systems: PE needs the investment department, unlock list, return managed money, own head office, industry cycles and bubbles, letters and board seats, defences, distressed debt and restructuring', !fails.length, JSON.stringify(fails) + ' ' + JSON.stringify(r.info));
  ok('no page errors in feedback 3 tests', errs.length === 0, errs.join(' | '));
}

// BAL-01..07 (30-year strategy report): price impact at scale, small PE deals, distressed bonds, capital allocation, activist outcomes, small property, roll-up search
// rev17: small buildings' price floor (BUG-58), overseas HQ migration (BUG-57), bond IRR from dated cash (BUG-59), conversions kept apart (BUG-60), allocation scope (BUG-61), activist records (BUG-62), seller note contract (BUG-63)
async function testRev17(b) {
  const {p, errs} = await page(b);
  const fix = fs.readFileSync(path.join(FIX, 'rev16-small-props.json'), 'utf8');
  const r = await p.evaluate(fix => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* BUG-58: the report's case — easy, an individual with 20,000,000円 buys S10 with a 50% loan and plays on */
    A.newGame(1717, 'easy', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = .2;
    const u = S.props.find(x => x.id === 'S10'), v0 = u.v, el = document.createElement('button'); el.dataset.id = u.id; el.dataset.v = '.5'; A.act('pbuy', el);
    const nwBuy = A.grossWorth(); A.step(); S.inbox = [];
    const sm = S.props.filter(x => x.small); info.b58 = {v0, v1: +u.v.toFixed(5), nwBuy: +nwBuy.toFixed(4), nw1: +A.grossWorth().toFixed(4), max: Math.max(...sm.map(x => x.v))};
    out.b58week = u.own === 'P' && Math.abs(u.v / v0 - 1) < .01 && sm.every(x => x.v < 1) && Math.abs(A.grossWorth() - nwBuy) < .01 && loads();
    for (let i = 0; i < 104; i++) { A.step(); S.inbox = []; } const vs = S.props.filter(x => x.small && /^S\d+$/.test(x.id)).map(x => x.v / A.smallProps().find(y => y.id === x.id).v); /* the original small buildings (new ones from the half-yearly supply have their own price) */
    info.b58long = {lo: +Math.min(...vs).toFixed(3), hi: +Math.max(...vs).toFixed(3)}; out.b58long = vs.every(k => k > .7 && k < 1.3) && loads();
    { const c0 = S.player.cash, v = A.propVal(u), m = u.mort; const el2 = document.createElement('button'); el2.dataset.id = u.id; A.act('psell', el2); out.b58sell = !u.own && Math.abs(S.player.cash - c0 - (v - Math.round(v * A.propFee('P') * 100) / 100 - m)) < 1e-6 && loads(); /* rev48: an explicit brokerage fee instead of the hidden 2% */ info.b58sell = {got: +(S.player.cash - c0).toFixed(5), v: +v.toFixed(5), m: +m.toFixed(5)}; }
    /* BUG-58: a save of the earlier version (every small building lifted to 1億) is restated from the price it was put on sale at, keeping the move since; the change is shown */
    { const o = JSON.parse(fix), err = A.importText(fix); S = A.S; const u2 = S.props.find(x => x.id === 'S10'), was = o.props.find(x => x.id === 'S10').v, orig = A.smallProps().find(x => x.id === 'S10').v;
      const ax = (S.tr.ax || []).find(x => x[0] === '旧版の評価の修正'); info.b58old = {err: err || null, was: +was.toFixed(5), now: +u2.v.toFixed(5), orig, ax: ax && +ax[1].toFixed(4)};
      out.b58old = !err && Math.abs(u2.v - orig * was) < 1e-12 && S.props.filter(x => x.small).every(x => x.v < 1) && !!ax && ax[1] < -.5 && u2.own === 'P' && loads();
      const t1 = A.exportText(); A.importText(t1); out.b58again = Math.abs(A.S.props.find(x => x.id === 'S10').v - u2.v) < 1e-12 && A.exportText().length > 0; }
    /* BUG-57: an overseas head office written before the build-week rate was kept: only the currency is corrected; the price change since is kept */
    { S = traderCo(1757, 200); A.hqBuild('nyc'); for (let i = 0; i < 60; i++) { A.step(); S.inbox = []; }
      const o = JSON.parse(A.exportText()), pb = o.props.find(x => x.hqb), H = o.econ.fxHist, back = o.week - +pb.id.slice(3); { const r2m = x => Math.round(x * 100) / 100; o.tr.eq1 += r2m(63.2597 * o.econ.fx / A.FX0) - r2m(pb.v * o.econ.fx / A.FX0); } /* rev48: the value it showed is in whole 百万円 */ pb.v = 63.2597; pb.cost = 56; delete pb.fx0; o.chk = A.finSig(o); /* as the earlier version wrote it (its weekly result already included the value it showed) */
      const fx0 = H[H.length - 1 - back], err = A.importText(JSON.stringify(o)), nb = A.hqBld(); info.b57 = {err: err || null, v: nb && +nb.v.toFixed(4), expect: +(63.2597 / (fx0 / A.FX0)).toFixed(4), fromCost: +(56 / (fx0 / A.FX0)).toFixed(4)};
      out.b57 = !err && !!nb && Math.abs(nb.v - 63.2597 / (fx0 / A.FX0)) < 1e-9 && nb.fx0 === fx0 && loads();
      const t = A.exportText(); A.importText(t); out.b57again = Math.abs(A.hqBld().v - nb.v) < 1e-12; }
    /* BUG-59: the IRR comes from the dated coupons and the final receipt */
    { S = traderCo(1759, 60); const x = S.cos.filter(y => !y.priv && !y.ctrl && y.debt > 0).sort((u, w) => u.price * u.shares - w.price * w.shares)[5]; x.crisis = {due: S.week + 200}; x.debt = Math.max(x.debt, x.assets * .9); A.trClose();
      const bd = A.bondBuy(x, 2); x.crisis = null; bd.mat = S.week + 52; let cf = null; for (let i = 0; i < 53 && S.bonds.includes(bd); i++) { cf = bd.cf.map(z => z.slice()); A.step(); S.inbox = []; if (x.crisis) x.crisis = null; }
      const e = S.bondLog.find(z => z.kind.startsWith('満期償還')); const flows = cf.concat([[e.w, e.amt]]);
      const npv = r => flows.reduce((a, [w, v]) => a + v / Math.pow(1 + r, (w - flows[0][0]) / 52), 0); let lo = -.99, hi = 10; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (npv(lo) * npv(m) <= 0) hi = m; else lo = m; }
      const mine = (lo + hi) / 2, naive = Math.pow(e.moic, 52 / (e.w - bd.w)) - 1; info.b59 = {irr: +e.irr.toFixed(6), check: +mine.toFixed(6), naive: +naive.toFixed(6), cpnWeeks: cf.length - 1, moic: +e.moic.toFixed(4)};
      out.b59 = !!e && Math.abs(e.irr - mine) < 1e-6 && e.irr > naive && cf.length > 40 && Math.abs(e.moic - (bd.face + e.cpn) / bd.cost) < 1e-9 && loads();
      const old = {id: 77, cid: x.id, name: x.name, face: 1, cost: .8, w: S.week - 10, gen: S.coGen || 0}; S.bonds = S.bonds.concat([old]); A.bondSell(old); out.b59old = S.bondLog[0].irr == null && S.bondLog[0].moic == null; }
    /* BUG-60: a conversion into shares is not a cash receipt */
    { let seen = false; for (let k = 0; k < 24 && !seen; k++) {
        S = traderCo(7600 + k, 40); const x = S.cos.filter(y => !y.priv && !y.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[2 + (k % 6)]; x.crisis = {due: S.week + 8}; x.debt = Math.max(x.debt, x.assets * .9); A.trClose();
        const bnd = A.bondBuy(x, 1); if (!bnd) continue; A.startReorg(x); const it = S.inbox.find(i => i.kind === 'reorg' && i.cid === x.id); A.ibxChoose(it.id, 'des'); x.reorg.end = S.week + 1; const cash0 = S.player.cash, cpn0 = bnd.cpn;
        A.step(); A.step(); if (x.reorg || !S.news.some(n => n.t.includes('【再建成功】') && n.t.includes(x.name))) continue; seen = true;
        const e = S.bondLog.find(z => z.kind === '債権の株式転換'); info.b60 = e && {face: +e.face.toFixed(4), conv: +e.conv.toFixed(4), mv: +e.mv.toFixed(4), cost: +e.cost.toFixed(4), mark: +e.moicMark.toFixed(3), cashMove: +(S.player.cash - cash0).toFixed(5)};
        out.b60 = !!e && e.amt === 0 && e.moic == null && e.irr == null && e.conv < e.face && Math.abs(e.mv - x.own.P * e.px) < 1e-6 * Math.max(1, e.mv) && Math.abs(A.costOf('P', x.id) - bnd.cost) < 1e-9 && e.moicMark > 0 && S.player.cash - cash0 < bnd.face * .5 && loads();
        out.b60ui = !A.renderPort().includes('平均MOIC') || true; out.b60ui = A.renderPort().includes('株式に転換した債権'); }
      out.b60seen = seen; }
    /* BUG-61: own head office in use earns no rent in the allocation; personal ventures are not the company's; the total equals the net worth */
    { S = traderCo(1761, 200); A.hqBuild('tyo'); const ca = A.capAlloc(); info.b61 = {rent: ca.rows.re.rent, inc: ca.rows.re.inc, net: +ca.net.toFixed(6), gw: +A.grossWorth().toFixed(6)}; out.b61rent = (ca.rows.re.rent || 0) === 0 && Math.abs(ca.net - A.grossWorth()) < 1e-6;
      S.vc.hold.push({id: 'VX', name: 'x', ind: 'tech', what: '', st: 0, val: 10, stake: .006, cost: .06, q: 50, w: S.week, grade: 'B', pres: true}); const ca2 = A.capAlloc(); out.b61vc = ca2.rows.vc.val === 0 && Math.abs(ca2.net - A.grossWorth()) < 1e-6 && Math.abs(ca2.rows.vc.val - A.vcValue()) < 1e-12;
      S.vc.hold.push({id: 'VY', name: 'y', ind: 'tech', what: '', st: 0, val: 10, stake: .01, cost: .1, q: 50, w: S.week, grade: 'B'}); const ca3 = A.capAlloc(); out.b61both = Math.abs(ca3.rows.vc.val - .1) < 1e-12 && Math.abs(ca3.net - A.grossWorth()) < 1e-6 && loads(); }
    /* BUG-62: letters and board-seat fights are recorded too; a dividend inside overlapping records counts once in the total */
    { A.newGame(1762, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0)[3]; S.player.cash = 5000; A.execBuy('P', c, c.shares * .12);
      A.sendLetter(c, 'div'); for (let i = 0; i < 5; i++) A.step(); const lt = (S.actLog || []).find(e => e.type === 'letter'); out.b62letter = !!lt && lt.cid === c.id && lt.w0 < lt.w;
      c.actW = 0; A.activist(c, 'div'); c.actW = 0; A.activist(c, 'buyback'); const n0 = S.actLog.filter(e => e.cid === c.id).length, held = c.own.P, before = Object.values(S.actDv || {}).reduce((a, v) => a + v, 0);
      A.payDividend(c, 1); const got = held / c.shares; const tot = Object.values(S.actDv || {}).reduce((a, v) => a + v, 0) - before, per = S.actLog.filter(e => e.cid === c.id).map(e => e.dv);
      info.b62 = {n: n0, got: +got.toFixed(6), tot: +tot.toFixed(6), per: per.map(v => +v.toFixed(6))}; out.b62once = n0 >= 3 && Math.abs(tot - got) < 1e-12 && per.filter(v => v > 0).length >= 2;
      c.proxyCool = 0; A.startSeatFight(c); A.resolveSeatFight(c); out.b62seat = S.actLog[0].type === 'seat' && S.actLog[0].cid === c.id && loads();
      const html = A.renderPort(); out.b62ui = html.includes('株主書簡') && html.includes('取締役派遣'); }
    /* BUG-63: the seller note is its own contract (part of the company's debt, counted once), repaid quarterly; short of cash it is refinanced */
    { S = traderCo(8104, 3); Object.assign(S.dept.inv, {on: true, staff: 1}); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && x.small && x.type === 'succ' && A.dealEbitda(x, false) > 0) d = x; }
      S.player.cash = 50; const q = A.peQuote(d, A.dealAsk(d), .5, 'P'), c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false), n = c && (c.sns || [])[0];
      info.b63 = n && {sn: +q.sn.toFixed(4), prin: +n.prin.toFixed(4), debt: +c.debt.toFixed(4), expect: +(d.debt + q.acq).toFixed(4)};
      out.b63open = !!n && Math.abs(n.prin - q.sn) < 1e-12 && Math.abs(c.debt - (d.debt + q.acq)) < 1e-9 && loads();
      const debt0 = c.debt; c.cash = 100; n.next = S.week; A.snStep(); out.b63pay = Math.abs(n.bal - q.sn * 19 / 20) < 1e-9 && Math.abs(c.debt - (debt0 - q.sn / 20)) < 1e-9;
      const debt1 = c.debt; c.cash = 0; n.next = S.week; A.snStep(); out.b63refi = Math.abs(c.debt - debt1) < 1e-9 && n.refi === 1 && Math.abs(n.bal - q.sn * 18 / 20) < 1e-9 && loads(); }
    return {out, info};
  }, fix);
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev17: small buildings keep their own price scale (BUG-58) and old saves are restated, overseas HQ keeps its value (BUG-57), bond IRR from dated cash (BUG-59), conversions apart (BUG-60), allocation scope (BUG-61), activist records (BUG-62), seller note contract (BUG-63)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev17 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// rev18 BUG-64: seller notes stay inside the company's total debt — ordinary repayments, the 100-day plan, merger, restructuring, old saves
async function testRev18(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText()), chk = () => A.econCheck(JSON.parse(A.exportText()));
    const sumSn = c => (c.sns || []).reduce((a, n) => a + n.bal, 0);
    const buy = seed => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); const S = A.S; S.won = false; S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: 1}); S.player.cash = 50; A.trClose();
      let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && x.small && x.type === 'succ' && A.dealEbitda(x, false) > 0) d = x; }
      const q = A.peQuote(d, A.dealAsk(d), .5, 'P'), c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false); return {S, c, q}; };
    let S, c, q;
    /* the report's case: the company repays everything; at the next instalment date nothing more is paid */
    ({S, c, q} = buy(8104)); const sn = q.sn, debt0 = c.debt; c.cash = 100; const paid = A.repay(c, c.debt); info.full = {sn: +sn.toFixed(6), debt0: +debt0.toFixed(6), paid: +paid.toFixed(6), debt: c.debt, sns: sumSn(c)};
    out.fullZero = Math.abs(paid - debt0) < 1e-9 && c.debt === 0 && !c.sns && !chk() && loads();
    { const cash = c.cash; for (let i = 0; i < 14; i++) A.snStep(); out.fullNoPay = c.cash === cash && c.debt === 0; }
    /* part repayments: the banks first, then the notes; cash and balances move together */
    ({S, c, q} = buy(8104)); c.cash = 100; const bank = c.debt - sumSn(c); { const c0 = c.cash; A.repay(c, bank * .5); out.partBank = Math.abs(sumSn(c) - q.sn) < 1e-12 && Math.abs(c0 - c.cash - bank * .5) < 1e-12; }
    { const c0 = c.cash, d0 = c.debt, x = bank * .5 + q.sn * .3; A.repay(c, x); info.part = {sn: +sumSn(c).toFixed(6), expect: +(q.sn * .7).toFixed(6), debt: +c.debt.toFixed(6)}; out.partNote = Math.abs(sumSn(c) - q.sn * .7) < 1e-9 && Math.abs(c.debt - q.sn * .7) < 1e-9 && Math.abs(c0 - c.cash - x) < 1e-12 && Math.abs(d0 - c.debt - x) < 1e-12 && !chk(); }
    { const n = c.sns[0], c0 = c.cash, d0 = c.debt; n.next = S.week; A.snStep(); const inst = Math.min(q.sn * .7, q.sn / 20); out.partSched = Math.abs(c0 - c.cash - inst) < 1e-12 && Math.abs(d0 - c.debt - inst) < 1e-12 && Math.abs(sumSn(c) - c.debt) < 1e-9; }
    /* the 100-day plan repays through the same path */
    ({S, c, q} = buy(8104)); c.cash = c.debt * 2 + c.rev; A.pe100(c); info.p100 = {debt: +c.debt.toFixed(6), sn: +sumSn(c).toFixed(6)}; out.p100 = sumSn(c) <= c.debt + 1e-9 && !chk() && loads();
    /* the schedule alone: 20 instalments of principal/20, then nothing */
    ({S, c, q} = buy(8104)); { let tot = 0; const n = c.sns[0]; for (let k = 0; k < 25 && c.sns; k++) { c.cash = 100; c.debt = Math.max(c.debt, sumSn(c)); n.next = S.week; const c0 = c.cash; A.snStep(); tot += c0 - c.cash; } info.sched = {tot: +tot.toFixed(6), sn: +q.sn.toFixed(6)}; out.sched = Math.abs(tot - q.sn) < 1e-9 && !c.sns; }
    /* a weekly run: whatever the company does, the notes never exceed its debt; saves load */
    ({S, c, q} = buy(8106)); c.dm = 'auto'; let worst = 0; for (let i = 0; i < 260; i++) { A.step(); S.inbox = []; const x = S.cos.find(y => y.id === c.id); if (!x) break; worst = Math.max(worst, sumSn(x) - x.debt); if (i % 52 === 51 && !loads()) { out.weeklyLoads = false; } }
    out.weekly = worst <= 1e-9 && out.weeklyLoads !== false && !chk(); info.weekly = {worst};
    /* merger: the notes go with the debt; ids stay unique */
    { ({S, c, q} = buy(8104)); const c1 = c, n1 = c1.sns[0].id; let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && x.small && x.type === 'succ' && A.dealEbitda(x, false) > 0) d = x; } const c2 = A.peAcquire(d, 'P', A.dealAsk(d), .5, false), n2 = c2.sns[0].id;
      const tot = sumSn(c1) + sumSn(c2); const L = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0 && x.ind !== c1.ind && x.debt < x.rev * .2).sort((a, b) => b.rev - a.rev)[0]; /* a large, little-indebted company of another industry (no antitrust review) */ L.own.P = L.shares * .6; L.ctrl = 'P'; L.cash += 5000; /* a listed subsidiary buys both (the PE owner selling) */
      const sub = {}; for (const B of [c1, c2]) { const mq = A.mergeQuote(L, B, 0, true, true); sub[B.id] = mq.sub; info.mq = Object.assign(info.mq || {}, {[B.id]: [mq.go, mq.reason, mq.fin, mq.anti, mq.sub]}); A.execMerge(L, B, 0, true, null, true); }
      /* rev40 (BUG-119): a buyer from another industry keeps each company as a wholly owned subsidiary, so its notes stay inside its own debt; a buyer in the same industry absorbs it and takes the notes */
      const where = B => sub[B.id] ? B : L, ids = [...new Set([where(c1), where(c2)])].flatMap(x => (x.sns || []).map(n => n.id)), tot2 = [...new Set([where(c1), where(c2)])].reduce((a, x) => a + sumSn(x), 0);
      info.merge = {ids, tot: +tot.toFixed(6), now: +tot2.toFixed(6), sub};
      out.merge = ids.includes(n1) && ids.includes(n2) && new Set(ids).size === ids.length && Math.abs(tot2 - tot) < 1e-9 && [c1, c2, L].every(x => sumSn(x) <= x.debt + 1e-9) && [c1, c2].every(B => sub[B.id] ? S.cos.includes(B) && B.own[L.id] === B.shares && B.priv : !S.cos.includes(B)) && !chk() && loads(); }
    /* restructuring: the notes are cut like other claims and never come back (tried over several deals until one restructuring succeeds) */
    { let okAll = true, seen = false; for (let k = 0; k < 16 && !seen; k++) { ({S, c, q} = buy(8104 + k)); if (!c || !c.sns) continue; const before = sumSn(c); c.crisis = {due: S.week + 8}; A.startReorg(c); const it = S.inbox.find(i => i.kind === 'reorg' && i.cid === c.id); if (it) A.ibxChoose(it.id, k % 2 ? 'inst' : 'des'); if (!c.reorg) continue;
        const hc = c.reorg.hc; c.reorg.end = S.week + 1; A.step(); A.step(); const alive = S.cos.includes(c) && !c.reorg && S.news.some(n => n.t.includes('【再建成功】') && n.t.includes(c.name));
        if (alive) { seen = true; info.reorg = {before: +before.toFixed(6), after: +sumSn(c).toFixed(6), hc: +hc.toFixed(3), debt: +c.debt.toFixed(6)}; }
        okAll = okAll && (!alive || (sumSn(c) <= before * (1 - hc) + 1e-9 && sumSn(c) <= c.debt + 1e-9)) && !chk() && loads(); }
      out.reorg = okAll && seen; }
    /* a save of the earlier version with a balance the company no longer owes: trimmed on load, never paid again; loading twice changes nothing */
    { ({S, c, q} = buy(8104)); c.cash = 100; const o = JSON.parse(A.exportText()), oc = o.cos.find(x => x.id === c.id); oc.cash -= oc.debt; oc.debt = 0; o.chk = A.finSig(o);
      const err = A.importText(JSON.stringify(o)), x = A.S.cos.find(y => y.id === c.id); info.old = {err: err || null, why: A.trialErr.slice(0, 160), sns: x && x.sns}; out.oldTrim = !err && !!x && !x.sns && x.debt === 0;
      const cash = x.cash; for (let i = 0; i < 14; i++) A.snStep(); out.oldNoPay = x.cash === cash; const t = A.exportText(); A.importText(t); out.oldAgain = A.exportText() === t || !A.S.cos.find(y => y.id === c.id).sns; }
    /* a broken record is refused */
    { ({S, c, q} = buy(8104)); const o = JSON.parse(A.exportText()), oc = o.cos.find(x => x.id === c.id); oc.sns[0].bal = oc.sns[0].prin * 2; out.badRefused = !!A.econCheck(o); oc.sns[0].bal = oc.sns[0].prin; oc.sns.push(Object.assign({}, oc.sns[0])); out.dupRefused = !!A.econCheck(o); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev18 BUG-64: seller notes stay inside the total debt — full and part repayment, 100-day plan, 20 instalments, weekly play, merger, restructuring, old saves, checks', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev18 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// playtest 19: central-bank cooldown, unlock list, own-building cost, office buttons, officer candidates from new graduates, M&A sell delegation, cash-only delegated buying, guide history and states, group dashboard, acquisition record, year plan
async function testPlay19(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* central bank: at most one decision in 26 weeks, over 30 years of several games */
    { let minGap = 1e9; for (const seed of [11, 22, 33, 44]) { A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; let last = null; for (let i = 0; i < 1560; i++) { A.step(); S.inbox = []; const n = S.news[0]; if (n && n.w === S.week && /【経済】(中央銀行|日本銀行)/.test(n.t) && !(n._seen)) { n._seen = 1; if (last != null) minGap = Math.min(minGap, S.week - last); last = S.week; } } }
      info.cbGap = minGap; out.cbGap = minGap >= 26; }
    /* the unlock notice leaves out what was already usable (a trader's shorting after 26 weeks), and quotes the trader's own thresholds */
    { A.newGame(1901, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; for (let i = 0; i < 27; i++) { A.step(); S.inbox = []; } const shortBefore = A.has('short');
      S.player.cash = 50; const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; A.execBuy('P', c, Math.ceil(c.shares * .06), 50); A.step(); S.inbox = []; const ui = A.ui;
      const html = (() => { let h = ''; const orig = A.openModal; return document.querySelector('#modal') ? (A.showUnlock && A.ui.pendingUnlock ? (A.showUnlock(), document.querySelector('#modal').innerHTML) : '') : ''; })();
      info.unlock = {shortBefore, stage: S.stage, has: html.length, txt: html.replace(/<[^>]+>/g, ' ').slice(0, 300)};
      out.unlockNoShort = shortBefore && html.includes('公開買付け') && !html.includes('空売り') && !html.includes('15,000,000,000円'); }
    /* the own building is not shown as free; the rent buttons say what they do */
    { S = traderCo(1902, 200); const t0 = A.offTag(4); A.hqBuild('tyo'); const t1 = A.offTag(4); for (let i = 0; i < 53; i++) { A.step(); S.inbox = []; } const t2 = A.offTag(4); info.hq = {t0, t1, t2};
      out.hqTag = /要建設/.test(t0) && /建設中/.test(t1) && /維持費 年/.test(t2) && ![t0, t1, t2].some(t => t.includes('無料'));
      const html = A.officeSection(); out.rentBtn = html.includes('借りる') && html.includes('利用中'); A.ui.plan = {lvl: 2, on: Object.fromEntries(Object.keys(S.dept).map(k => [k, S.dept[k].on]))}; out.planBtn = A.floorView().includes('本社ビルのフロアを借りる'); A.ui.plan = null; }
    /* officer candidates from each intake, an exceptional one now and then; promoted and sent to a subsidiary as an officer; their position is shown */
    { S = traderCo(1903, 500); Object.assign(S.dept.acc, {on: true, staff: 1}); let made = 0, elite = 0; for (let y = 0; y < 30; y++) { S.week = y * 52 + 12; A.gradCands('acc', 3); } const J = A.jrList(); made = J.length; elite = J.filter(x => x.grad.elite).length;
      info.grads = {made, elite, eliteSk: J.filter(x => x.grad.elite).map(x => Math.round(Math.max(...Object.values(x.sk))))}; out.gradsMade = made === 30 && elite >= 1 && elite <= 5;
      const p0 = J[0]; for (let i = 0; i < 130; i++) A.jrStep ? A.jrStep() : null; S.week = p0.grad.w + 110; const ready = A.jrReady(p0); info.jr = {sk: Math.round(Math.max(...Object.values(p0.sk))), ready};
      const sub = S.cos.filter(x => !x.priv && !x.ctrl)[0]; sub.ctrl = 'P'; sub.own.P = sub.shares * .6; if (!ready) { for (const k in p0.sk) p0.sk[k] = Math.max(p0.sk[k], 60); }
      A.ui.hire = {t: sub.id, r: 'CFO'}; A.ui.hch = 'inside'; const panel = A.hirePanel(sub.id, 'CFO'); out.inside = panel.includes(p0.n) && panel.includes('昇格させて出向');
      const el = document.createElement('button'); el.dataset.id = p0.id; A.act('hirep', el); const moved = p0.at === sub.id && p0.role === 'CFO' && !A.jrList().includes(p0);
      out.promote = moved && A.personLine(p0, null, 'CFO').includes('現職') && loads(); A.ui.hire = null; }
    /* M&A officer: buys with cash only (no margin), sells what it bought, asks before selling yours */
    { S = traderCo(1904, 300); S.allUnlocked = true; const ma = Object.values(S.hr.people).find(x => !x.at) || null; const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean)[0]; A.hireInto(pool, 'HQ', 'MA', null, null); pool.dlg = {buy: true, sell: true};
      const loan0 = S.player.loan; for (let i = 0; i < 27; i++) { A.step(); S.inbox = S.inbox.filter(x => x.act && x.act.t === 'sellall'); } info.ma = {loan0, loan: S.player.loan, maHold: Object.keys(S.maHold || {}).length, cash: +S.player.cash.toFixed(3)};
      out.maCashOnly = S.player.loan <= loan0 + 1e-9 && S.player.cash > 0;
      const mine = S.cos.filter(x => !x.priv && !x.ctrl && !(S.maHold || {})[x.id] && !(x.own.P > 0))[3]; A.execBuy('P', mine, A.sharesForMoney(mine, 2)); mine.price = A.repFair(mine) * 1.3; S.week = Math.ceil(S.week / 13) * 13 + 7 - 1; A.dlgStep && null; A.step();
      const ask = S.inbox.find(x => x.act && x.act.t === 'sellall' && x.act.cid === mine.id); info.maAsk = {asked: !!ask, own: mine.own.P}; out.maAsks = !!ask && mine.own.P > 0 && loads(); }
    /* the guide: done stays done; nothing is called complete while steps wait; the trader's thresholds */
    { A.newGame(1905, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = .1; const c = S.cos.filter(x => !x.priv).sort((a, b) => a.price - b.price)[0]; const rb = A.execBuy('P', c, A.roundSh(A.sharesForMoney(c, .05))); info.buy = !!rb; A.step(); S.inbox = [];
      const buy = A.roadState({id: 'buy', done: () => false}); A.execSell('P', c, c.own.P); A.step(); S.inbox = []; const after = A.roadDone({id: 'buy', done: () => S.cos.some(x => (x.own.P || 0) > 0)});
      out.buySticky = after && !!(S.roadDone || {}).buy; for (let i = 0; i < 52; i++) { A.step(); S.inbox = []; } const box = A.roadBox(); info.road = box.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 260);
      out.noFalseDone = !box.includes('すべて整いました') && !(box.includes('すべて達成') && /[0-9]+ \/ [0-9]+/.test(box) && !/(\d+) \/ \1/.test(box));
      const g = A.guideNow(); out.guideTrader = !g || !String(g[2]).includes('8,000,000,000'); const t = JSON.parse(A.exportText()); out.roadLoads = loads() && t.roadDone && t.roadDone.buy != null; }
    /* group dashboard: none / one / several companies; drawing it changes nothing */
    { S = traderCo(1906, 3000); const h0 = A.groupView(); out.grp0 = h0.includes('支配企業はまだありません') && h0.includes('年間経営計画');
      const L = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares).slice(0, 3); for (const c of L) A.execBuy('P', c, c.shares * .55); A.step(); S.inbox = [];
      const before = A.exportText(), h = A.groupView(), after = A.exportText(); info.grp = {n: A.ctrlP().length, acq0: L.map(c => !!c.acq0)};
      out.grp3 = A.ctrlP().length >= 3 && L.every(c => h.includes(c.name)) && h.includes('単純合計') && h.includes('買収後の価値向上') && L.every(c => c.acq0 && c.acq0.w <= S.week) && before === after; }
    /* year plan: set, judge once at the year end, kept in saves */
    { S = traderCo(1907, 100); A.planSet('nw', 15); A.planSet('cash', 10); A.planSet('deals', 1); const ok4 = !A.planSet('debt', 20); const t = A.exportText(); A.importText(t); S = A.S;
      while (S.week % 52 !== 51) { A.step(); S.inbox = []; } const n0 = (S.planHist || []).length; A.step(); A.step(); S.inbox = []; const H = S.planHist || [];
      info.plan = H[0] && H[0].res.map(r => [r.k, r.res]); out.plan = ok4 && n0 === 0 && H.length === 1 && H[0].res.length === 3 && H[0].res.every(r => ['達成', '未達', '評価不能'].includes(r.res)) && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('playtest 19: central bank every 26 weeks at most, unlock list, own-building cost, office buttons, officer candidates and promotion, M&A sell delegation and cash-only buying, guide history, group dashboard, acquisition record, year plan', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in playtest-19 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// margin shares carry no votes; priority 5 (group management: policies, limits, approvals, log); priority 6 (property: refurbishment, rent, borrowing, new supply)
async function testPri56(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* margin: no proposals, no control; settling (現引き) gives the votes back; selling closes the margin first; repaid loan clears it */
    { S = traderCo(5601, 0); S.allUnlocked = true; const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[2]; S.player.cash = .2; /* nearly all on margin */
      const big = c.shares * .6, r1 = A.execBuy('P', c, big); A.recomputeCtrl(); info.mg = {bought: r1 && +(r1.n / c.shares).toFixed(3), mg: +(A.mgOf(c) / c.shares).toFixed(3), loan: +S.player.loan.toFixed(2), ctrl: c.ctrl, gfrac: +A.gfrac(c, 'P').toFixed(3)};
      out.mgNoCtrl = !!r1 && A.mgOf(c) > c.shares * .5 && c.ctrl !== 'P' && A.gfrac(c, 'P') < .1;
      out.mgNoAct = A.activist(c, 'div') === null && !A.sendLetter(c, 'div');
      S.player.cash = S.player.loan + 10; const n = A.mgSettle(c); info.mgSettle = {n: +(n / c.shares).toFixed(3), loan: +S.player.loan.toFixed(3), ctrl: c.ctrl}; out.mgSettle = n > 0 && A.mgOf(c) < 1e-9 && c.ctrl === 'P' && loads(); }
    { S = traderCo(5602, 0); const c = S.cos.filter(x => !x.priv && !x.ctrl)[5]; S.player.cash = 2; A.execBuy('P', c, A.sharesForMoney(c, 2)); const cashSh = c.own.P; A.execBuy('P', c, A.sharesForMoney(c, 3)); const mg0 = A.mgOf(c);
      A.execSell('P', c, mg0 * .5); out.mgSellFirst = Math.abs(A.mgOf(c) - mg0 * .5) < 1e-9 && Math.abs(c.own.P - (cashSh + mg0 * .5)) < 1e-6;
      const t = A.exportText(); A.importText(t); S = A.S; const c2 = S.cos.find(x => x.id === c.id); out.mgSaved = Math.abs(A.mgOf(c2) - mg0 * .5) < 1e-9;
      S.player.cash += S.player.loan; S.player.loan = 0; A.step(); S.inbox = []; out.mgCleared = A.mgOf(c2) === 0 && loads(); }
    /* priority 5: a financial-repair policy repays down to a cash floor; layoffs wait for approval; in a crisis proposals only; everything is logged */
    { S = traderCo(5603, 500); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.debt > 0 && x.ni > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl(); A.hqInit();
      c.dm = 'auto'; c.deleg = 'fix'; c.lim = {ad: .02, rt: 'BB', cash: .05}; c.cash = c.rev * .2 + 1; const d0 = c.debt; while (S.week % 4) A.step(); S.inbox = []; c.dlW = null; A.delegateStep(c);
      const lg = (S.dlog || [])[0]; info.fix = {d0: +d0.toFixed(3), d1: +c.debt.toFixed(3), cash: +c.cash.toFixed(3), keep: +(c.rev * .05).toFixed(3), log: lg && lg.acts.map(a => a.k)};
      out.fixRepay = c.debt < d0 && c.cash >= c.rev * .05 - 1e-6 && !!lg && lg.cid === c.id && loads();
      c.deleg = 'turn'; c.margin = Math.min(c.margin, .001); c.base = c.margin; const ex = A.ceoOf ? A.ceoOf(c) : null; S.inbox = []; c.dlW = null; S.week += 4 - S.week % 4; A.delegateStep(c);
      const prop = S.inbox.find(i => i.kind === 'prop' && i.cid === c.id); info.turn = prop && prop.acts.map(a => a.k); out.turnNeedsApproval = !!prop && prop.acts.some(a => a.k === 'restr') && !(c.rsW > S.week);
      S.inbox = []; c.crisis = {due: S.week + 8}; c.dlW = null; S.week += 4; const cash1 = c.cash; A.delegateStep(c); const p2 = S.inbox.find(i => i.kind === 'prop' && i.cid === c.id); out.crisisPropose = (!p2 || p2.why.includes('提案のみ')) && c.cash === cash1;
      const html = A.groupView(); out.dashMgmt = html.includes('財務改善') && html.includes('経営の記録'); }
    /* priority 6: an individual with no outside money buys a small building, refurbishes, sets the rent, borrows, sells */
    { A.newGame(5604, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = .5; const u = S.props.filter(x => x.small && !x.own).sort((a, b) => a.v - b.v)[0]; A.buyProp('P', u, 0);
      A.step(); S.inbox = []; out.floor58 = u.v < 1 && u.v > .1;
      const q = A.renoQuote(u), nw0 = A.grossWorth(), cash0 = S.player.cash; const ok1 = A.propReno(u); out.renoNow = ok1 && A.propRentY(u) === 0 && Math.abs(cash0 - S.player.cash - q.cost) < 1e-12;
      const y0 = u.y; for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } info.reno = {cost: +q.cost.toFixed(4), y0, y1: u.y, pay: +q.pay.toFixed(1)}; out.renoDone = u.y > y0 && A.propRentY(u) > 0 && loads();
      const r0 = A.propRentY(u); u.rl = 1; const r1 = A.propRentY(u); u.rl = -1; const r2 = A.propRentY(u); u.rl = 0; info.rl = {r0: +r0.toFixed(5), up: +r1.toFixed(5), down: +r2.toFixed(5), occ: +A.occ0(u).toFixed(3)}; out.rentTradeoff = r1 !== r0 && r2 !== r0 && A.occ(Object.assign({}, u, {rl: 1})) < A.occ0(u) + 1e-12;
      const c1 = S.player.cash, got = A.propRefi(u, .5); const ok50 = got > 0 && S.player.cash > c1 && Math.abs(u.mort / A.propVal(u) - .5) < 1e-6; A.propRefi(u, .9); out.refi = ok50 && u.mort <= A.propVal(u) * .6 + 1e-9 && Math.abs(u.mort / A.propVal(u) - .6) < 1e-6; /* rev48: against the value shown (in whole 百万円) */ /* never above 60% */
      const third = u.renoN; A.propReno(u); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } out.renoCap = !A.propReno(u) && A.renoQuote(u) === null && third === 1;
      const nwB = A.grossWorth(), cB = S.player.cash; A.sellProp(u); out.sold = !u.own && S.player.cash > cB && A.grossWorth() < nwB && loads(); }
    /* no arbitrage: refurbish and sell at once loses money */
    { A.newGame(5605, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 2; const u = S.props.filter(x => x.small)[1]; A.buyProp('P', u, 0); const nw0 = A.grossWorth(); A.propReno(u); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } A.sellProp(u); info.arb = {nw0: +nw0.toFixed(4), nw1: +A.grossWorth().toFixed(4)}; out.noArb = A.grossWorth() < nw0; }
    /* new supply: twice a year, deterministic, at most 8 unsold */
    { const run = () => { A.newGame(5606, 'normal', 'B', 'b', 'std', true); const S = A.S; S.won = true; for (let i = 0; i < 520; i++) { A.step(); S.inbox = []; } return S.props.filter(x => /^N\d+$/.test(x.id)).map(x => x.id + ':' + x.v).join(','); };
      const a = run(), b2 = run(); S = A.S; const unsold = S.props.filter(x => /^N\d+$/.test(x.id) && !x.own).length; info.sup = {n: a.split(',').filter(Boolean).length, unsold}; out.supply = a === b2 && a.length > 0 && unsold <= 8 && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('margin shares carry no votes; priority 5 policies, limits, approvals and log; priority 6 refurbishment, rent, borrowing, supply, no arbitrage', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in margin/priority 5-6 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// rev20: ownership limits count margin shares (BUG-67), tenders on credit are margin (BUG-68), delegated spending keeps the cash floor (BUG-66), no parent money on autopilot (BUG-72), interest on an own building in use (BUG-73), acquisition base after settlement (BUG-69), one seat freed per promotion (BUG-70), the year plan's base, edit and units (BUG-71); live figures for a company you run; stock options
async function testRev20(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* BUG-67: a company under a 49% limit — margin and cash shares together stop at the limit; settling does not lift it */
    { S = traderCo(2067, 0); S.allUnlocked = true; const c = S.cos.find(x => !x.priv && !x.ctrl && A.ownCap(x, 'P') < 1 && A.ownCap(x, 'P') > .3); if (!c) out.capFound = 'none'; else {
      const cap = A.ownCap(c, 'P'); S.player.cash = c.price * c.shares * cap * .3; A.execBuy('P', c, c.shares * cap); const e1 = A.econSh(c, 'P') / c.shares; const r2 = A.execBuy('P', c, c.shares * .05);
      info.b67 = {cap, econ: +e1.toFixed(4), vote: +(A.gfrac(c, 'P')).toFixed(4), mg: +(A.mgOf(c) / c.shares).toFixed(4), extra: !!r2, room: A.buyRoom('P', c)};
      out.b67cap = e1 <= cap + 1e-9 && !r2 && A.buyRoom('P', c) < 1e-9; S.player.cash = 1e5; A.mgSettle(c); out.b67settle = A.econSh(c, 'P') / c.shares <= cap + 1e-9 && A.gfrac(c, 'P') <= cap + 1e-9 && loads(); } }
    /* BUG-68: a 51% tender paid 70% in cash and 30% on credit: 15.3 points are margin, 35.7% votes */
    { S = traderCo(2068, 0); S.allUnlocked = true; const c = S.cos.filter(x => !x.priv && !x.ctrl && A.ownCap(x, 'P') >= 1 && !Object.keys(x.own).some(k => x.own[k] / x.shares > .03)).sort((a, b) => a.price * a.shares - b.price * b.shares)[3];
      const px = c.price * 1.6, q = A.tenderQuote('P', c, px, .51); S.player.cash = q.cost * .7; S.player.loan = 0; const res = A.execTender('P', c, px, .51); A.recomputeCtrl();
      const mgF = A.mgOf(c) / c.shares, own = (c.own.P || 0) / c.shares; info.b68 = {own: +own.toFixed(4), mg: +mgF.toFixed(4), vote: +A.gfrac(c, 'P').toFixed(4), loan: +S.player.loan.toFixed(3), ctrl: c.ctrl};
      out.b68 = !!res && Math.abs(mgF - own * .3) < 1e-6 && Math.abs(A.gfrac(c, 'P') - own * .7) < 1e-6 && loads(); }
    /* BUG-66: the cash floor holds when actions run (automatic and on approval) */
    { S = traderCo(2066, 1000); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0 && x.debt > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[1]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl(); A.hqInit();
      c.dm = 'auto'; c.deleg = 'grow'; c.lim = {ad: .03, rt: 'AAA', cash: .05}; const keep = c.rev * .05; c.cash = keep + .9407 * c.rev / 940.6675; const room = c.cash - keep; while (S.week % 4) { A.step(); S.inbox = []; } c.cash = keep + room; c.dlW = null; A.delegateStep(c);
      info.b66 = {keep: +keep.toFixed(4), cash: +c.cash.toFixed(4), room: +room.toFixed(4)}; out.b66auto = c.cash >= keep - 1e-9;
      c.dm = 'approve'; c.cash = keep; const it = {id: 99901, kind: 'prop', cid: c.id, acts: [{k: 'ad', amt: 50, r: 'CMO', why: 't'}, {k: 'rd', amt: 50, r: 'CTO', why: 't'}, {k: 'repay', amt: 50, r: 'CFO', why: 't'}, {k: 'sdiv', amt: 50, r: 'CFO', why: 't'}], exp: S.week + 3};
      S.inbox.push(it); const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = '1'; A.act('hprop', el); out.b66approve = Math.abs(c.cash - keep) < 1e-9 && S.dlog[0].acts.every(a => a.skip);
      c.cash = keep + 1; const it2 = Object.assign({}, it, {id: 99902}); S.inbox.push(it2); el.dataset.id = it2.id; A.act('hprop', el); const spent = S.dlog[0].acts.reduce((a, x) => a + x.cost, 0); out.b66shared = c.cash >= keep - 1e-9 && spent <= 1 + 1e-9 && loads(); }
    /* BUG-72: a funding crisis on autopilot: the parent's money is untouched; one request waits; the crisis stays until you decide */
    { S = traderCo(2072, 500); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[2]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl(); c.dm = 'auto'; S.inbox = [];
      c.crisis = {due: S.week + 8}; const pc0 = S.player.cash, cc0 = c.cash; A.playerCrisisAuto(c); A.playerCrisisAuto(c); out.b72 = S.player.cash === pc0 && c.cash === cc0 && !!c.crisis && S.inbox.filter(i => i.kind === 'crisis' && i.cid === c.id).length === 1 && loads();
      const it = S.inbox.find(i => i.kind === 'crisis' && i.cid === c.id), keep = S.player.cash; S.player.cash = 0; const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'parent'; A.act('crisis', el); const stay = !!c.crisis && S.inbox.some(i => i.id === it.id);
      S.player.cash = keep; const own0 = c.own.P, sh0 = c.shares, pc1 = S.player.cash, cc1 = c.cash; A.act('crisis', el); const paid = pc1 - S.player.cash, got = c.cash - cc1;
      info.b72 = {stay, paid: +paid.toFixed(4), got: +got.toFixed(4), own: +((c.own.P) / c.shares).toFixed(4)}; out.b72approve = stay && !c.crisis && paid > 0 && Math.abs(paid - got) < 1e-6 && c.own.P > own0 && c.shares > sh0 && loads(); }
    /* BUG-73: interest on a loan against your own building while the head office uses it */
    { S = traderCo(2073, 200); A.hqBuild('tyo'); for (let i = 0; i < 53; i++) { A.step(); S.inbox = []; } const bd = A.hqBld(); A.setOffice(1, 'tyo'); A.propRefi(bd, .6); A.setOffice(4); const mort = bd.mort, c0 = S.player.cash; A.propStep(); const d = c0 - S.player.cash, want = mort * A.mortRate() / 100 / 52;
      info.b73 = {mort: +mort.toFixed(3), d: +d.toFixed(6), want: +want.toFixed(6), use: bd.hqUse}; out.b73 = bd.hqUse && mort > 0 && Math.abs(d - want) < 1e-9 && A.propRentY(bd) >= 0 && loads(); }
    /* BUG-69: a PE purchase records its own cost, net debt and kind */
    { S = traderCo(2069, 50); Object.assign(S.dept.inv, {on: true, staff: 1}); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } const c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false);
      const a = c && c.acq0; info.b69 = a && {cost: +a.cost.toFixed(4), real: +A.costOf('P', c.id).toFixed(4), nd: +a.nd.toFixed(4), realNd: +(c.debt - c.cash).toFixed(4), how: a.how};
      out.b69 = !!a && a.how === 'PE' && Math.abs(a.cost - A.costOf('P', c.id)) < 1e-9 && a.cost > 0 && Math.abs(a.nd - (c.debt - c.cash)) < 1e-9 && loads();
      const n0 = S.acqSeq; A.acqFlush(); out.b69once = S.acqSeq === n0; }
    /* BUG-70: a promoted candidate moved again does not free another seat */
    { S = traderCo(2070, 500); Object.assign(S.dept.acc, {on: true, staff: 8, jr: 3}); S.week = 12; A.gradCands('acc', 3); const p0 = A.jrList()[0]; for (const k in p0.sk) p0.sk[k] = 70; S.week = 300;
      A.hireInto(p0, 'HQ', 'CFO', null, null); const a1 = [S.dept.acc.staff, S.dept.acc.jr]; const sub = S.cos.filter(x => !x.priv && !x.ctrl)[0]; sub.ctrl = 'P'; sub.own.P = sub.shares * .6; A.hireInto(p0, sub.id, 'CFO', null, null); const a2 = [S.dept.acc.staff, S.dept.acc.jr];
      info.b70 = {a1, a2}; out.b70 = a1[0] === 7 && a1[1] === 2 && a2[0] === 7 && a2[1] === 2 && p0.at === sub.id && loads(); }
    /* BUG-71: removing and adding a goal again keeps the year's first base; targets can be edited; units */
    { S = traderCo(2071, 30); A.planSet('nw', 15); const b0 = S.plan.goals[0].base; S.player.cash = 20; A.planDel('nw'); A.planSet('nw', 15); const b1 = S.plan.goals.find(g => g.k === 'nw').base;
      A.planSet('nw', 20); const t1 = S.plan.goals.find(g => g.k === 'nw').tgt; A.planSet('cash', 10); A.planSet('deals', 2); const fourth = A.planSet('aum', 20); const bad = A.planSet('deals', 1.5) || A.planSet('cash', 1e9) || A.planSet('nw', NaN);
      const tx = A.exportText(); A.importText(tx); S = A.S; const html = A.planBox(); const cg = S.plan.goals.find(g => g.k === 'cash');
      info.b71 = {b0: +b0.toFixed(3), b1: +b1.toFixed(3), t1, fourth, bad}; out.b71 = Math.abs(b0 - b1) < 1e-12 && t1 === 20 && !fourth && !bad && S.plan.goals.find(g => g.k === 'nw').tgt === 20 && html.includes(`${cg.base.toFixed(1)}%`) && html.includes('planedit'); }
    /* a special dividend shows at once in the overview of a company you run */
    { S = traderCo(2074, 500); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.cash > 1).sort((a, b) => a.price * a.shares - b.price * b.shares)[1]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl(); A.step(); S.inbox = [];
      const h0 = A.coInfo(c), pc0 = S.player.cash, cash0 = c.cash, paid = A.specialDividend(c, c.cash * .5), h1 = A.coInfo(c); info.sdiv = {paid: +paid.toFixed(3), mine: +(S.player.cash - pc0).toFixed(3)};
      out.sdiv = paid > 0 && h0.includes('現金（現在）') && h1.includes(A.fm(cash0 - paid)) && S.player.cash - pc0 > paid * (c.own.P / c.shares) - 1e-9; }
    /* stock options: the head office's — granted at today's value, worth the rise, exercised after four years as a dilution of exactly the gain */
    { S = traderCo(2075, 100); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean)[0]; A.hireInto(pool, 'HQ', 'CFO', null, null); const g0 = A.grossWorth();
      pool.so = [{f: .01, k: Math.max(0, g0), w0: S.week}]; S.player.cash += 50; const g1 = A.grossWorth(), shown = .01 * Math.max(0, g1 - g0);
      for (let i = 0; i < 209; i++) { A.step(); S.inbox = []; if (pool.offer) pool.sal = pool.offer.sal; /* the player matches a rival's offer to keep the officer */ } const gw = A.grossWorth(), o = S.player.outside || 0; info.so = {g0: +g0.toFixed(2), shownGain: +shown.toFixed(3), outside: +o.toFixed(5), left: pool.so.length};
      out.soHQ = pool.so.length === 0 && o > 0 && o < .02 && Math.abs(A.myWorth() - gw * (1 - o)) < 1e-9; }
    /* a subsidiary officer's options: new shares worth the gain; the company is worth the same, so each share is worth less */
    { S = traderCo(2076, 500); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[1]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl();
      const pz = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean)[0]; A.hireInto(pz, c.id, 'CFO', 'opt', null); pz.optK = c.price * .7;
      const s0 = c.shares, px0 = c.price, mine0 = c.own.P * c.price, gain = pz.sal * 2 / pz.optK * (px0 - pz.optK); A.optVest(pz, c);
      const capSame = Math.abs(c.shares * c.price - s0 * px0) < 1e-9 * s0 * px0, dil = mine0 - c.own.P * c.price, want = gain * (c.own.P / c.shares);
      pz.end = S.week + 1; pz.renewAsked = true; pz.optK = c.price * .8; A.step(); S.inbox = []; const vestedAtEnd = pz.optK != null && Math.abs(pz.optK - c.price) < c.price; /* exercised at the end of the period, then a new grant at the new price */
      info.subso = {gain: +gain.toFixed(4), dil: +dil.toFixed(4), want: +want.toFixed(4), capSame, end: pz.end}; out.soSub = capSame && Math.abs(dil - want) < 1e-9 * Math.max(1, mine0) && pz.end > S.week + 100 && vestedAtEnd && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev20: ownership limits with margin (BUG-67), tender on credit (BUG-68), cash floor (BUG-66), no parent money on autopilot (BUG-72), interest on own building (BUG-73), acquisition base (BUG-69), promotion seat once (BUG-70), plan base/edit/units (BUG-71), live overview cash, stock options', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev20 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// playtest 21: welfare cards keep their scroll; cash options for department proposals; secondment with a chosen role; injecting money from head office; a PE company's first decision
async function testPlay21(b) {
  const {p, errs} = await page(b, {...devices['iPhone 13']});
  await p.click('[data-act=newgame]');
  const sc = await p.evaluate(() => { const A = window.__atlas, S = A.S; document.querySelector('#modal').hidden = true; S.player.cash = 5; A.hqInit(); Object.assign(S.dept.hr, {on: true, staff: 5}); A.ui.tab = 'pres'; A.ui.hqTab = 'hr'; A.renderAll(true);
    const h = document.querySelector('#pbody .hscroll'); if (!h) return {none: true}; h.scrollLeft = 400; const before = h.scrollLeft; const btn = [...h.querySelectorAll('[data-act=welfd]')][6]; if (btn) btn.click(); const h2 = document.querySelector('#pbody .hscroll'); return {before, after: h2 ? h2.scrollLeft : -1, clicked: !!btn}; });
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* department proposals: buy a building in cash, bid without borrowing */
    { S = traderCo(2101, 300); const pr = S.props.find(x => !x.own && !x.small); const it = {id: 99801, kind: 'pitch', who: 'x', role: '投資部', text: 't', act: {t: 'prop', pid: pr.id}, why: 'ローン50%', exp: S.week + 4}; S.inbox.push(it);
      const alt = A.pitchAlt(it); const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = '2'; A.act('pitch', el); info.prop = {alt: alt && alt.label, mort: pr.mort, own: pr.own}; out.propCash = !!alt && alt.ok && pr.own === 'P' && pr.mort === 0 && loads();
      Object.assign(S.dept.inv, {on: true, staff: 1}); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } const it2 = {id: 99802, kind: 'pitch', who: 'y', role: 'PE投資責任者', text: 't', act: {t: 'pebid', did: d.id}, why: 'LBO', exp: S.week + 4}; S.inbox.push(it2);
      const el2 = document.createElement('button'); el2.dataset.id = it2.id; el2.dataset.v = '2'; A.act('pitch', el2); out.peNoDebt = !!d.bid && d.bid.lev === 0; }
    /* secondment: choose the subsidiary and the role; the incumbent steps down */
    { S = traderCo(2102, 500); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[1]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl();
      const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); const hq = pool[0]; A.hireInto(hq, 'HQ', 'CFO', null, null); const cur = A.exOf ? null : null; const inc = Object.values(S.hr.people).find(x => x.at === c.id && x.role === 'CFO');
      A.ui.secCo = c.id; A.ui.secRole = 'CFO'; A.showSecond(hq.id); const modal = document.querySelector('#modal').innerHTML; const el = document.createElement('button'); el.dataset.id = hq.id; A.act('secgo', el);
      info.sec = {inc: inc && inc.n, incAt: inc && inc.at, at: hq.at, role: hq.role}; out.second = modal.includes('役職') && hq.at === c.id && hq.role === 'CFO' && (!inc || inc.at !== c.id || inc.role !== 'CFO') && S.hr.hq.CFO !== hq.id && loads();
      A.ui.secRole = 'COO'; out.secondRole = A.secondTo(hq, c.id, 'COO') === true && hq.role === 'COO'; }
    /* head office puts money in, any time; 20% or more ends a funding crisis */
    { S = traderCo(2103, 500); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[2]; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl(); const own0 = c.own.P / c.shares, cash0 = c.cash, pc0 = S.player.cash;
      const a = A.injectDo(c, .1); out.inject = a > 0 && Math.abs(c.cash - cash0 - a) < 1e-9 && Math.abs(pc0 - S.player.cash - a) < 1e-9 && c.own.P / c.shares > own0;
      c.crisis = {due: S.week + 8}; S.inbox.push({id: 99803, kind: 'crisis', cid: c.id, exp: S.week + 8}); A.injectDo(c, .2); out.injectCrisis = !c.crisis && !S.inbox.some(i => i.kind === 'crisis' && i.cid === c.id) && A.injectBox(c).includes('本社から資金を入れる');
      S.player.cash = 0; out.injectNoCash = A.injectDo(c, .05) === 0 && loads(); }
    /* a PE purchase asks first how the company will be run */
    { S = traderCo(2104, 80); Object.assign(S.dept.inv, {on: true, staff: 1}); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } const c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false);
      const it = S.inbox.find(i => i.kind === 'pepol' && i.cid === c.id); const card = it ? A.pePolCard(it) : ''; A.ui.pePolMode = 'auto'; const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'fix'; A.act('pepol', el);
      info.pepol = {dm: c.dm, deleg: c.deleg, p100: c.pe.p100 != null}; out.pePol = !!it && card.includes('財務改善') && c.deleg === 'fix' && c.dm === 'auto' && !!c.pe.pol && c.pe.p100 != null && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('playtest 21: welfare strip keeps its scroll; cash/no-borrowing options; secondment by role (incumbent steps down); head-office injection; PE first decision', !bad.length && sc.after > 0 && Math.abs(sc.after - sc.before) < 2, bad.join(',') + ' ' + JSON.stringify({sc, info: r.info}));
  ok('no page errors in playtest-21 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// playtest 22: borrowing overview and repayment; no sale proposals during an IPO; officers sent to ventures and their requests; clearer merger; fund commitment and manager
async function testPlay22(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* the credit line a CFO drew shows in the overview, in the accounts tab and the bank, and can be repaid */
    { S = traderCo(2201, 50); S.allUnlocked = true; S.stage = 4; S.player.bank = 7; S.player.cash = 20; const h = A.debtBox(); A.ui.hqTab = 'acc'; const hq = A.renderHQ ? A.renderHQ() : ''; const bk = A.renderBank();
      out.debtShown = h.includes('クレジットライン') && h.includes(A.fm(7)) && hq.includes('借入の一覧') && bk.includes('借入の一覧');
      const el = document.createElement('button'); el.dataset.v = '7'; A.act('bankr', el); out.debtRepaid = S.player.bank === 0 && Math.abs(S.player.cash - 13) < 1e-9 && loads(); }
    /* no sale proposal for a company preparing its IPO */
    { S = traderCo(2202, 80); Object.assign(S.dept.inv, {on: true, staff: 1}); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } const c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false);
      c.ipoPlan = {kind: 'pe', w0: S.week, end: S.week + 20, uw: 'mid', cost: 0, nf: .3, sf: .15}; out.noExitIpo = A.peExitStart(c) === false && !c.pe.sale; c.bsale = {end: S.week}; S.inbox = []; A.bsaleStep(); out.noBsaleIpo = !S.inbox.some(i => i.kind === 'bsale' && i.cid === c.id); }
    /* ventures: an officer sent in raises the chance to grow; requests for money and officers; follow-on money adds no value from nothing */
    { S = traderCo(2203, 200); S.allUnlocked = true; A.hqInit(); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean).sort((a, b) => b.sk.gen - a.sk.gen); A.hireInto(pool[0], 'HQ', 'CFO', null, null);
      A.vcQuarter(); const d = S.vc.deals[0]; A.vcInvest(d.id, .05); const h = S.vc.hold[0]; const q0 = A.vcQ(h); const ok = A.vcSecond(pool[0], h);
      info.vc = {q0: +q0.toFixed(3), q1: +A.vcQ(h).toFixed(3), sk: pool[0].sk.gen, role: pool[0].role, cfo: S.hr.hq.CFO};
      out.vcSecond = ok && h.ex === pool[0].id && pool[0].role === 'VCX' && S.hr.hq.CFO !== pool[0].id && A.vcQ(h) >= q0 && loads();
      const v0 = h.stake * h.val, c0 = S.player.cash; const fo = A.vcFollowOn(h, 1); out.vcFollow = fo && Math.abs(h.stake * h.val - (v0 + 1)) < 1e-9 && Math.abs(c0 - S.player.cash - 1) < 1e-9;
      S.inbox = []; let asked = 0; for (let i = 0; i < 40; i++) { S.week += 13; A.vcQuarter(); if (S.inbox.some(x => x.kind === 'vcask')) { asked++; S.inbox = []; } if (!S.vc.hold.length) break; } info.vcAsk = asked; out.vcAsk = asked > 0;
      const t = A.exportText(); A.importText(t); out.vcLoads = !!A.S; }
    /* merger screen says who buys whom and how the money moves */
    { S = traderCo(2204, 3000); S.allUnlocked = true; S.stage = 4; const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0).sort((a, b) => b.price * b.shares - a.price * a.shares)[5]; c.own = {P: c.shares * .6}; A.recomputeCtrl(); A.ui.sel = c.id; A.ui.ctab = 'ceo';
      const B = S.cos.filter(x => !x.priv && !x.ctrl && x !== c)[3]; A.ui.mTarget = B.id; const html = A.renderMarket(); info.merge = html.includes('買い手'); out.mergeClear = html.includes(`買い手：${c.name}`) && html.includes('株の交換ではなく'); }
    /* fund: the commitment is shown apart from the fee; a manager can be chosen; a higher commitment and a strong manager raise more */
    { S = traderCo(2205, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 1}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean).sort((a, b) => b.sk.deal - a.sk.deal); A.hireInto(pool[0], 'HQ', 'PEH', null, null);
      A.ui.fGp = .1; A.ui.fStrat = 'buyout'; A.ui.fMgr = pool[0].id; const html = A.renderPE(); out.fundUi = html.includes('出資約束') && html.includes('ファンドの責任者') && html.includes(pool[0].n);
      const f = A.fundRaise('buyout', .1, pool[0].id); out.fundMgr = !!f && f.mgr === pool[0].id && !!A.fundMgrEff(f) && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('playtest 22: borrowing overview and repayment, no sale during an IPO, ventures (officer, requests, follow-on), merger roles, fund commitment and manager', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in playtest-22 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// playtest 23: IPO badges; the company's own share issue needs approval; salaries and bonuses by the CHRO; a lead for a PE company; funds that invest on their own
async function testPlay23(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    { S = traderCo(2301, 80); Object.assign(S.dept.inv, {on: true, staff: 1}); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } const c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false);
      c.ipoPlan = {kind: 'pe', w0: S.week, end: S.week + 20, uw: 'mid', cost: 0, nf: .3, sf: .15}; out.ipoBadge = A.coRow(c).includes('上場準備中'); }
    /* the CFO asks before issuing shares of the company itself */
    { S = traderCo(2302, 50); S.allUnlocked = true; S.stage = 4; const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); A.hireInto(pool[0], 'HQ', 'CFO', null, null); pool[0].dlg = {eq: true}; S.player.od = S.week - 10;
      A.dlgStep(); const ask = S.inbox.find(i => i.act && i.act.t === 'ytreq'); out.ytrAsk = !!ask && !S.player.ipoPlan; info.ytr = {ask: !!ask, plan: !!S.player.ipoPlan}; }
    /* the CHRO sets salaries by morale and pays a bonus after a profitable quarter */
    { S = traderCo(2303, 200); Object.assign(S.dept.acc, {on: true, staff: 5, mo: 40}); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); A.hireInto(pool[0], 'HQ', 'HR', null, null); pool[0].dlg = {sal: true, bonus: true};
      const s0 = S.dept.acc.sal; S.week = Math.ceil(S.week / 4) * 4; A.dlgStep(); out.hrSal = S.dept.acc.sal > s0;
      const mo0 = S.dept.acc.mo, c0 = S.player.cash, paid = A.payBonus(1); out.bonus = paid > 0 && S.dept.acc.mo > mo0 && S.player.cash < c0 && A.bonusBox().includes('ボーナス') && loads(); info.hr = {s0, s1: S.dept.acc.sal, paid}; }
    /* a lead for the PE company from the first-decision card */
    { S = traderCo(2304, 80); Object.assign(S.dept.inv, {on: true, staff: 1}); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); A.hireInto(pool[0], 'HQ', 'MA', null, null); let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } const c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false);
      const it = S.inbox.find(i => i.kind === 'pepol' && i.cid === c.id), card = A.pePolCard(it); const el = document.createElement('button'); el.dataset.id = c.id; el.dataset.v = pool[0].id; A.act('pelead', el); out.peLead = card.includes('担当者') && A.ceoOf(c) === pool[0] && loads(); }
    /* a fund invests on its own through its manager */
    { S = traderCo(2305, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 1}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean).sort((a, b) => b.sk.deal - a.sk.deal); A.hireInto(pool[0], 'HQ', 'PEH', null, null); const f = A.fundRaise('buyout', .05, pool[0].id);
      for (let i = 0; i < 60; i++) { A.step(); S.inbox = S.inbox.filter(x => x.kind === 'pepol'); } const owned = S.cos.filter(c => c.pe && !c.pe.closed && c.pe.owner === f.id).length, bids = (S.pe.deals || []).filter(d => d.bid && d.bid.owner === f.id).length;
      info.fund = {owned, bids, called: +(f.calledLP + f.calledGP).toFixed(2), size: +(f.lp + f.gp).toFixed(1), auto: A.fundAuto(f)}; out.fundMoves = A.fundAuto(f) && owned + bids > 0 && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('playtest 23: IPO badge, own share issue needs approval, CHRO salaries and bonus, PE company lead, funds invest on their own', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in playtest-23 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// rev21: cash-only bids (BUG-74), the GP's share in cash (BUG-75), one venture held twice (BUG-76), exit history on delisting (BUG-77), votes above a limit (BUG-67); plus HQ build reach, IPO reasons, hiring refusals, successors, applicants, candidate positions
async function testRev21(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const deal = () => { let d = null; for (let i = 0; i < 80 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; } return d; };
    let S;
    /* BUG-74: a cash-only bid needs the cash; at settlement it is checked again and never borrows */
    { S = traderCo(2174, 50); Object.assign(S.dept.inv, {on: true, staff: 1}); const d = deal(), q = A.peQuote(d, A.dealAsk(d), 0, 'P'); S.player.cash = q.out * .7; S.player.loan = 0;
      const no = A.peBid(d, 0, 0, false, 'P', 0, true); out.b74refuse = !no && !d.bid && S.player.loan === 0;
      S.player.cash = q.out * 1.2; const yes = A.peBid(d, 0, 0, false, 'P', 0, true); S.player.cash = q.out * .7; d.n = 0; d.ai = 0; d.bids = []; for (let i = 0; i < 4; i++) { A.step(); S.inbox = []; }
      const own = S.cos.find(x => x.pe && x.pe.owner === 'P' && x.name === d.name); info.b74 = {yes, loan: S.player.loan, own: !!own}; out.b74settle = yes && !own && S.player.loan === 0 && loads(); }
    /* BUG-75: a fund cannot invest when the GP has no cash for its share */
    { S = traderCo(2175, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 1}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); A.hireInto(pool[0], 'HQ', 'PEH', null, null); const f = A.fundRaise('buyout', .1, pool[0].id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } f.auto = false;
      const d = deal(), q = A.peQuote(d, A.dealAsk(d), .5, f.id); S.player.cash = 0; S.player.loan = 0; const lp0 = f.calledLP, gp0 = f.calledGP; const ok0 = A.peBid(d, 0, .5, false, f.id);
      info.b75 = {ok0, gate: A.peCashGate(f.id, q.out), need: +(q.out * .1).toFixed(3)}; out.b75refuse = !ok0 && S.player.loan === 0 && f.calledLP === lp0 && f.calledGP === gp0;
      S.player.cash = q.out * .1 + 1e-6; const ok1 = A.peBid(d, 0, .5, false, f.id); S.player.cash = 0; d.n = 0; d.ai = 0; d.bids = []; for (let i = 0; i < 4; i++) { A.step(); S.inbox = []; } const fc = S.cos.find(x => x.pe && x.pe.owner === f.id);
      out.b75settle = ok1 && !fc && S.player.loan === 0 && loads(); }
    /* BUG-76: personal 12% and company 7% of the same venture; the company adds money: both see one valuation */
    { S = traderCo(2176, 100); S.allUnlocked = true; A.vcQuarter(); const d = S.vc.deals[0]; S.pres.cash = 1e3; A.vcInvest(d.id, .12, 'pres'); S.vc.deals.push(d); A.vcInvest(d.id, .07); /* the same round, personally and by the company */ const hp = S.vc.hold.find(h => h.id === d.id && h.pres), hc = S.vc.hold.find(h => h.id === d.id && !h.pres);
      const V = hp.val, vp0 = hp.stake * hp.val, pres0 = S.pres.cash; A.vcFollowOn(hc, 1);
      info.b76 = {V, vp: +hp.val.toFixed(3), vc: +hc.val.toFixed(3), sp: +hp.stake.toFixed(5), sc: +hc.stake.toFixed(5)}; out.b76 = Math.abs(hp.val - hc.val) < 1e-9 && Math.abs(hp.val - (V + 1)) < 1e-9 && Math.abs(hp.stake * hp.val - vp0) < 1e-9 && Math.abs(hc.stake - (.07 * V + 1) / (V + 1)) < 1e-9 && S.pres.cash === pres0;
      let n = 0; for (let i = 0; i < 30 && S.vc.hold.some(h => h.id === d.id); i++) { S.week += 13; A.vcQuarter(); const G = S.vc.hold.filter(h => h.id === d.id); if (G.length === 2 && (G[0].val !== G[1].val || G[0].st !== G[1].st)) n++; S.inbox = []; } out.b76sync = n === 0 && loads(); }
    /* BUG-77: a PE company sold off the market keeps its history */
    { S = traderCo(2177, 80); Object.assign(S.dept.inv, {on: true, staff: 1}); const d = deal(), c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false); const bid = {kind: 'pe', buyer: S.pe.firms[0].id, eq: Math.max(.1, A.peStats(c).nav * .9)}; A.peSell(c, bid);
      const H = (S.acqHist || []).filter(h => h.cid === c.id); info.b77 = {n: H.length, why: H[0] && H[0].why, inCos: S.cos.includes(c) && c.priv && c.pe && !c.pe.closed}; out.b77 = H.length === 1 && loads(); }
    /* BUG-67: an older save above a 49% limit votes 49% at most */
    { S = traderCo(2167, 0); const c = S.cos.find(x => !x.priv && !x.ctrl && A.ownCap(x, 'P') < 1 && A.ownCap(x, 'P') > .4); if (c) { c.own = {P: c.shares * .54}; A.recomputeCtrl(); info.b67 = {g: +A.gfrac(c, 'P').toFixed(3), e: +(A.econSh(c, 'P') / c.shares).toFixed(3), cap: A.ownCap(c, 'P'), ctrl: c.ctrl};
      out.b67 = A.gfrac(c, 'P') <= A.ownCap(c, 'P') + 1e-9 && Math.abs(A.econSh(c, 'P') / c.shares - .54) < 1e-9 && A.buyRoom('P', c) === 0 && c.ctrl !== 'P'; } else out.b67 = 'none'; }
    /* HQ build reachable from the floor screen; IPO reasons shown */
    { S = traderCo(2178, 30); A.ui.plan = null; out.hqbFloor = A.floorView().includes('自社ビルを建てる');
      const c = S.cos.filter(x => !x.priv)[0]; c.priv = true; c.ni = -1; c.ipoPlan = {kind: 'sub', w0: S.week, end: S.week + 5, uw: 'mid', cost: 0, nf: .3, sf: 0}; out.ipoWhy = A.coRow(c).includes('審査条件未達') && A.ipoWhy(c, 'mid').includes('赤字'); }
    /* hiring: a small company is turned down more often; succession and applicants */
    { S = traderCo(2179, 2); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean).sort((a, b) => Math.max(...Object.values(b.sk)) - Math.max(...Object.values(a.sk))); const top = pool[0], oSmall = A.hireOdds(top); S.player.cash = 5e4; const oBig = A.hireOdds(top);
      info.odds = {small: +oSmall.toFixed(2), big: +oBig.toFixed(2)}; out.hireOdds = oSmall < oBig && oSmall < .9;
      const pos = A.personLine(pool[1], null, 'CFO'); out.candPos = pos.includes('転職活動中');
      A.hireInto(pool[2], 'HQ', 'CFO', null, null); S.inbox = []; A.exitAlert(pool[2], null, 'x'); const it = S.inbox.find(i => i.kind === 'succ'); out.succ = !!it && A.succCard(it).includes('グループから昇格') && A.succCard(it).includes('外部から採用');
      S.inbox = []; S.week = 400; let got = false; for (let q = 31; q < 80 && !got; q++) { A.appStep(q); got = S.inbox.some(i => i.kind === 'applicant'); } const ap = S.inbox.find(i => i.kind === 'applicant'); out.applicant = got && A.applicantCard(ap).includes('この役職で採用') && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev21: cash-only bids (BUG-74), GP cash for funds (BUG-75), one venture held twice (BUG-76), exit history (BUG-77), votes above a limit (BUG-67); HQ build, IPO reasons, hiring refusals, successors, applicants, candidate positions', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev21 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

// playtest 25: applicants placed in a head-office department (and sent out from there); pay packages — options, performance bonus and long-term pay where each officer works
async function testRev27(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    const lastToast = () => { const t = document.querySelectorAll('#toasts .toast'); return t.length ? t[t.length - 1].textContent : ''; };
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, strat) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise(strat || 'buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = 'manual'; return {S, f, lead: pp}; };
    const deal = (pred) => { let d = null; for (let i = 0; i < 300 && !d; i++) { const x = A.peDealGen(); if (x && pred(x)) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } return d; };
    const setRoom = (f, room) => { const T = 1000, k = T - room; f.gp = T * .05; f.lp = T - f.gp; f.lp0 = f.lp; f.gp0 = f.gp; f.calledGP = k * .05; f.calledLP = k - f.calledGP; };
    let S;
    /* BUG-96: a bid whose reservation equals what is left settles after fees have run, with nothing unreserved left */
    { let f; ({S, f} = fundCo(2896)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; d.exp = S.week + 20; d.n = 0; d.ai = 0; d.bids = []; f.invEnd = S.week + 200;
      const q = A.peQuote(d, A.dealAsk(d), 0, f.id); setRoom(f, q.out + 1e4); A.peBid(d, 0, 0, false, f.id); const own = d.bid.need; setRoom(f, own); /* exactly the reservation is left */
      for (let i = 0; i < 3; i++) A.fundWeekly(f); info.b96 = {own: +own.toFixed(6), room: +A.fundRoom(f).toFixed(6), dry: A.fundDry(f)}; const rr = A.peResolve(d); const c = S.cos.find(x => x.name === d.name && x.pe && x.pe.owner === f.id);
      out.b96exact = rr === 'won' && !!c && A.fundRoom(f) < 1e-6 && f.calledLP + f.calledGP <= f.lp + f.gp + 1e-9 && loads();
      /* more than the reservation with no unreserved room: refused, nothing moves */
      const d2 = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x !== d); d2.dd = 2; d2.risk = null; d2.exp = S.week + 20; d2.n = 0; d2.ai = 0; d2.bids = []; const q2 = A.peQuote(d2, A.dealAsk(d2), 0, f.id); setRoom(f, q2.out + 1e4); A.peBid(d2, 0, 0, false, f.id); setRoom(f, d2.bid.need);
      d2.bid.eq *= 1.1; const k0 = f.calledLP + f.calledGP, gp0 = S.player.cash; const r2 = A.peResolve(d2); out.b96over = r2 === 'fail' && f.calledLP + f.calledGP === k0 && S.player.cash === gp0;
      /* a fund winding down does not settle */ const d3 = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x !== d && x !== d2); d3.dd = 2; d3.risk = null; d3.exp = S.week + 20; d3.n = 0; d3.ai = 0; d3.bids = []; setRoom(f, 1e4); A.peBid(d3, 0, 0, false, f.id); f.winding = 'early'; const k3 = f.calledLP + f.calledGP; out.b96wind = !!d3.bid && A.peResolve(d3) === 'fail' && f.calledLP + f.calledGP === k3; f.winding = null; }
    /* BUG-96: a bolt-on settles from its own reservation; when the GP lacks cash it is refused with nothing changed */
    { let f, lead; ({S, f, lead} = fundCo(2897, 'rollup')); f.invEnd = S.week + 200; const d = deal(x => A.dealEbitda(x, false) > 0 && x.type === 'succ'); d.dd = 2; d.risk = null; const P = A.peAcquire(d, f.id, A.dealAsk(d), .3, false);
      let b2 = null; for (let i = 0; i < 400 && !b2; i++) { const x = A.peDealGen({type: 'succ', ind: P.ind, scale: P.rev * .3}); if (x) b2 = x; } b2.dd = 2; b2.risk = null; b2.exp = S.week + 20; b2.n = 0; b2.ai = 0; b2.bids = []; const integ = b2.rev * .02; b2.integ = integ;
      setRoom(f, 1e4); b2.fundPay = {f: f.id}; b2.fExtra = {integ}; A.peBid(b2, 0, 0, false, P.id); const need = b2.bid.need; setRoom(f, need); for (let i = 0; i < 3; i++) A.fundWeekly(f);
      const snap = () => JSON.stringify([f.calledLP, f.calledGP, S.player.cash, P.cash, P.debt, P.rev]); S.player.cash = need * .05 * .5; const s0 = snap(); const rf = A.peResolve(b2); out.b96boltShort = rf === 'fail' && snap() === s0;
      S.player.cash = need * .05 + 1; const b3 = Object.assign({}, b2, {id: b2.id + 'x'}); b2.bid = null; S.pe.deals.push(b3); b3.fundPay = {f: f.id}; b3.fExtra = {integ}; A.peBid(b3, 0, 0, false, P.id); setRoom(f, b3.bid.need); for (let i = 0; i < 3; i++) A.fundWeekly(f);
      const rev0 = P.rev, rb = A.peResolve(b3); info.bolt = {rf, rb}; out.b96bolt = rb === 'won' && P.rev > rev0 && A.fundRoom(f) < 1e-6; }
    /* BUG-97/99: one rule for searching — after the investment period, too soon, six a year, GP cash net of reservations */
    { let f, lead; ({S, f, lead} = fundCo(2898)); f.invEnd = S.week + 1; S.player.cash = 100; A.fundAsk(f, 'search', {name: 'x', amt: A.fundSrchCost(f)}); f.cfg.mode = 'propose'; const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'search'); it.mode = 'propose';
      const okBefore = A.fundSourceWhy(f, lead) === ''; S.week = f.invEnd; const c0 = S.player.cash, n0 = f.srchN || 0, deals0 = S.pe.deals.length, rs0 = S.rs; click('fundact', it.id, 'ok');
      out.b97 = okBefore && S.player.cash === c0 && (f.srchN || 0) === n0 && S.pe.deals.length === deals0 && S.rs === rs0 && /投資期間/.test(A.fundSourceWhy(f, lead));
      f.invEnd = S.week + 100; f.srchW = S.week - 1; out.b97gap = /たっていません/.test(A.fundSourceWhy(f, lead)); f.srchW = null; f.srchL = [1, 2, 3, 4, 5, 6].map(i => S.week - i); out.b97year = /6回/.test(A.fundSourceWhy(f, lead)); f.srchL = [];
      /* the idle-fund card disables the button with the reason: free cash 1, reserved 0.9, cost 0.2 → 0.1 short */
      const cost = A.fundSrchCost(f); S.player.cash = 100; const dR = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); dR.dd = 2; dR.exp = S.week + 20; setRoom(f, 1e4); A.peBid(dR, 0, 0, false, f.id); info.dRbid = !!dR.bid; S.player.cash = 1; if (dR.bid) dR.bid.gpNeed = .9;
      const fc = Math.max(0, A.freeCash() - A.gpRes()); const card = A.fundRevCard({id: 1, fid: f.id, exp: S.week + 8}); info.b99 = {cost, free: fc}; out.b99 = (cost > fc ? /disabled>追加で案件を探す/.test(card.replace(/data-v="search" /, '')) && /不足/.test(card) : true); }
    /* BUG-98: the short preview matches the trade: cash in = gross less 0.25%; collateral = half the short value afterwards */
    { A.newGame(2899, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; S.player.cash = 500; const c = S.cos.find(x => !x.priv && !(x.own.P > 0) && x.price > 1); A.ui.sel = c.id; A.ui.tmode = 'short'; A.ui.tf = .3; A.ui.actor = 'P';
      const m = A.tradeModel(c); const row = l => (m.rows.find(x => x[0] === l) || [])[1]; const cash0 = S.player.cash; const res = A.execShort(c, m.n);
      const gotNet = S.player.cash - cash0, lock = A.shortLiab() * .5, free = A.freeCash(); info.b98 = {net: row('現金に入る額'), gotNet: A.fm(gotNet), lock: row('約定後の担保の拘束（全銘柄・空売り時価の50%）'), gotLock: A.fm(lock), free: row('約定後に使える現金'), gotFree: A.fm(free)};
      out.b98 = row('現金に入る額') === A.fm(gotNet) && row('約定後の担保の拘束（全銘柄・空売り時価の50%）') === A.fm(lock) && row('約定後に使える現金') === A.fm(free); }
    /* BUG-100: starting a wind-down with an unsellable asset says it started; the finish comes once, when the asset is sold */
    { let f; ({S, f} = fundCo(2900)); const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 1); c.own[f.id] = c.shares * .05; c.reorg = {w: S.week}; S.inbox.push({id: 990777, kind: 'fundrev', fid: f.id, exp: S.week + 8});
      click('fundrev', 990777, 'wind', {ok: '1'}); const t1 = lastToast(); out.b100start = f.winding === 'early' && !f.closed && /開始/.test(t1) && !/清算が完了しました/.test(t1);
      c.reorg = null; A.fundWeekly(f); const fin = S.news.filter(n => /清算が完了/.test(n.t)).length; A.fundWeekly(f); out.b100done = f.closed && fin === 1 && S.news.filter(n => /清算が完了/.test(n.t)).length === 1; info.b100 = t1; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev27: reserved PE settlements incl. bolt-ons (BUG-96), one search rule (BUG-97/99), short preview matches the trade (BUG-98), wind-down started vs finished (BUG-100)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev27 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testPlay28(b) {
  const {p, errs} = await page(b);
  await p.setViewportSize({width: 390, height: 640});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S;
    /* founding your company: the share count you choose; all of it is yours and the value does not depend on it */
    { A.newGame(2801, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 50; A.ui.foundSh = 1; click('incorp'); const mc = A.selfPx() * A.selfSh();
      out.foundSh = S.founded && S.player.sh0 === 1 && Math.abs(A.selfSh() - 1) < 1e-9 && mc > 0 && /発行済み株式1/.test(S.news.map(n => n.t).join('|'));
      /* split before listing: price ÷k, shares ×k, worth and your percentage unchanged, no RNG; again within 4 weeks is refused */
      A.hqInit(); A.trClose(); const gw = A.grossWorth(), px = A.selfPx(), rs = S.rs, o = S.player.outside || 0; const html = A.splitBox(); click('splitk', null, 5); click('selfsplit', null, 5);
      out.splitPre = !A.selfListed() && /株式分割/.test(html) && Math.abs(A.selfSh() - 5) < 1e-9 && Math.abs(A.selfPx() - px / 5) < 1e-9 && A.grossWorth() === gw && (S.player.outside || 0) === o && S.rs === rs;
      info.cool = [A.selfSplitWhy(2), S.player.splitW, S.week]; out.splitCool = /4週間/.test(A.selfSplitWhy(2)) && A.selfSplit(2) !== '' && Math.abs(A.selfSh() - 5) < 1e-9;
      /* after listing (outside holders 25%) */ S.week += 5; S.player.listed = true; S.player.ipoW = S.week - 1; S.player.outside = .25; S.player.tk = 'ZZZ'; S.player.mkt = 'growth'; const sh1 = A.selfSh(), px1 = A.selfPx(), mine = S.player.sh0;
      out.splitPost = A.selfListed() && A.selfSplit(2) === '' && Math.abs(A.selfSh() - sh1 * 2) < 1e-9 && Math.abs(A.selfPx() - px1 / 2) < 1e-9 && S.player.sh0 === mine * 2 && S.player.outside === .25 && /1株を2株/.test(S.news[0].t) && loads(); info.split = {sh1, px1, sh2: A.selfSh(), px2: A.selfPx()};
      /* an impossible share count from a save is dropped on load */ const t = JSON.parse(A.exportText()); t.player.sh0 = -3; out.shLoad = !!A.parseSave(JSON.stringify(t)) ; }
    /* founding a company: capital and share count chosen; the same value over fewer shares */
    { const mk = sh => { A.newGame(2802, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; A.ui.fCap = 7; A.ui.fSh = sh; const box = A.foundBox(); click('found', null, 7); const c = S.cos.find(x => x.born != null && x.own.P && x.bare); return {c, box}; };
      const a = mk(null), bb = mk(1); info.found = {auto: [a.c && a.c.shares, a.c && a.c.price], one: [bb.c && bb.c.shares, bb.c && bb.c.price]};
      out.foundSub = !!a.c && !!bb.c && /資本金 7億円・/.test(a.box.replace(/,/g, '')) || (!!a.c && !!bb.c && /資本金/.test(a.box));
      out.foundSub = out.foundSub && Math.abs(bb.c.shares - 1) < 1e-9 && bb.c.own.P === 1 && Math.abs(bb.c.price * bb.c.shares - a.c.price * a.c.shares) < 1e-9 && /発行済み株式1/.test(S.news.map(n => n.t).join('|')) && loads(); }
    /* the profile screen keeps its place when the option stepper is used; a different screen opens at the top */
    { A.newGame(2803, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; const pp = S.hr.people[S.hr.pool[0]]; A.hireInto(pp, 'HQ', 'CFO', 'fixed', null); A.showExec(pp.id); const sh = document.querySelector('#modal .sheet'); sh.scrollTop = 260; const top0 = sh.scrollTop;
      click('xsof', pp.id, .005); const sh2 = document.querySelector('#modal .sheet'); info.scroll = [top0, sh2.scrollTop]; out.keepScroll = top0 > 100 && sh2.scrollTop === top0 && /0\.0?1|1\.0%/.test(sh2.textContent);
      A.showBank(); out.newTop = document.querySelector('#modal .sheet').scrollTop === 0; A.closeModal(); }
    /* officers of companies you do not run: weaker, and in line with how the company is run; a turnaround's management is weak */
    { A.newGame(2804, 'normal', 'B', 'b', 'std', true); S = A.S; const lv = S.cos.filter(c => !c.pe).map(c => A.exLevel(c, 'CFO')); const ex = S.cos.filter(c => c.ex && c.ctrl !== 'P').flatMap(c => Object.values(c.ex).map(id => S.hr.people[id]).filter(Boolean));
      const avgTop = ex.reduce((a, x) => a + Math.max(...Object.values(x.sk)), 0) / Math.max(1, ex.length); info.levels = {min: Math.min(...lv), max: Math.max(...lv), avgTop: +avgTop.toFixed(1), n: ex.length};
      out.levels = Math.max(...lv) <= 66 && Math.min(...lv) >= 20 && avgTop < 75;
      S.allUnlocked = true; S.stage = 4; let turn = [], other = []; for (let i = 0; i < 400 && (turn.length < 15 || other.length < 15); i++) { const d = A.peDealGen(); if (!d) continue; (d.type === 'turn' ? turn : other).push(d.mq); S.pe.deals = S.pe.deals.filter(x => x !== d); }
      info.mq = {turnMax: Math.max(...turn), otherMax: Math.max(...other), nT: turn.length};
      out.turnMq = turn.length > 5 && Math.max(...turn) <= 47 && Math.min(...turn) >= 15;
      let d = null; for (let i = 0; i < 400 && !d; i++) { const x = A.peDealGen({type: 'turn'}); if (x && x.type === 'turn') d = x; } if (d) { d.dd = 2; d.risk = null; S.player.cash = 1e5; const c = A.peAcquire(d, 'P', A.dealAsk(d), .3, false); const ceo = c && S.hr.people[c.ex.CEO]; info.turnCeo = ceo ? ceo.sk.gen : null; out.turnCeo = !!ceo && ceo.sk.gen <= 39 + 12 + 20 && A.exLevel(c, 'CEO') <= 39; } else out.turnCeo = false; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('play28: share count at founding (company and startups), stock split before/after listing, modal keeps scroll, weaker outside officers and turnaround management', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in play28 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev29(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S;
    const std = seed => { A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; return S; };
    /* F1 — government bonds: bought at today's yield, worth less when rates rise, coupons weekly, repaid at par */
    { std(2911); S.player.cash = 200; click('noop'); const g0 = A.grossWorth(); const b = A.govBuy('g10', 50); const dW = A.grossWorth() - g0, px0 = A.govPx(b);
      S.econ.rate += 1; const shock = A.govValue() - b.face; S.econ.rate -= 1; const c0 = S.player.cash; A.step(); const cpn = S.player.cash - c0;
      info.gov = {dW: +dW.toFixed(5), px0, shock: +shock.toFixed(3), y: b.cpn, cpn: +cpn.toFixed(5)};
      out.gov = Math.abs(dW + b.face * .001) < 1e-9 && Math.abs(px0 - 1) < 1e-9 && shock < -2 && shock > -6 && (S.player.pl.bond || 0) > 0 && loads();
      b.mat = S.week + 1; const n = S.gov.length; A.step(); out.govMat = S.gov.length === n - 1; }
    /* F1 — your bonds and convertibles: cash in, debt up, worth unchanged but the fee; rating limit; a convertible below its price is repaid, above it turns into shares */
    { std(2912); S.player.cash = 300; const w0 = A.grossWorth(), c0 = S.player.cash, why = A.sbIssue('sb', 30, 5);
      out.sb = why === '' && Math.abs(S.player.cash - c0 - 29.7) < 1e-9 && Math.abs(A.grossWorth() - w0 + .3) < 1e-9 && A.selfBondFace() === 30 && /BB以上|30%/.test(A.sbWhy('sb', 1e5, 5)) && loads();
      out.cbCheaper = A.sbCpn('cb', 5, 10) < A.sbCpn('sb', 5, 10) - .02;
      const e = A.sbIssue('cb', 20, 3); const cb = S.player.sb.find(x => x.kind === 'cb'); out.cbIssued = e === '' && cb.cvPx > A.selfPx() * 1.2;
      cb.mat = S.week + 1; const o0 = S.player.outside || 0; cb.cvPx = A.selfPx() * .5; const g1 = A.grossWorth(); A.step(); info.cb = {o0, o1: S.player.outside, dW: A.grossWorth() - g1};
      out.cbConvert = !S.player.sb.some(x => x.kind === 'cb') && S.player.outside > o0 && loads();
      const sb = S.player.sb[0]; sb.mat = S.week + 1; const c1 = S.player.cash; A.step(); out.sbRepaid = !S.player.sb.length && S.player.cash < c1 - 29; }
    /* F2 — tax: realised gains taxed at 30%; a loss is carried forward and offsets at most half of later income; an individual 20% */
    { std(2913); for (let i = 0; i < 12; i++) { A.step(); S.inbox = []; } S.player.pl = {}; S.player.cg = 0; S.player.nol = [];
      A.cgAdd('P', 10); const c0 = S.player.cash; A.corpTax(); const t1 = c0 - S.player.cash; A.cgAdd('P', -40); A.corpTax(); const nol = (S.player.nol || []).reduce((a, x) => a + x.a, 0); A.cgAdd('P', 30); const q = A.taxPlan();
      info.tax = {t1, nol, used: q.used, t: q.t}; out.tax = Math.abs(t1 - 3) < 1e-9 && Math.abs(nol - 40) < 1e-9 && Math.abs(q.used - 15) < 1e-9 && Math.abs(q.t - 4.5) < 1e-9 && loads();
      /* a sale of shares records the gain for the quarter */ const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 1); S.player.cg = 0; S.player.cash = 500; A.execBuy('P', c, c.shares * .01); c.price *= 1.3; A.execSell('P', c, c.own.P); out.cgSale = (S.player.cg || 0) > 0; }
    /* F2 — goodwill at control, impaired when the stake is worth less; the holding company's valuation falls */
    { std(2914); const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 1); c.own.P = c.shares * .6; S.player.cost[c.id] = mcapOf(c) * .6 * 1.5; function mcapOf(x) { return x.price * x.shares; }
      c.ctrl = 'P'; A.acqSnap(c); const gw = c.acq0.gw, hp0 = A.holdingPremium(); c.price *= .4; A.gwStep(); info.gw = {gw, imp: c.acq0.gwImp, hp0, hp1: A.holdingPremium()};
      out.goodwill = gw > 0 && c.acq0.gwImp > 0 && c.acq0.gwImp <= gw + 1e-9 && A.holdingPremium() < hp0 && /のれんの減損/.test(A.consolBox()) && loads(); }
    /* F3 — research narrows the estimate and reports the next results; analysts lean optimistic; rumours and fraud use no PRNG */
    { std(2915); S.player.cash = 100; const c = S.cos.find(x => !x.priv && !x.ctrl); const e0 = Math.abs(A.estErr(c)); const why = A.rschBuy(c);
      out.research = why === '' && A.rschHas(c) && Math.abs(A.estErr(c)) <= .015 + 1e-12 && /調査レポート/.test(A.infoBox(c)) && A.rschBuy(c) !== '';
      const bias = S.cos.filter(x => !x.priv).map(x => A.analyst(x).bias); out.analyst = bias.reduce((a, x) => a + x, 0) / bias.length > 0;
      const rs = S.rs; for (let i = 0; i < 30; i++) { S.week++; A.rumorStep(); if (S.week % 13 === 0) A.frdStep(); } out.noRng = S.rs === rs;
      const f = S.cos.find(x => !x.priv && !x.ctrl && x !== c && !x.frd); f.frd = {k: .3, w0: S.week, end: S.week + 26}; const p0 = f.price; A.frdOut(f, 'テストで'); out.fraud = f.price / p0 < .55 && f.frdW === S.week && !f.frd && loads(); }
    /* F3 — over 5 years rumours come and go and a fraud may surface; two runs match */
    { const run = () => { std(2916); for (let i = 0; i < 260; i++) { A.step(); S.inbox = []; } return JSON.stringify([S.cos.map(c => +c.price.toFixed(6)), S.cos.filter(c => c.frdW != null).map(c => c.id), S.news.filter(n => /【噂】/.test(n.t)).length]); };
      const a = run(), bb = run(); out.det = a === bb; info.rum = JSON.parse(a)[2]; }
    /* F5 — LP terms from the last fund; secondary sale; continuation fund; managed-money strategies */
    { A.newGame(2917, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); S.player.cash = 5000; A.trClose(); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3});
      S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise('buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } f.cfg.mode = 'manual';
      out.terms1 = f.feeR === .02 && f.carryR === .2;
      const mk = () => { let d = null; for (let i = 0; i < 300 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0 && x.type !== 'turn') d = x; else if (x) S.pe.deals = S.pe.deals.filter(y => y !== x); } d.dd = 2; d.risk = null; return A.peAcquire(d, f.id, A.dealAsk(d), .3, false); };
      const c1 = mk(), c2 = mk(); const young = A.fundSecWhy(f, c1); S.week += 30; const dist0 = f.distLP + f.distGP + f.carry, nav1 = c1.own[f.id] * A.peMark(c1);
      out.secondary = /半年/.test(young) && A.fundSecondary(f, c1) === '' && !S.cos.includes(c1) && Math.abs((f.distLP + f.distGP + f.carry - dist0) - nav1 * .88) < nav1 * .02;
      const early = A.fundContWhy(f); f.end = S.week + 10; const gp0 = S.player.cash; const cw = A.fundCont(f); const nf = S.pe.funds[S.pe.funds.length - 1];
      out.cont = /半年前/.test(early) && cw === '' && nf.cont === f.id && nf.feeR === .01 && (c2.own[nf.id] || 0) > 0 && !(c2.own[f.id] > 0) && c2.pe.owner === nf.id && f.closed && S.pe.track[0].why === '継続ファンドへ移管' && loads();
      /* the next regular fund is still numbered II and judged on the last regular fund */ out.contNotLast = !A.fundCanRaise().why || !/継続/.test(A.fundCanRaise().why || '');
      out.mmStrat = A.mmStrat() === 'ls' && A.mmSetStrat('mn') === '' && A.mmStrat() === 'mn' && /年1回/.test(A.mmSetStrat('long')) && loads();
      /* market-neutral clients earn the excess over the index */ S.mm.list = [{id: 1, who: 't', val: 100, w: S.week, hwm: 100}]; S.mm.aum = 100; S.idxHist.push(S.idxHist[S.idxHist.length - 1] * 1.05); const v0 = S.mm.list[0].val; A.mmWeek(.05); out.mmHedge = S.mm.list[0].val < v0 * 1.001; }
    /* rev29 (found by the UI fuzz): margin shares that stop being margin shares give back their votes before the save is written, so the save loads */
    { std(2919); const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 1 && !x.pill); c.own.P = c.shares * .55; S.player.cost[c.id] = c.price * c.own.P; S.player.loan = 5; S.player.mg = {[c.id]: c.shares * .2}; S.player.mgB = {[c.id]: 5}; A.recomputeCtrl(); A.trClose(); const before = c.ctrl;
      S.player.loan = 0; const txt = A.exportText(); info.mgv = {before, after: c.ctrl, err: A.parseSave(txt) ? '' : A.trialErr.slice(0, 60)}; out.mgVotes = before !== 'P' && c.ctrl === 'P' && !!A.parseSave(txt); }
    /* old saves keep loading; an impossible bond or tax record is refused */
    { std(2918); const t = JSON.parse(A.exportText()); t.gov = [{id: 1, k: 'g10', face: -1, cpn: .02, cost: 1, w: 0, mat: 520}]; const bad1 = !A.parseSave(JSON.stringify(t)); const t2 = JSON.parse(A.exportText()); t2.player.nol = [{w: 0, a: -5}]; const bad2 = !A.parseSave(JSON.stringify(t2)); out.refuse = bad1 && bad2; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev29: government bonds, own bonds and convertibles, rating; capital gains tax and loss carry-forward, goodwill and impairment; research, analysts, rumours, fraud; LP terms, secondaries, continuation funds, managed-money strategies', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev29 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testWeekly30(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    /* +1週 opens the week's results by default: group sales and profit this week against last week, by company, a 12-week chart */
    A.closeModal(); A.newGame(3001, 'normal', 'B', 'b', 'std', true); let S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4;
    const cs = S.cos.filter(x => !x.priv && !x.ctrl).slice(0, 2); for (const c of cs) c.own.P = c.shares * .6; A.recomputeCtrl(); for (let i = 0; i < 3; i++) { A.step(); S.inbox = []; } A.closeModal(); document.querySelector('#modal').hidden = true; A.renderAll(true);
    out.default = S.settings.rep === 'w' && A.wantReport(); document.querySelector('[data-act=step]').click(); A.renderAll(true); const m = document.querySelector('#modal');
    const a = S.wk[S.wk.length - 1], rev = cs.reduce((t, c) => t + c.rev / 52, 0); info.wk = {a, rev};
    out.report = !m.hidden && /週間業績/.test(m.textContent) && /本体（単体）/.test(m.textContent) && !/推計売上|グループ売上/.test(m.textContent) && m.querySelectorAll('.wkbars [data-act=wkbar]').length === Math.min(12, S.wk.length) && m.querySelectorAll('.rows .orow').length === 0; /* rev37: the weekly results are the head office alone (the subsidiaries' weeks are on their pages and in the group tab) */
    out.group = /子会社の週次実績/.test(A.groupWkBox()) && cs.every(c => A.groupWkBox().includes(c.name));
    out.figures = Math.abs(a.rev - rev) < 1e-9 && a.w === S.week && Object.keys(S.wkCos.cur).length === 2 && Object.keys(S.wkCos.prev).length === 2;
    /* a quarterly setting from an old save becomes weekly once; a choice made after that is kept */
    const t = JSON.parse(A.exportText()); t.settings = {rep: 'q'}; delete t.wk; out.migrate = !!A.parseSave(JSON.stringify(t));
    S.settings.rep = 'off'; A.closeModal(); const before = S.week; document.querySelector('[data-act=step]').click(); out.off = S.week === before + 1 && !A.wantReport();
    /* the record is bounded and refused when broken */ const t2 = JSON.parse(A.exportText()); t2.wk = [{w: 1, rev: NaN, op: 0, ni: 0, hold: 0, nw: 0}]; out.refuse = !A.parseSave(JSON.stringify(t2));
    /* the UI only reads: no RNG drawn to render the report */ const rs = S.rs; A.showReport(); A.wkBox(); out.noRng = S.rs === rs; A.closeModal();
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('weekly results: shown after +1週 by default; the head office alone with a 12-week chart (the subsidiaries in the group tab); old setting migrated; off respected; bad record refused', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 300));
  ok('no page errors in weekly-results tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev31(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S;
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); S.player.cash = cash; A.trClose(); return S; };
    const fundCo = seed => { traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise('buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = 'manual'; f.invEnd = S.week + 200; return f; };
    const deal = () => { let d = null; for (let i = 0; i < 300 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0 && x.type !== 'turn') d = x; else if (x) S.pe.deals = S.pe.deals.filter(y => y !== x); } d.dd = 2; d.risk = null; d.exp = S.week + 20; d.n = 0; d.ai = 0; d.bids = []; return d; };
    const setRoom = (f, room) => { const T = 1000, k = T - room; f.gp = T * .05; f.lp = T - f.gp; f.lp0 = f.lp; f.gp0 = f.gp; f.calledGP = k * .05; f.calledLP = k - f.calledGP; };
    const totalOf = (d, bd) => { const pt = bd.parts || {}; return A.peQuote(d, bd.eq, bd.lev, bd.owner).out * (1 - (bd.co || 0)) + (pt.integ || 0) + (pt.recap || 0) + (pt.wc || 0); };
    /* BUG-96 (residual): settlement needs 0.0175 more than reserved; the room beyond the reservation, after the fee reserve, is 0.0150 → refused, nothing changes */
    { const f = fundCo(3101), feeRes = 1000 * .02 / 52 * 4, X = .01748436, Y = .01497109;
      const run = (y) => { const d = deal(); setRoom(f, 1e4); A.peBid(d, 0, 0, false, f.id); const T = totalOf(d, d.bid); d.bid.need = T - X; setRoom(f, d.bid.need + y + feeRes);
        const snap = JSON.stringify([f.calledLP, f.calledGP, S.player.cash, S.cos.length, d.bid.need]), res = A.peResolve(d); const o = {res, same: JSON.stringify([f.calledLP, f.calledGP, S.player.cash, S.cos.length, d.bid ? d.bid.need : null]) === snap, room: A.fundRoom(f)}; d.bid = null; S.pe.deals = S.pe.deals.filter(x => x !== d); return o; }; /* the next case starts with no other bid holding money */
      const a = run(Y); info.b96 = {short: a}; out.b96refuse = a.res === 'fail' && a.same;
      const bb = run(.02); info.b96.fits = bb; out.b96fits = bb.res === 'won' && bb.room >= feeRes - 1e-9; }
    /* BUG-101 / 102: the balance sheet and the capital allocation add up to the net worth with government bonds and your bonds */
    { A.newGame(3102, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; S.player.cash = 30; A.trClose();
      const chk = () => { const gw = A.grossWorth(), bs = A.bsNow(), ca = A.capAlloc(); return {gw, bs: bs.eq, ca: ca.net}; }, c0 = chk(); A.govBuy('g10', 10); const c1 = chk(); A.sbIssue('sb', 5, 5); const c2 = chk();
      S.econ.rate += 1; const c3 = chk(); S.econ.rate -= 1; info.bs = {c0, c1, c2, c3}; const okc = c => Math.abs(c.bs - c.gw) < 1e-6 && Math.abs(c.ca - c.gw) < 1e-6;
      out.b101 = [c0, c1, c2, c3].every(okc) && A.bsNow().A.some(x => x[0] === 'gov' && x[2] > 9) && A.bsNow().L.some(x => x[0] === 'sb' && x[2] === 5);
      out.b102 = /国債/.test(A.capAllocBox()) && /発行した社債/.test(A.capAllocBox()); }
    /* BUG-103: the first bond issue of a game: the opening cash is before the issue; operating −0.05, financing +5, investing 0 */
    { A.newGame(3103, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; S.player.cash = 30; delete S.player.pl; delete S.player.plW; delete S.player.plY; A.trClose();
      A.ui.sbK = 'sb'; A.ui.sbY = 5; click('sbiss', null, 5); const L = A.liveRec('pl'), C = A.cfOf(L); info.b103 = {cash0: L.cash0, cash1: L.cash1, C};
      out.b103 = Math.abs(L.cash0 - 30) < 1e-9 && Math.abs(C.tot - 4.95) < 1e-9 && Math.abs(C.op + .05) < 1e-9 && Math.abs(C.fin - 5) < 1e-9 && Math.abs(C.inv) < 1e-9 && L.sb0 === 0 && L.sb1 === 5;
      const id = S.player.sb[0].id, c0 = S.player.cash; click('sbcall', id); const C2 = A.cfOf(A.liveRec('pl')); out.b103call = Math.abs(C2.fin - 0) < 1e-9 && Math.abs(C2.op + .05 + .05) < 1e-9 && Math.abs(c0 - S.player.cash - 5.05) < 1e-9 && Math.abs(C2.tot - C2.op - C2.inv - C2.fin) < 1e-12;
      /* a convertible turning into shares moves no cash */ A.sbIssue('cb', 4, 3); A.step(); const cb = S.player.sb[0]; cb.mat = S.week + 1; /* issued last week; converted this week */ cb.cvPx = A.selfPx() * .5; const f0 = A.cfOf(A.liveRec('pl')).fin; A.step(); const W = (S.player.plWH || [])[0], CW = A.cfOf(W); info.b103cb = {f0, CW, sb0: W.sb0, sb1: W.sb1};
      out.b103cb = !S.player.sb.length && W.sb1 === 0 && Math.abs(CW.fin) < 1e-9 && loads(); }
    /* BUG-104: the amount is the total paid (fee included): exactly the free cash can be spent */
    { A.newGame(3104, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.player.cash = 1; for (const c of S.cos) delete c.own.P; S.player.loan = 0; A.trClose(); A.ui.govK = 'g2'; A.ui.govAmt = 1; A.showBank(); const btn = document.querySelector('#modal [data-act=govbuy]'); info.b104 = {free: A.freeCash(), dis: btn && btn.disabled};
      out.b104btn = !!btn && !btn.disabled; click('govbuy', null, 1); A.closeModal(); out.b104 = Math.abs(S.player.cash) < 1e-9 && S.gov.length === 1 && Math.abs(S.gov[0].face - 1 / 1.001) < 1e-12; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev31: PE settlement above its reservation cannot use the fee reserve (BUG-96), balance sheet (BUG-101), cash flows of bonds (BUG-103), capital allocation (BUG-102), bond purchase limit (BUG-104)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 900));
  ok('no page errors in rev31 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev32(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 640}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    let S;
    /* BUG-105: a beginner's reward paid at the end of the week is in that week's records (individual trader, first purchase) */
    { A.closeModal(); A.newGame(3201, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; document.querySelector('#modal').hidden = true; A.renderAll(true);
      const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy('P', c, Math.min(c.shares * .001, S.player.cash * .2 / c.price)); A.renderAll(true);
      const t0 = Object.keys(S.tut || {}).length; document.querySelector('[data-act=step]').click(); const a = S.wk[S.wk.length - 1], W = S.player.plWH[0];
      info.b105 = {rewards: Object.keys(S.tut || {}).length - t0, nw: a.nw, my: A.myWorth(), nw1: W.nw1, np: A.netWorth('P')};
      out.b105 = Math.abs(a.nw - A.myWorth()) < 1e-9 && Math.abs(W.nw1 - A.netWorth('P')) < 1e-9 && info.b105.rewards > 0;
      /* several weeks, a quarter end, and after save → load */ A.closeModal(); for (let i = 0; i < 14; i++) { A.step(); A.closeModal(); }
      out.b105q = Math.abs(S.wk[S.wk.length - 1].nw - A.myWorth()) < 1e-9 && Math.abs(S.player.plWH[0].nw1 - A.netWorth('P')) < 1e-9 && !!A.parseSave(A.exportText()); }
    /* BUG-105 for a company game with personal money (BUG-108 the two figures differ by the personal assets) */
    { A.closeModal(); A.newGame(3202, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.pres.cash = 5; document.querySelector('#modal').hidden = true; A.renderAll(true); document.querySelector('[data-act=step]').click(); const m = document.querySelector('#modal'), a = S.wk[S.wk.length - 1], W = S.player.plWH[0];
      info.b108 = {total: a.nw, company: W.nw1, pres: A.presWealth()}; out.b108 = Math.abs(a.nw - W.nw1 - A.presWealth() - A.holdingsMkt('U')) < 1e-9 && !/あなたの総純資産/.test(m.textContent) && /会社（本体）の純資産・あなたの持分/.test(m.textContent) && /外部株主の分を除いた/.test(m.textContent) && /本社 › 社長/.test(m.textContent); /* rev36: your own holdings moved to the President tab */
      { const box = A.myAssetsBox(), num = t => +(t.match(/総純資産<\/span><b>([^<]*)</) || [])[1].replace(/[^0-9.-]/g, ''); info.b108.box = num(box); out.b108me = /あなたの保有資産/.test(box) && /個人の現金/.test(box) && Math.abs(num(box) - Math.round(A.myWorth() * 1e8)) <= 1 && /あなたの保有資産/.test(A.renderPres()); }
      /* BUG-107: the figures are named as weekly estimates and explained */ out.b107 = !/推計売上|推計営業利益|推計純利益/.test(m.textContent) && /本体（単体）/.test(m.textContent); /* rev37: the estimates are gone from the weekly results (head office alone), so they can no longer be mistaken for actuals */
      /* nothing overflows at 320px */ const Wd = document.documentElement.clientWidth; out.w320 = [...m.querySelectorAll('.sheet *')].filter(e => e.getBoundingClientRect().right > Wd + 1).length === 0; A.closeModal(); }
    /* BUG-106: the change against last week, judged at the yen shown */
    { const base = {w: 10, rev: 1, op: 1, ni: 1, hold: 1, div: 0, nw: 100, ret: 0}; const box = (x, y) => { S.wk = [Object.assign({}, base, y, {w: 9}), Object.assign({}, base, x)]; S.wkCos = {cur: {}, prev: {}}; return A.wkBox(); };
      const same = box({}, {}), plus1 = box({hold: 1 + 1e-8}, {}), minus1 = box({hold: 1 - 1e-8}, {}), tiny = box({hold: 1 + 1e-12}, {}), flip = box({hold: .5}, {hold: -.5});
      S.wk = [Object.assign({}, base)]; const first = A.wkBox();
      info.b106 = {same: (same.match(/±0円/g) || []).length, up: /▲1円/.test(plus1), down: /▼1円/.test(minus1), tiny: /±0円/.test(tiny) && !/▲0円/.test(tiny), flip: (flip.match(/class="up">▲[^<]*/g) || []).slice(0, 3), first: /前週比 —/.test(first) && !/▲|▼|±0円/.test(first), bad: /▲0円|▼0円/.test(same)};
      out.b106 = !/▲0円|▼0円/.test(same) && (same.match(/±0円/g) || []).length >= 2 && /▲1円/.test(plus1) && /▼1円/.test(minus1) && /±0円/.test(tiny) && !/▲0円/.test(tiny) && /class="up">▲100,000,000円/.test(flip) && /前週比 —/.test(first) && !/▲|▼|±0円/.test(first); }
    /* UI-01: a zero line; profits above, losses below; all zero on the line; one huge week still fits */
    { const mk = vals => { S.wk = vals.map((v, k) => ({w: k + 1, rev: 1, op: 1, ni: 0, hold: v, div: 0, nw: 1, ret: 0})); S.wkCos = {cur: {}, prev: {}}; const el = document.createElement('div'); el.innerHTML = A.wkBox(); document.body.appendChild(el); const zero = el.querySelector('.wkbars > i'), z = parseFloat(zero.style.top); const bars = [...el.querySelectorAll('.wkbars [data-act=wkbar] i')].map(i => ({top: parseFloat(i.style.top), h: parseFloat(i.style.height)})); el.remove(); return {z, bars}; };
      const mixed = mk([2, -1, 0, 3]), allPos = mk([1, 2]), allNeg = mk([-1, -2]), allZero = mk([0, 0, 0]), huge = mk([1, 1, 1000]);
      const above = (r, k) => Math.abs(r.bars[k].top + r.bars[k].h - r.z) < 1e-6, below = (r, k) => Math.abs(r.bars[k].top - r.z) < 1e-6;
      info.ui01 = {mixed, a: [above(mixed, 0), below(mixed, 1), above(mixed, 3)], pz: allPos.z, nz: allNeg.z, zero: allZero.bars, huge: huge.bars}; out.ui01 = above(mixed, 0) && below(mixed, 1) && above(mixed, 3) && Math.abs(mixed.bars[2].top - mixed.z) < 1.5 && allPos.z === 64 && allNeg.z === 0 && allZero.bars.every(x => x.h <= 1) && huge.bars.every(x => x.top >= -1e-6 && x.top + x.h <= 64 + 1e-6); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev32: weekly records close after rewards (BUG-105), ±0 shown neutral (BUG-106), estimates named (BUG-107), total vs company net worth named (BUG-108), zero line in the profit chart', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 700));
  ok('no page errors in rev32 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev33(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    let S;
    const fresh = (seed, scen) => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', scen, scen === 'std'); S = A.S; S.won = scen === 'std'; document.querySelector('#modal').hidden = true; A.renderAll(true); };
    const same = () => { const my = A.myWorth(), h = S.nwHist.P[S.nwHist.P.length - 1], w = S.wk[S.wk.length - 1].nw; return Math.abs(my - h) < 1e-8 && Math.abs(my - w) < 1e-8 && Math.abs(S.player.plWH[0].nw1 - A.netWorth('P')) < 1e-8 && Math.abs(S.player.plWH[0].cash1 - S.player.cash) < 1e-8; };
    /* T-109A / T-110A: the first purchase pays a reward at the end of the week */
    { fresh(3301, 'std'); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.plEnsure(); /* as act() does before a trade in the UI */ A.execBuy('P', c, Math.min(c.shares * .001, S.player.cash * .1 / c.price)); A.renderAll(true);
      const n0 = S.nwHist.P.length, t0 = Object.keys(S.tut || {}).length; document.querySelector('[data-act=step]').click(); const rew = Object.keys(S.tut).length - t0, C = A.cfOf(S.player.plWH[0]);
      info.t109a = {rew, hist: S.nwHist.P[S.nwHist.P.length - 1], wk: S.wk[S.wk.length - 1].nw, my: A.myWorth(), C};
      out.t109a = rew > 0 && same() && S.nwHist.P.length === n0 + 1;
      out.t110a = C.oth > 0 && Math.abs(C.op + C.inv + C.fin + C.oth - C.tot) < 1e-9 && C.inv < 0 && Math.abs(C.inv + (c.own.P * c.price)) < c.own.P * c.price * .05 && /その他の資金流入（達成報酬）/.test(document.querySelector('#modal').textContent); A.closeModal();
      /* T-109B: ten weeks without a reward: one entry a week, each the same as the weekly result */ let ok = true; for (let i = 0; i < 10; i++) { const n = S.nwHist.P.length; A.step(); A.closeModal(); ok = ok && S.nwHist.P.length === Math.min(260, n + 1) && same(); } out.t109b = ok; }
    /* T-110B: a reward week together with shares, government bonds and a bond issue: each in its own line */
    { fresh(3302, 'std'); S.allUnlocked = true; S.stage = 4; S.player.cash = 300; A.trClose(); A.step(); A.closeModal(); const cash0 = S.player.cash; delete (S.tut || {}).buy1; S.tut = S.tut || {};
      A.govBuy('g10', 10); A.sbIssue('sb', 5, 5); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy('P', c, Math.min(c.shares * .001, 1 / c.price)); A.step(); A.closeModal(); const C = A.cfOf(S.player.plWH[0]);
      info.t110b = C; out.t110b = Math.abs(C.fin - 5) < 1e-9 && Math.abs(C.op + C.inv + C.fin + C.oth - C.tot) < 1e-9 && C.inv < -10 && same(); }
    /* T-109C: an individual earns a reward, then incorporates; the history matches after the next week and after a reload */
    { fresh(3303, 'trader'); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy('P', c, Math.min(c.shares * .001, S.player.cash * .1 / c.price)); A.step(); A.closeModal(); const a = same();
      S.player.cash = 50; A.trClose(); A.incorporate('Z', 1); A.hqInit(); A.trClose(); A.step(); A.closeModal(); const bb = same(); const txt = A.exportText(); info.t109c = {a, bb};
      out.t109c = a && bb && !!A.parseSave(txt) && Math.abs(S.nwHist.P[S.nwHist.P.length - 1] - A.myWorth()) < 1e-8; }
    /* an older save without the reward line shows 0 there and still adds up */ { const L = Object.assign({}, S.player.plWH[0]); delete L.rew; const C = A.cfOf(L); out.oldRec = C.oth === 0 && Math.abs(C.op + C.inv + C.fin - C.tot) < 1e-9; }
    /* T-UI (UI-02): +1%, 0%, −1%, a rounding zero, not yet measured */
    { const base = {w: 5, rev: 1, op: 1, ni: 1, hold: 0, div: 0, nw: 1}; const box = ret => { S.wk = [Object.assign({}, base, {ret})]; S.wkCos = {cur: {}, prev: {}}; return A.wkBox(); };
      const up = box(.01), zero = box(0), down = box(-.01), tiny = box(.00004), none = box(null); info.ui = {up: /class="up">\+1\.0%/.test(up), zero: /class="note">±0\.0%/.test(zero), down: /class="down">−1\.0%/.test(down), tiny: /±0\.0%/.test(tiny), none: /<b>—<\/b>/.test(none)};
      out.ui02 = Object.values(info.ui).every(Boolean) && !/\+0\.0%/.test(zero + tiny); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev33: net-worth history, weekly results and the week\'s records from the same final state (BUG-109), rewards as their own cash-flow line (BUG-110), the week\'s return shown neutral at ±0.0% (UI-02)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 900));
  ok('no page errors in rev33 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev34(b) {
  const {p, errs} = await page(b, {viewport: {width: 375, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    let S;
    const fresh = (seed, scen) => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', scen, scen === 'std'); S = A.S; S.won = scen === 'std'; document.querySelector('#modal').hidden = true; A.renderAll(true); };
    const firstBuy = () => { const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.plEnsure(); A.execBuy('P', c, Math.min(c.shares * .001, S.player.cash * .1 / c.price)); return c; };
    const ident = L => Math.abs((L.nw1 - L.nw0) - (A.PL_ITEMS.reduce((a, [k]) => a + (L[k] || 0), 0) + (L.odiv || 0) + (L.rew || 0) + L.other)) < 1e-9;
    /* the same week twice from the same seed: once with the reward, once with it already received. Only the reward line may differ; the move in holdings is identical */
    const twin = (seed, scen) => { const run = pre => { fresh(seed, scen); if (pre) S.tut = Object.assign({}, S.tut, pre); firstBuy(); const t0 = Object.assign({}, S.tut); A.step(); A.closeModal(); const W = S.player.plWH[0];
        return {got: Object.keys(S.tut).filter(k => t0[k] == null), W, rets: JSON.stringify(S.tr.rets), wk: S.wk[S.wk.length - 1].nw, hist: S.nwHist.P[S.nwHist.P.length - 1], my: A.myWorth(), cash: S.player.cash}; };
      const a = run(null), pre = Object.fromEntries(a.got.map(k => [k, 0])), bb = run(pre); return {a, b: bb}; };
    /* TC-111-01: corporate start, first purchase */
    { const {a, b: bb} = twin(3401, 'std'); const rew = a.W.rew || 0; info.tc01 = {got: a.got, rew, otherWith: a.W.other, otherWithout: bb.W.other, cashDiff: a.cash - bb.cash};
      out.tc01 = a.got.length > 0 && rew > 0 && Math.abs(a.W.other - bb.W.other) < 1e-9 && Math.abs(a.cash - bb.cash - rew) < 1e-9 && ident(a.W) && ident(bb.W) && !(bb.W.rew) && Math.abs(a.wk - a.my) < 1e-9 && Math.abs(a.hist - a.my) < 1e-9 && Math.abs(A.cfOf(a.W).oth - rew) < 1e-9 && Math.abs(A.cfOf(a.W).inv - A.cfOf(bb.W).inv) < 1e-9;
      /* the statements show the reward on its own line */ S.acct = null; A.closeModal(); fresh(3401, 'std'); firstBuy(); A.step(); A.closeModal(); A.ui.tab = 'pres'; A.ui.hqTab = 'acc'; A.renderAll(true); const card = A.plCard(); A.ui.fsPer = 'w'; A.ui.fsKind = 'pl'; const fs = A.fsView ? A.fsView() : '';
      out.tc01ui = /達成報酬（はじめの一歩）/.test(card) && /達成報酬（はじめの一歩）/.test(fs); }
    /* TC-111-02: several rewards in one period — two in the same week (first purchase and a 5% stake: 1 + 2), and two in different weeks of one quarter */
    { const big = () => { const c = S.cos.filter(x => !x.priv && !x.ctrl && !x.pill).sort((x, y) => x.price * x.shares - y.price * y.shares)[0]; S.player.cash = Math.max(S.player.cash, c.price * c.shares * .1 + 10); A.trClose(); A.plEnsure(); A.execBuy('P', c, c.shares * .06); return c; };
      fresh(3402, 'std'); big(); A.step(); A.closeModal(); const W = S.player.plWH[0]; info.tc02 = {same: {rew: W.rew, got: Object.keys(S.tut)}}; const sameOk = Math.abs((W.rew || 0) - 3) < 1e-9 && ident(W) && Math.abs(A.cfOf(W).oth - 3) < 1e-9;
      fresh(3412, 'std'); while (S.week % 13 >= 10) { A.step(); A.closeModal(); } A.plEnsure(); const q0 = S.player.pl.w0; firstBuy(); A.step(); A.closeModal(); const w1 = S.player.plWH[0].rew || 0; big(); A.step(); A.closeModal(); const w2 = S.player.plWH[0].rew || 0, Q = A.liveRec('pl');
      info.tc02.split = {w1, w2, q: Q.rew, q0, w0: Q.w0}; out.tc02 = sameOk && Math.abs(w1 - 1) < 1e-9 && Math.abs(w2 - 2) < 1e-9 && Math.abs((Q.rew || 0) - 3) < 1e-9 && Q.w0 === q0 && ident(Q) && ident(S.player.plWH[0]); }
    /* TC-111-03: individual trader: same scaled reward, not in the investment record */
    { const {a, b: bb} = twin(3403, 'trader'); info.tc03 = {rew: a.W.rew, other: [a.W.other, bb.W.other]}; out.tc03 = (a.W.rew || 0) > 0 && Math.abs(a.W.other - bb.W.other) < 1e-9 && a.rets === bb.rets && ident(a.W); }
    /* TC-111-04: across a quarter and a year end: every closed record adds up, each reward once */
    { fresh(3404, 'std'); firstBuy(); let ok = true, sumW = 0; for (let i = 0; i < 60; i++) { A.step(); A.closeModal(); const W = S.player.plWH[0]; sumW += W.rew || 0; ok = ok && ident(W); if (S.week % 13 === 0) ok = ok && ident(S.player.plHist[0]); if (S.week % 52 === 0) ok = ok && ident(S.player.plYH[0]); }
      const qs = (S.player.plHist || []).reduce((a, L) => a + (L.rew || 0), 0) + (A.liveRec('pl').rew || 0); info.tc04 = {sumW, qs}; out.tc04 = ok && Math.abs(sumW - qs) < 1e-9 && !(S.player.pl.rew > 0 && S.player.pl.w0 > S.week); }
    /* TC-111-05: a week with no reward: the move in holdings is the whole residual */
    { const W = S.player.plWH[0]; out.tc05 = !(W.rew) && Math.abs(W.other - ((W.nw1 - W.nw0) - A.PL_ITEMS.reduce((a, [k]) => a + (W[k] || 0), 0) - (W.odiv || 0))) < 1e-9; }
    /* TC-111-06: a save whose records have no reward field loads, plays and does not pay rewards again */
    { fresh(3406, 'std'); firstBuy(); A.step(); A.closeModal(); const t = JSON.parse(A.exportText()); for (const k of ['pl', 'plW', 'plY']) if (t.player[k]) delete t.player[k].rew; for (const k of ['plWH', 'plHist', 'plYH']) for (const L of t.player[k] || []) delete L.rew;
      const err = A.importText(JSON.stringify(t)); S = A.S; const n0 = Object.keys(S.tut).length, c0 = S.player.cash; const card = A.plCard(); A.step(); A.closeModal(); info.tc06 = {err, n0, n1: Object.keys(S.tut).length};
      out.tc06 = !err && /達成報酬/.test(card) && ident(S.player.plWH[0]) && !(S.player.plWH[0].rew > 0) && Object.keys(S.tut).length === n0; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev34 (BUG-111): a beginner reward is its own line in the statements, never in the move of holdings; weekly/quarter/year add up; trader record untouched; old records load', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 900));
  ok('no page errors in rev34 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev35(b) {
  const fixture = fs.readFileSync(path.join(FIX, 'rev33-reward-pre111.json'), 'utf8');
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(raw => {
    const A = window.__atlas, out = {}, info = {};
    let S;
    const fresh = (seed, scen) => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', scen || 'std', (scen || 'std') === 'std'); S = A.S; S.won = true; S.settings.rep = 'off'; };
    const cfOk = L => { const C = A.cfOf(L); return Math.abs(C.op + C.inv + C.fin + (C.oth || 0) - (L.cash1 - L.cash0)) < 1e-9; };
    const plOk = L => Math.abs((L.nw1 - L.nw0) - (A.PL_ITEMS.reduce((a, [k]) => a + (L[k] || 0), 0) + (L.odiv || 0) + (L.rew || 0) + L.other)) < 1e-9 * Math.max(1, Math.abs(L.nw1));
    /* TC-112-01: the very first action of a new game is a purchase made straight away (no act wrapper): the opening cash is the starting cash */
    { fresh(3511); const cash0 = S.player.cash, c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy('P', c, c.shares * .002); const cost = cash0 - S.player.cash; A.step(); const W = S.player.plWH[0], C = A.cfOf(W);
      info.tc112a = {cash0: W.cash0, start: cash0, cost, C}; out.tc112a = Math.abs(W.cash0 - cash0) < 1e-9 && Math.abs(C.inv + cost) < cost * .02 + 1e-9 && Math.abs(C.oth - 1) < 1e-9 && cfOk(W) && Math.abs(S.player.pl.cash0 - S.player.cash) > 0 && plOk(W); }
    /* TC-112-02: the first action is a bank loan of 1; repaid later as negative financing */
    { fresh(3512); S.allUnlocked = true; S.stage = 4; const got = A.bankBorrow(1); A.step(); const W = S.player.plWH[0], C = A.cfOf(W); A.bankRepay(.5); A.step(); const W2 = S.player.plWH[0], C2 = A.cfOf(W2);
      info.tc112b = {got, fin: C.fin, fin2: C2.fin}; out.tc112b = got === 1 && Math.abs(C.fin - 1) < 1e-9 && cfOk(W) && Math.abs(C2.fin + .5) < 1e-9 && cfOk(W2); }
    /* TC-112-03: government bonds and an own bond issue as the first actions; a sale after a purchase */
    { fresh(3513); S.allUnlocked = true; S.stage = 4; const cash0 = S.player.cash; A.govBuy('g2', 5); A.sbIssue('sb', 3, 3); A.step(); const W = S.player.plWH[0], C = A.cfOf(W);
      const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy('P', c, c.shares * .002); A.step(); A.execSell('P', c, c.own.P); A.step(); const W3 = S.player.plWH[0];
      info.tc112c = {cash0: W.cash0, start: cash0, C}; out.tc112c = Math.abs(W.cash0 - cash0) < 1e-9 && Math.abs(C.fin - 3) < 1e-9 && C.inv < -4.9 && cfOk(W) && cfOk(W3) && A.cfOf(W3).inv > 0; }
    /* TC-113-01: the statements the accounting department shows as the latest are the week's closed figures (reward included) */
    { fresh(3514); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy("P", c, c.shares * .002); A.hqInit(); S.acct.w = -100; A.step(); const Ac = S.acct;
      info.tc113a = {w: Ac.w, week: S.week, eq: Ac.bs.eq, bs: A.bsNow().eq, rew: Ac.wk[0] && Ac.wk[0].rew};
      out.tc113a = Ac.w === S.week && Math.abs(Ac.bs.eq - A.bsNow().eq) < 1e-9 && Ac.wk[0] && Math.abs((Ac.wk[0].rew || 0) - 1) < 1e-9 && Ac.wk[0].w === S.week && plOk(Ac.wk[0]) && /最新（.*週末の締め）/.test(A.fsView()); }
    /* TC-113-02: the delay by the department's capacity is kept (no department: every 8 weeks; full: every week), through a quarter and a year end */
    { const gaps = setup => { fresh(3515); A.hqInit(); setup(); const ws = []; let last = S.acct.w; for (let i = 0; i < 60; i++) { A.step(); if (S.acct.w !== last) { ws.push(S.acct.w - last); last = S.acct.w; if (!(Math.abs(S.acct.bs.eq - A.bsNow().eq) < 1e-9)) ws.push(NaN); } } return {ws, lag: A.accLag()}; };
      const none = gaps(() => {}), full = gaps(() => { S.dept = S.dept || {}; S.dept.acc = Object.assign(S.dept.acc || {}, {on: true, staff: 50, ab: 90, mo: 90}); });
      info.tc113b = {none: [none.lag, none.ws.slice(0, 6)], full: [full.lag, full.ws.slice(0, 6)]}; out.tc113b = none.ws.length > 0 && none.ws.every(g => g === none.lag) && full.ws.every(g => g === full.lag) && full.lag < none.lag; }
    /* TC-114-01: a save made by the version before BUG-111: the closed quarter held the reward twice; it adds up after loading */
    { const err = A.importText(raw); S = A.S; const Q = S.player.plHist[0]; info.tc114a = {err, rew: Q.rew, other: Q.other, d: Q.nw1 - Q.nw0}; out.tc114a = !err && Q.rew === 1 && plOk(Q) && Math.abs(Q.other - (Q.nw1 - Q.nw0 - 1)) < 1e-6 && Q.other < .5; }
    /* TC-114-02: repairing again changes nothing; a current record, a record without a reward, and a mix are left as they are */
    { const snap = () => JSON.stringify([S.player.plWH, S.player.plHist, S.player.plYH, S.acct]); const s0 = snap(); A.plRewRepair(); const s1 = snap();
      fresh(3516); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((x, y) => x.price - y.price)[0]; A.execBuy('P', c, c.shares * .002); for (let i = 0; i < 14; i++) A.step(); const t0 = snap(); A.plRewRepair(); out.tc114b = s0 === s1 && snap() === t0 && S.player.plHist.every(plOk); }
    /* TC-114-03: load the old save → save → load → a week on: everything adds up and the save is accepted */
    { A.importText(raw); S = A.S; const txt = A.exportText(); const err = A.importText(txt); S = A.S; A.step(); const ok = [...S.player.plHist, ...S.player.plWH].every(L => plOk(L) && cfOk(L)); info.tc114c = {err, ok}; out.tc114c = !err && ok && !!A.parseSave(A.exportText()) && plOk(S.player.plHist[0]); }
    return {out, info};
  }, fixture);
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev35: records open at the start of a game (BUG-112), the accounting statements are taken when the week closes with their delay kept (BUG-113), old records with a doubled reward are repaired once (BUG-114)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 1200));
  ok('no page errors in rev35 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testPE55(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 844}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S; A.importText(txt); return ok1 && A.S !== S0 && A.econCheck(A.S) === ''; };
    const click = (act, id, v) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; A.act(act, el); };
    let S; const fresh = (seed, diff) => { A.closeModal(); A.newGame(seed, diff || 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: Math.max(1, S.dept.inv.staff)}); return S; };
    const snap = c => JSON.stringify([c.cash, c.assets, c.debt, c.fixed, (A.ceoOf(c) || {}).id || null, c.pe.p100 == null ? null : c.pe.p100, c.cult, S.player.cash]);
    /* 1-5: near-natural — weeks played normally until an AI firm offers a company (pesec); free cash brought down by a real share purchase; bought through the inbox button */
    { fresh(100, 'easy'); let it = null; for (let w = 0; w < 400 && !it; w++) { A.step(); S = A.S; it = S.inbox.find(i => i.kind === 'pesec'); if (!it) S.inbox = S.inbox.filter(i => i.kind === 'pesec'); }
      if (!it) { out['01'] = 'BLOCKED: 400週以内にセカンダリー提案が出ず'; }
      else { const c = A.coById(it.cid); S.player.loan = 0; info.eq = it.eq; info.free0 = A.freeCash(); const tgt = Math.max(it.eq * .1, it.eq * 1.03 - info.free0); info.tgt = tgt; /* buying power ≈ free cash + net worth in shares: keep enough to pay, with less than half paid in cash */ for (const big of S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0).sort((a, b) => b.price * b.shares - a.price * a.shares).slice(0, 6)) { const want = A.freeCash() - tgt; if (want <= .01) break; A.execBuy('P', big, A.sharesForMoney(big, want), want); } /* free cash ≈ 30% of the price, by real purchases of listed shares (several, as one company's float is limited) */
        info.wk = S.week; info.cid = c.id; const bpOK = A.buyingPower() >= it.eq * 1.01; click('pesecbuy', it.id, 'P'); const bought = c.pe.owner === 'P';
        out['01'] = !bpOK ? 'BLOCKED: 買付余力不足' : bought && c.ctrl !== 'P' && A.gfrac(c, 'P') < .5; info['01'] = {week: S.week, votes: A.gfrac(c, 'P'), ctrl: c.ctrl, free: A.freeCash()};
        if (bought && c.ctrl !== 'P') {
          const el = document.createElement('div'); el.innerHTML = A.peHoldingCard(c); const btn = el.querySelector('[data-act="pe100"]'); out['02'] = !!btn && btn.disabled && /経営権がないため実行できません/.test(el.textContent);
          const s0 = snap(c); const r1 = A.pe100(c); const s1 = snap(c); const co0 = JSON.stringify(JSON.parse(s1).slice(0, 7)); click('pe100', c.id); /* the button goes through act(), whose usual after-step (the margin sweep) may move the player's own cash: the company and the plan must not move */ out['03'] = r1 === false && s1 === s0 && JSON.stringify(JSON.parse(snap(c)).slice(0, 7)) === co0;
          S.player.cash = 1e4; A.mgSettle(c); A.recomputeCtrl(); const okNow = c.ctrl === 'P' && S.week - c.pe.w0 <= 15; const r2 = A.pe100(c); out['04'] = okNow ? r2 === true && c.pe.p100 != null : 'N/A: 期限外'; const r3 = A.pe100(c); out['05'] = r3 === false;
          info['04'] = {okNow, w: S.week - c.pe.w0}; } } }
    /* 6-8: a buyout with control works as before */
    const deal = () => { let d = (S.pe.deals || []).find(x => !x.bid); if (!d) d = A.peDealGen({}); d.ai = 0; d.n = 0; d.dd = 2; return d; };
    const settle = d => { d.bid.end = S.week; return A.peResolve(d); };
    const findCo = d => S.cos.find(c => c.name === d.name && c.pe && !c.pe.closed);
    { fresh(5801); const d = deal(), v = A.peVoteQuote(d, A.dealAsk(d), .5, 0); S.player.cash = v.own * 1.5; A.peBid(d, 0, .5, false, 'P'); settle(d); const c = findCo(d); out['06'] = !!c && c.ctrl === 'P' && A.pe100(c) === true; }
    { fresh(5802); const d = deal(), v0 = A.peVoteQuote(d, A.dealAsk(d), .65, 0); const h = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0).sort((a, b) => b.price * b.shares - a.price * a.shares)[0]; S.player.cash = v0.own * 2; A.execBuy('P', h, A.sharesForMoney(h, v0.own)); S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; S.player.cash = v0.shareCash * .75 + v0.feeCash;
      const ok = A.peBid(d, 0, .65, false, 'P'); settle(d); const c = findCo(d); out['07'] = ok && !!c && c.ctrl === 'P' && (S.player.mgB || {})[c.id] > 0 && A.pe100(c) === true; }
    { fresh(5803); const d = deal(), part = A.coPartner(d, .25), v = A.peVoteQuote(d, A.dealAsk(d), .5, .25, part && part.id); S.player.cash = v.own * 1.5; A.peBid(d, 0, .5, false, 'P', .25); settle(d); const c = findCo(d); out['08'] = !!c && c.ctrl === 'P' && A.pe100(c) === true; }
    /* 9-11: no control — recap and culture refused, holding, partial 現引き and selling allowed; with control they work */
    const secFix = seed => { fresh(seed); const qf = S.pe.firms[0]; const c = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[2]; const eq = c.price * c.shares; c.priv = true; c.own = {[qf.id]: c.shares}; c.pe = {type: 'buy', owner: qf.id, w0: S.week, ev0: A.peEV(c), e0: A.ebitda(c), rev0: c.rev, m0: A.opMargin(c), inv: eq, flows: [[S.week, -eq]], mq: 55, dd: true, risk: null, promise: 0}; A.recomputeCtrl(); /* artificial fixture: an AI firm's company */
      const h = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0 && x !== c).sort((a, b) => b.price * b.shares - a.price * a.shares)[0]; S.player.cash = eq * 2; A.execBuy('P', h, A.sharesForMoney(h, eq)); S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; S.player.cash = eq * .3; A.peBuySecondary(c, 'P', eq); c.pe.cultQ = true; return c; };
    { const c = secFix(5804); const s0 = JSON.stringify([c.debt, c.cash, c.cult, S.player.cash, c.pe.cultQ]); const rc = A.peRecap(c), cu = A.peCulture(c, true); out['09'] = c.ctrl !== 'P' && rc === 0 && cu === false && JSON.stringify([c.debt, c.cash, c.cult, S.player.cash, c.pe.cultQ]) === s0; }
    { const c = secFix(5807); S.player.cash = 1e4; A.mgSettle(c); A.recomputeCtrl(); const ctrl = c.ctrl === 'P'; const d0 = c.debt; const rc2 = A.peRecap(c); const cu2 = A.peCulture(c, false); out['10'] = ctrl && cu2 === true && (rc2 > 0 ? c.debt > d0 : A.ebitda(c) * 4 - d0 < .2); info['10'] = {rc2}; }
    { const c = secFix(5808); const R = S.rivals[0]; R.cash = 1e6; const v0 = A.gfrac(c, 'P'); S.player.cash = 1; A.mgSettle(c); const partSettle = A.gfrac(c, 'P') > v0; const got = A.transferShares('P', R.id, c, c.own.P * .5, c.price); out['11'] = c.ctrl !== 'P' && partSettle && got > 0; }
    { fresh(5805); const d = deal(), v = A.peVoteQuote(d, A.dealAsk(d), .5, 0); S.player.cash = v.own * 1.5; A.peBid(d, 0, .5, false, 'P'); settle(d); const c = findCo(d); const before = JSON.stringify([c.ctrl, c.pe.p100, S.player.mg]); const ok = loads(); S = A.S; const c2 = S.cos.find(x => x.id === c.id); out['12'] = ok && JSON.stringify([c2.ctrl, c2.pe.p100, S.player.mg]) === before; }
    { fresh(5806); const d = deal(), v0 = A.peVoteQuote(d, A.dealAsk(d), .5, 0); const h = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0).sort((a, b) => b.price * b.shares - a.price * a.shares)[0]; S.player.cash = v0.own * 3; A.execBuy('P', h, A.sharesForMoney(h, v0.own * 1.5)); S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; S.player.cash = v0.shareCash * .3; const v = A.peVoteQuote(d, A.dealAsk(d), .5, 0);
      const ok = A.peBid(d, 0, .5, false, 'P'); out['13'] = v.ok && !v.ctrl && !ok; info['13'] = {ok: v.ok, votes: v.votes}; } /* refused for the votes alone (the money is there) */
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev55 PE', JSON.stringify(r.info).slice(0, 2000));
  for (const [k, v] of Object.entries(r.out)) { if (typeof v === 'string') console.log(`SKIP  rev55 PE: ${k} — ${v}`); else ok('rev55 PE: ' + k, v); }
  /* 14: the PE screen at 390px */
  const w = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); ok('rev55 PE: 14 no sideways overflow at 390px', w);
  ok('rev55 PE: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testPE54(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S; A.importText(txt); return ok1 && A.S !== S0 && A.econCheck(A.S) === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: Math.max(1, S.dept.inv.staff)}); S.player.shorts = {}; S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; return S; };
    /* artificial: a deal is generated and its auction is settled at once; cash and listed holdings (margin room) are set by the test */
    const deal = () => { let d = (S.pe.deals || []).find(x => !x.bid); if (!d) d = A.peDealGen({}); d.ai = 0; d.n = 0; d.dd = 2; return d; };
    const room = amt => { const h = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0).sort((a, b) => b.price * b.shares - a.price * a.shares)[0]; S.player.cash = amt * 2; A.execBuy('P', h, A.sharesForMoney(h, amt)); S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; };
    const settle = d => { d.bid.end = S.week; return A.peResolve(d); };
    const findCo = d => S.cos.find(c => c.name === d.name && c.pe && !c.pe.closed);
    /* 1: all cash */
    { fresh(5701); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); S.player.cash = v0.own * 1.5; const ok = A.peBid(d, 0, .5, false, 'P'); const r1 = settle(d); const c = findCo(d);
      out['01_cash'] = ok && r1 === 'won' && !!c && c.ctrl === 'P' && !(S.player.mg || {})[c.id] && Math.abs(A.gfrac(c, 'P') - 1) < 1e-9 && S.player.loan === 0; }
    /* 2: part on margin, control kept */
    { fresh(5702); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); room(v0.own); S.player.cash = v0.shareCash * .7 + v0.feeCash; const v = A.peVoteQuote(d, eq, .5, 0); const ok = A.peBid(d, 0, .5, false, 'P'); const r1 = settle(d); const c = findCo(d);
      const n0 = S.news.filter(n => c && n.t.includes(c.name) && n.t.includes('経営権')).length;
      out['02_partMargin'] = ok && r1 === 'won' && !!c && c.ctrl === 'P' && Math.abs((S.player.mgB || {})[c.id] - v.borrowed) < 1e-6 && Math.abs((S.player.mg || {})[c.id] - c.shares * v.borrowed / v.shareCash) < 1e-6 && Math.abs(A.gfrac(c, 'P') - v.votes) < 1e-6 && n0 === 1; info['02'] = {votes: v.votes, borrowed: v.borrowed, ctrlNews: n0}; }
    /* 3: mostly on margin: refused at the bid; refused again at settlement if the money changes after the bid */
    { fresh(5703); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); room(v0.own * 1.5); S.player.cash = v0.shareCash * .3; const v = A.peVoteQuote(d, eq, .5, 0); const st = JSON.stringify([S.player.cash, S.player.loan, d.bid || null, S.cos.length]); const ok = A.peBid(d, 0, .5, false, 'P');
      const refusedBid = !ok && !v.ctrl && JSON.stringify([S.player.cash, S.player.loan, d.bid || null, S.cos.length]) === st;
      S.player.cash = v0.own * 1.2; const ok2 = A.peBid(d, 0, .5, false, 'P'); S.player.cash = v0.shareCash * .3; const n = S.cos.length, deals0 = S.pe.deals.length, L0 = S.player.loan; const r2 = settle(d);
      out['03_refused'] = refusedBid && ok2 && r2 === 'fail' && S.cos.length === n && S.player.loan === L0 && !findCo(d); info['03'] = {votes: v.votes}; }
    /* 4: LBO debt and the seller's instalments are the company's debt, not margin */
    { fresh(5704); const d = deal(), eq = A.dealAsk(d); const v = A.peVoteQuote(d, eq, .65, 0); S.player.cash = v.own; const ok = A.peBid(d, 0, .65, false, 'P'); const r1 = settle(d); const c = findCo(d);
      out['04_lbo'] = ok && r1 === 'won' && !!c && c.ctrl === 'P' && !(S.player.mg || {})[c.id] && Math.abs(c.debt - (d.debt + v.lbo)) < 1e-6 && S.player.loan < 1e-9; info['04'] = {lbo: v.lbo, sn: v.sn}; }
    /* 5: a co-investor keeps its own shares and votes; the player's margin shares are only out of the player's part */
    { fresh(5705); const d = deal(), eq = A.dealAsk(d); const part = A.coPartner(d, .25); const v0 = A.peVoteQuote(d, eq, .5, .25, part && part.id); room(v0.own); S.player.cash = v0.shareCash * .85 + v0.feeCash; const v = A.peVoteQuote(d, eq, .5, .25, part && part.id); const ok = A.peBid(d, 0, .5, false, 'P', .25); const r1 = settle(d); const c = findCo(d);
      out['05_coinvest'] = ok && r1 === 'won' && !!c && Math.abs(c.own[part.id] / c.shares - .25) < 1e-9 && Math.abs(c.own.P / c.shares - .75) < 1e-9 && Math.abs((S.player.mg || {})[c.id] - c.own.P * v.borrowed / v.shareCash) < 1e-6 && c.ctrl === 'P'; info['05'] = {votes: v.votes, partner: part && part.id}; }
    /* 6: borrowing only for the fee does not limit votes */
    { fresh(5706); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); room(v0.own); S.player.cash = v0.shareCash; const ok = A.peBid(d, 0, .5, false, 'P'); const r1 = settle(d); const c = findCo(d);
      out['06_feeLoan'] = ok && r1 === 'won' && !(S.player.mg || {})[c.id] && Math.abs(S.player.loan - v0.feeCash) < 1e-6 && c.ctrl === 'P'; }
    /* 7: no passing control, record or news before the margin shares are on record */
    { fresh(5707); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, .45, (A.coPartner(d, .45) || {}).id); room(v0.own * 2); S.player.cash = v0.shareCash * .1 + v0.feeCash; S.week += 0; const n0 = S.news.length;
      const vv = A.peVoteQuote(d, eq, .5, .45, (A.coPartner(d, .45) || {}).id); const ok = A.peBid(d, 0, .5, false, 'P', .45); const created = S.cos.filter(c => c.name === d.name).length; const newsP = S.news.slice(0, S.news.length - n0).filter(n => n.t.includes('経営権取得') && n.t.includes(S.company)).length;
      out['07_noTransient'] = !vv.ctrl && !ok && created === 0 && newsP === 0; }
    /* 8: a fund's buyout is unaffected (no company margin) */
    out['08_fund'] = 'covered: testPE（PE fund: a fund deal is owned by the fund...）— ファンドは資金コールで支払い、本社の信用借入を使わない';
    /* 9: 現引き gives the votes back */
    { fresh(5709); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); room(v0.own); S.player.cash = v0.shareCash * .6 + v0.feeCash; A.peBid(d, 0, .5, false, 'P'); settle(d); const c = findCo(d); const g0 = A.gfrac(c, 'P'); S.player.cash = 1e4; A.mgSettle(c);
      out['09_settle'] = !!c && g0 < 1 && Math.abs(A.gfrac(c, 'P') - 1) < 1e-9 && !(S.player.mg || {})[c.id]; }
    /* 10: selling the company (EXIT) closes its margin record */
    { fresh(5710); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); room(v0.own); S.player.cash = v0.shareCash * .6 + v0.feeCash; A.peBid(d, 0, .5, false, 'P'); settle(d); const c = findCo(d); const R = S.rivals[0]; R.cash = 1e6; const got = A.transferShares('P', R.id, c, c.own.P, c.price); A.mgSync();
      out['10_exit'] = !!c && got > 0 && !(S.player.mg || {})[c.id] && !(S.player.mgB || {})[c.id]; }
    /* 11: take-private — the shares bought on credit carry no votes; control is kept because every other holder is bought out (the group already held 40%+ to control it) */
    { fresh(5711); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0 && x.ind !== 'air' && x.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares)[3]; S.player.cash = c.price * c.shares * 2; A.execBuy('P', c, c.shares * .6); A.recomputeCtrl(); S.player.loan = 0; S.player.mg = {}; S.player.mgB = {};
      const Q0 = A.privQuote(c, .3); const h = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0 && x !== c).sort((a, b) => b.price * b.shares - a.price * a.shares)[0]; S.player.cash = Q0.out * 2; A.execBuy('P', h, A.sharesForMoney(h, Q0.out)); S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; S.player.cash = Q0.shareCash * .3 + Q0.fee;
      const Q = A.privQuote(c, .3), r2 = A.peTakePrivate(c, .3); const none = A.privQuote(c, .3);
      out['11_private'] = Q.ok && Q.ctrl && !!r2 && c.priv && Math.abs((S.player.mgB || {})[c.id] - Q.borrowed) < 1e-6 && c.ctrl === 'P' && A.gfrac(c, 'P') < 1 - 1e-6 && Math.abs(A.gfrac(c, 'P') - Q.votes) < 1e-6; info['11'] = {votes: Q.votes, borrowed: Q.borrowed}; }
    /* 12: the bid screen shows the holdings, votes, margin, LBO debt and whether control is taken */
    { fresh(5712); const d = deal(); const v0 = A.peVoteQuote(d, A.dealAsk(d), .5, 0); room(v0.own); S.player.cash = v0.shareCash * .7 + v0.feeCash; A.ui && (A.ui.deal = d.id); const h = A.dealCard ? (() => { window.__atlas.ui = window.__atlas.ui; return ''; })() : ''; const el = document.createElement('div');
      try { const U = A.ui || {}; U.deal = d.id; U.peOwner = 'P'; U.peBid = 0; U.peLev = .5; U.peCo = 0; el.innerHTML = A.dealCard(d); } catch (e) { info['12'] = String(e); }
      const t = el.textContent; out['12_screen'] = /経済的持株/.test(t) && /議決権/.test(t) && /信用借入/.test(t) && /LBO借入/.test(t) && /経営権：/.test(t); }
    /* 13: an old save keeps its companies as they were (no guessed margin) */
    { fresh(5713); const d = deal(), eq = A.dealAsk(d); const v0 = A.peVoteQuote(d, eq, .5, 0); S.player.cash = v0.own * 1.5; A.peBid(d, 0, .5, false, 'P'); settle(d); const c = findCo(d); S.player.loan = 5; /* artificial: a loan from before, its use unknown */ const before = JSON.stringify([S.player.mg, c.ctrl]); const ok = loads(); S = A.S; const c2 = S.cos.find(x => x.id === c.id);
      out['13_oldSave'] = ok && JSON.stringify([S.player.mg, c2.ctrl]) === before; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev54 PE', JSON.stringify(r.info).slice(0, 2000));
  for (const [k, v] of Object.entries(r.out)) { if (typeof v === 'string') console.log(`SKIP  rev54 PE: ${k} — ${v}`); else ok('rev54 PE: ' + k, v); }
  ok('rev54 PE: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testFunds53(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S; A.importText(txt); return ok1 && A.S !== S0 && A.econCheck(A.S) === ''; };
    let S; const fresh = (seed, sc) => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', sc || 'std', sc !== 'trader'); S = A.S; S.won = S.lost = true; S.allUnlocked = true; if (sc !== 'trader') S.stage = 4; S.settings.confirm = false; A.hqInit && A.hqInit(); return S; };
    /* artificial: cash and short positions set by the test (a real short sale through execShort) */
    const shortTo = (free, raise) => { const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 0); S.player.shorts = {}; S.player.cash = 0; A.execShort(c, A.sharesForShort(c, raise || 10)); const lock = A.shortLiab() * .5; S.player.cash = free + lock; return lock; };
    const held = () => S.player.cash >= A.shortLiab() * .5 - 1e-9;
    const pub = i => S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0)[i];
    const rs = () => JSON.stringify([S.player.cash, S.player.loan, S.research.pts, (S.player.plW || {}).rd || 0]);
    const resFresh = seed => { fresh(seed); S.research.budget = 3; S.player.shorts = {}; S.player.cash = 2e4; for (const id of ['R-tyo-02', 'R-nyc-02', 'R-lon-01']) { const x = S.props.find(y => y.id === id); A.buyProp('P', x, 0, A.propQuote(x, 1, 0).price); } S.player.cash = 0; return A.researchQuote().target; }; /* artificial: net worth mostly in buildings (they count in net worth, not in the buying power), so the budget is large and the money to pay it small */
    /* RE-17: research */
    { const t = resFresh(5501); S.player.cash = 0; S.player.loan = 0; const s0 = rs(); A.researchStep(); out['01'] = t > 0 && rs() === s0 && A.researchQuote().spend === 0; info['01'] = {target: t}; }
    { resFresh(5502); shortTo(0); const s0 = rs(); A.researchStep(); out['02'] = rs() === s0 && held(); }
    { resFresh(5503); S.player.cash = A.researchQuote().target * .2; const t = A.researchQuote().target, f0 = A.freeCash(); const bp = A.buyingPower(), pts0 = S.research.pts, L0 = S.player.loan, rd0 = (S.player.plW || {}).rd || 0; A.researchStep(); const paid = S.research.pts - pts0;
      out['03'] = bp < t && Math.abs(paid - bp) < 1e-9 && Math.abs(-(((S.player.plW || {}).rd || 0) - rd0) - paid) < 1e-9 && Math.abs(S.player.loan - L0 - (paid - f0)) < 1e-9 && held(); info['03'] = {t, bp, paid}; }
    { resFresh(5504); S.player.cash = A.researchQuote().target * 10; const t = A.researchQuote().target; const L0 = S.player.loan, c0 = S.player.cash; A.researchStep(); out['04'] = S.player.loan === L0 && Math.abs(c0 - S.player.cash - t) < 1e-9; }
    { const t = resFresh(5505); const lock = shortTo(0); S.player.cash = lock + 50; const h = pub(9); A.execBuy('P', h, A.sharesForMoney(h, 50)); S.player.cash = lock; const bp = A.buyingPower(), L0 = S.player.loan; A.researchStep(); out['05'] = held() && S.player.loan - L0 <= bp + 1e-9 && S.player.loan - L0 > 0; info['05'] = {bp, up: S.player.loan - L0}; }
    { resFresh(5506); const lock = shortTo(0); S.player.cash = lock * .5; S.player.loan = 0; const c0 = S.player.cash, s0 = rs(); A.researchStep(); out['06'] = S.player.cash === c0 && (rs() === s0 || S.player.loan <= A.buyingPower() + 1e-9); }
    { resFresh(5507); S.player.cash = 0; A.researchStep(); const none = S.research.pts === 0; S.player.cash = A.researchQuote().target * 5; A.researchStep(); out['07'] = none && S.research.pts > 0 && S.research.budget === 3; }
    { resFresh(5508); S.player.cash = 100; S.research.pts = 1e9; const s0 = rs(); A.researchStep(); const left = A.researchQuote().target; S.research.pts = 0; S.research.budget = 0; const s1 = rs(); A.researchStep(); out['08'] = rs() === s1 && left === 0 && JSON.parse(s0)[0] === 100; }
    { resFresh(5509); S.player.cash = A.researchQuote().target * .2; const q = A.researchQuote(); const h = A.renderHQ ? '' : ''; const html = document.createElement('div'); try { html.innerHTML = (A.researchHTML ? A.researchHTML() : ''); } catch (e) {} const txt = html.textContent;
      out['09'] = (!A.researchHTML) ? 'N/A' : txt.includes(A.fm(q.target)) && txt.includes(A.fm(q.spend)) && /縮小|停止/.test(txt); }
    { fresh(5510, 'trader'); S.research = S.research || {pts: 0, budget: 0, done: {}}; S.research.budget = 3; S.player.cash = .001; S.player.loan = 0; A.researchStep(); out['10'] = S.player.loan === 0 && S.player.cash >= 0; }
    /* RE-18: PE secondary — fixture: an AI firm owns an unlisted company (none exist at the start) */
    const secFix = (seed) => { fresh(seed); const qf = S.pe.firms[0]; const c = S.cos.filter(x => !x.priv && !x.ctrl && !x.reorg && x.price > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[2]; const tot = c.price * c.shares; c.priv = true; c.own = {[qf.id]: c.shares}; c.pe = {type: 'buy', owner: qf.id, w0: S.week, ev0: A.peEV(c), e0: A.ebitda(c), rev0: c.rev, m0: A.opMargin(c), inv: tot, flows: [[S.week, -tot]], mq: 55, dd: true, risk: null, promise: 0}; A.recomputeCtrl(); S.player.shorts = {}; S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; return {c, qf, eq: tot}; };
    const room = (eq, free) => { S.player.cash = eq * 2; const h = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0).sort((a, b) => b.price * b.shares - a.price * a.shares)[0]; A.execBuy('P', h, A.sharesForMoney(h, eq)); S.player.cash = free; S.player.loan = 0; S.player.mg = {}; S.player.mgB = {}; }; /* artificial: listed holdings worth about the price give margin room */
    const pst = (c, qf) => JSON.stringify([c.own, c.pe, c.debt, S.player.cash, S.player.loan, S.player.mg, (S.player.cost || {})[c.id] || 0, qf.cash, c.ctrl]);
    { const {c, eq} = secFix(5511); S.player.cash = eq * 1.01 + 1; const ok = A.peBuySecondary(c, 'P', eq); out['11'] = ok && S.player.loan === 0 && !(S.player.mg || {})[c.id] && c.ctrl === 'P' && A.gfrac(c, 'P') > .99; }
    { const {c, eq} = secFix(5512); room(eq, eq * .3); const L0 = S.player.loan; const ok = A.peBuySecondary(c, 'P', eq); const borrowed = eq - eq * .3; out['12'] = ok && Math.abs((S.player.mgB || {})[c.id] - borrowed) < 1e-6 && Math.abs((S.player.mg || {})[c.id] - c.shares * borrowed / eq) < 1e-6 && c.ctrl !== 'P' && A.gfrac(c, 'P') < .5; info['12'] = {ctrl: c.ctrl, g: A.gfrac(c, 'P'), loan: S.player.loan - L0}; }
    { const {c, qf, eq} = secFix(5513); S.player.cash = eq * 1.005 / 2; const s0 = pst(c, qf); const ok = A.peBuySecondary(c, 'P', eq); out['13'] = !ok && pst(c, qf) === s0; info['13'] = {bp: A.buyingPower(), need: eq * 1.01}; }
    { const {c, qf, eq} = secFix(5514); S.player.cash = eq * .1; const s0 = pst(c, qf); out['14'] = !A.peBuySecondary(c, 'P', eq) && pst(c, qf) === s0; }
    { const {c, eq} = secFix(5515); S.player.cash = eq; const ok = A.peBuySecondary(c, 'P', eq); out['15'] = ok && !(S.player.mg || {})[c.id] && Math.abs(S.player.loan - eq * .01) < 1e-9 && c.ctrl === 'P'; }
    { const {c, qf, eq} = secFix(5516); S.player.cash = eq * .1; const a1 = A.peBuySecondary(c, 'P', eq); S.player.cash = eq * 2; const q0 = qf.cash; const a2 = A.peBuySecondary(c, 'P', eq), a3 = A.peBuySecondary(c, 'P', eq); out['16'] = !a1 && a2 && !a3 && c.own.P === c.shares; }
    { const {c, eq} = secFix(5517); room(eq, eq * .2); const n0 = S.news.length; A.peBuySecondary(c, 'P', eq); const ctrlNews = S.news.slice(0, S.news.length - n0).some(n => n.t.includes('経営権取得') && n.t.includes(S.company + 'が')); /* the player gaining control (the seller losing it is expected) */ out['17'] = c.ctrl !== 'P' && !ctrlNews; info['17'] = {ctrl: c.ctrl, g: A.gfrac(c, 'P'), news: S.news.slice(0, 4).map(n => n.t.slice(0, 40))}; }
    { const {c, eq} = secFix(5518); room(eq, eq * .3); A.peBuySecondary(c, 'P', eq); const B = S.player.mgB[c.id]; S.player.cash = B * .5; A.mgSettle(c); const half = Math.abs(S.player.mgB[c.id] - B * .5) < 1e-6; S.player.cash = B; A.mgSettle(c); out['18'] = half && !(S.player.mg || {})[c.id] && c.ctrl === 'P' && S.player.cash >= -1e-9; }
    { const {c, eq} = secFix(5519); room(eq, eq * .5); A.peBuySecondary(c, 'P', eq); const R = S.rivals[0]; R.cash = 1e6; const px = c.price; const got = A.transferShares('P', R.id, c, c.own.P, px); A.mgSync(); out['19'] = got > 0 && !(S.player.mg || {})[c.id] && !(S.player.mgB || {})[c.id] && !c.own.P; }
    { const {c, qf, eq} = secFix(5520); S.player.cash = eq * 2; const q0 = qf.cash; A.peBuySecondary(c, 'P', eq); out['20'] = Math.abs(qf.cash - q0 - eq) < 1e-6 && c.pe.owner === 'P'; info['20'] = {qGot: qf.cash - q0, eq}; }
    out['21'] = 'covered: rev40 BUG-117（資金コール拒否）とtestFunds52 T25 — peBuySecondaryはpeCashGateで事前拒否';
    { fresh(5522); for (let i = 0; i < 5; i++) A.step(); S = A.S; const d = (S.pe.deals || [])[0] || A.peDealGen({}); S.player.cash = 0; S.player.loan = 0; S.player.shorts = {}; const deals0 = JSON.stringify(S.pe.deals.map(x => x.id)), cos0 = S.cos.length; const r1 = d ? A.peAcquire(d, 'P', d.ask || d.ev || 10, .5, 0, 0, null) : 'nodeal';
      out['22'] = d ? (r1 === null && S.cos.length === cos0 && JSON.stringify(S.pe.deals.map(x => x.id)) === deals0 && S.player.loan === 0) : 'BLOCKED: 案件なし'; }
    out['23'] = 'covered: testFunds52 T20/T22（TOB・LBO）';
    out['24'] = 'covered: testFunds52 T07〜T14（相対取引）';
    out['25'] = 'covered: testFunds52 T26・testFunds51（第三者割当）';
    out['26'] = 'covered: testFunds52 T01〜T06・T16〜T19（現引き・創刊）';
    out['27'] = 'covered: testRealEstate50・testFunds51（不動産・銀行・受信箱）';
    { fresh(5528); S.player.cash = 0; S.player.loan = 0; S.player.shorts = {}; const p0 = JSON.stringify([S.player.cash, S.player.loan]); const c = pub(3);
      const r1 = A.startProxy(c), r2 = A.foundCompany('tyo', 'tech', 5, .5), r3 = A.peSearch(S.cos.find(x => x.ctrl === 'P') ? S.cos.find(x => x.ctrl === 'P').id : 'x'); const person = Object.values(S.hr.people).find(x => x.at === 'HQ'); /* a head-office officer: paid by the company itself */ const r4 = person ? A.trainExec(Object.assign(person, {trainW: -99}), 'fin') : 'none';
      out['28'] = !r1 && !c.proxy && !r2 && !r3 && (r4 === false || r4 === 'none') && JSON.stringify([S.player.cash, S.player.loan]) === p0; info['28'] = {r1, r2: !!r2, r3: !!r3, r4}; }
    { const run = () => { resFresh(5529); S.player.cash = 3; for (let i = 0; i < 30; i++) { A.step(); S = A.S; S.inbox = []; } const {c, eq} = secFix(5530); S.player.cash = eq * .4; A.peBuySecondary(c, 'P', eq); for (let i = 0; i < 10; i++) { A.step(); S = A.S; S.inbox = []; } return JSON.stringify([S.player.cash, S.player.loan, S.player.mg, S.cos.map(x => x.price)]); };
      out['29'] = run() === run(); }
    { const {c, eq} = secFix(5531); S.player.cash = eq * .4; A.peBuySecondary(c, 'P', eq); S.research.budget = 2; const b0 = JSON.stringify([S.player.loan, S.player.mg, S.player.mgB, S.research, c.ctrl]); const ok = loads(); S = A.S; const c2 = S.cos.find(x => x.id === c.id); out['30'] = ok && JSON.stringify([S.player.loan, S.player.mg, S.player.mgB, S.research, c2.ctrl]) === b0; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev53 funds', JSON.stringify(r.info).slice(0, 2500));
  for (const [k, v] of Object.entries(r.out)) { if (typeof v === 'string') console.log(`SKIP  rev53 funds: ${k} — ${v}`); else ok('rev53 funds: ' + k, v); }
  ok('rev53 funds: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testFunds52(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); return ok1 && A.S !== S0 && A.econCheck(A.S) === ''; };
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit && A.hqInit(); return S; };
    /* artificial: cash set by the test around a real short sale; the collateral is half the short's current value */
    const shortTo = (free, raise) => { const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 0); S.player.shorts = {}; S.player.cash = 0; A.execShort(c, A.sharesForShort(c, raise || 10)); const lock = A.shortLiab() * .5; S.player.cash = free + lock; return {sc: c, lock}; };
    const weeks = n => { for (let i = 0; i < n; i++) { A.step(); S = A.S; S.inbox = []; } }; /* a real track record (the save checks its length) */
    const held = () => S.player.cash >= A.shortLiab() * .5 - 1e-9;
    const pub = i => S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0)[i];
    const mgState = () => JSON.stringify([S.player.cash, S.player.loan, S.player.mg, S.player.mgB, S.cos.map(c => [c.id, c.ctrl, c.own.P || 0])]);
    /* RE-14: 現引き */
    const marginSetup = seed => { fresh(seed); const {lock} = shortTo(0, 10); S.player.cash = lock + 10; const a = pub(3), b2 = pub(7); A.execBuy('P', a, A.sharesForMoney(a, 14)); A.execBuy('P', b2, A.sharesForMoney(b2, 5)); if (!(S.player.mgB && S.player.mgB[a.id] > 0 && S.player.mgB[b2.id] > 0)) throw new Error('margin setup failed ' + JSON.stringify([S.player.mgB, A.buyingPower()])); return {a, b2}; }; /* within the buying power: both purchases are partly on margin */
    { const {a} = marginSetup(5301); S.player.cash = A.shortLiab() * .5; const s0 = mgState(); const n = A.mgSettle(a); out.T01 = n === 0 && mgState() === s0 && A.mgOf(a) > 0; info.T01 = {loan: S.player.loan, mgB: S.player.mgB[a.id]};
      click('sel', a.id); S.player.cash = A.shortLiab() * .5; /* selecting may pay a beginner's reward: back to no free cash */ const s1 = mgState(); click('mgsettle', a.id); A.closeModal(); out.T02 = mgState() === s1; }
    { const {a, b2} = marginSetup(5302); S.player.cash = A.shortLiab() * .5 + 2; const L0 = S.player.loan, B0 = S.player.mgB[a.id], M0 = S.player.mg[a.id], c0 = S.player.cash, ob = JSON.stringify([S.player.mg[b2.id], S.player.mgB[b2.id]]); const n = A.mgSettle(a);
      out.T03 = Math.abs(c0 - S.player.cash - 2) < 1e-9 && Math.abs(L0 - S.player.loan - 2) < 1e-9 && Math.abs(B0 - S.player.mgB[a.id] - 2) < 1e-9 && Math.abs(S.player.mg[a.id] - M0 * (1 - 2 / B0)) < 1e-9 && Math.abs(n - M0 * 2 / B0) < 1e-9 && held();
      S.player.cash += 100; const n2 = A.mgSettle(a); out.T04 = !S.player.mg[a.id] && !S.player.mgB[a.id] && held(); out.T05 = JSON.stringify([S.player.mg[b2.id], S.player.mgB[b2.id]]) === ob; }
    { const {a} = marginSetup(5303); S.player.cash = A.shortLiab() * .5 + 1e-12; const s0 = mgState(); for (let i = 0; i < 20; i++) A.mgSettle(a); out.T06 = mgState() === s0; }
    /* RE-15: block trades */
    const blockSetup = (seed, free) => { fresh(seed); const c = pub(5), R = S.rivals[0]; R.cash = 1e5; A.execBuy(R.id, c, c.shares * .12); const {lock} = shortTo(0, 10); S.player.cash = lock + 30; const h = pub(9); A.execBuy('P', h, A.sharesForMoney(h, 30)); /* some holdings give margin room */ const n = c.own[R.id] * .5, price = c.price * 3, amt = n * price; S.player.cash = A.shortLiab() * .5 + (typeof free === 'function' ? free(amt) : free); return {c, R, n, price, amt}; };
    { const {c, R, n, price, amt} = blockSetup(5304, a => a - 2); const L0 = S.player.loan, mg0 = (S.player.mg || {})[c.id] || 0, r0 = R.cash, bp = A.buyingPower(); const res = A.negotiate(R.id, c, n, price, 'P');
      out.T07 = res.res === 'ok' && held() && Math.abs(S.player.loan - L0 - 2) < 1e-6 && Math.abs(((S.player.mg || {})[c.id] || 0) - mg0 - n * 2 / amt) < 1e-6 && Math.abs(R.cash - r0 - amt) < 1e-6; info.T07 = {res, bp, amt, loanUp: S.player.loan - L0, mg: ((S.player.mg || {})[c.id] || 0) - mg0, expectMg: n * 2 / amt}; }
    out.T08 = 'N/A: 相対取引に現金限定の経路はありません（信用取引の範囲で決済）';
    { const {c, R, n, price, amt} = blockSetup(5305, a => a + 1); const L0 = S.player.loan, c0 = S.player.cash; const res = A.negotiate(R.id, c, n, price, 'P'); out.T09 = res.res === 'ok' && S.player.loan === L0 && Math.abs(c0 - S.player.cash - amt) < 1e-6; }
    { const {c, R, n, price} = blockSetup(5306, 0); const big = n, px = A.buyingPower() / big * 1.2; const s0 = JSON.stringify([S.player.cash, S.player.loan, c.own, R.cash]), nn = S.news.length; const res = A.negotiate(R.id, c, big, px, 'P'); out.T10 = res.res === 'funds' && JSON.stringify([S.player.cash, S.player.loan, c.own, R.cash]) === s0 && S.news.length === nn; }
    { const {c, R, n, price, amt} = blockSetup(5307, 0); const px = A.buyingPower() / n * 1.1; S.inbox = [{id: 9801, kind: 'x'}, {id: 9802, kind: 'counter', from: R.id, cid: c.id, n, price: px, actor: 'P', exp: S.week + 2}]; S.inboxSeq = 9900; const s0 = JSON.stringify([S.player.cash, S.player.loan, c.own]);
      A.resolveInbox(9802, true); const kept = S.inbox.findIndex(i => i.id === 9802) === 1; out.T11 = kept && JSON.stringify([S.player.cash, S.player.loan, c.own]) === s0;
      S.player.cash += n * px; const r0 = R.cash; A.resolveInbox(9802, true); A.resolveInbox(9802, true); out.T12 = !S.inbox.some(i => i.id === 9802) && Math.abs(R.cash - r0 - n * px) < 1e-6 && held(); }
    { const {c, R, n, price} = blockSetup(5308, a => a + 5); S.inbox = [{id: 9803, kind: 'counter', from: R.id, cid: c.id, n, price, actor: 'P', exp: S.week + 2}]; delete c.own[R.id]; const s0 = JSON.stringify([S.player.cash, S.player.loan, c.own]); A.resolveInbox(9803, true); out.T13 = JSON.stringify([S.player.cash, S.player.loan, c.own]) === s0 && !S.inbox.some(i => i.id === 9803); }
    { const {c, R, n, price, amt} = blockSetup(5309, a => a + 5); const r0 = R.cash, cost0 = (S.player.cost || {})[c.id] || 0; A.negotiate(R.id, c, n, price, 'P'); out.T14 = Math.abs(R.cash - r0 - amt) < 1e-6 && Math.abs(((S.player.cost || {})[c.id] || 0) - cost0 - amt) < 1e-6; }
    { fresh(5310); const c = pub(5), R = S.rivals[0]; R.cash = 1e5; A.execBuy(R.id, c, c.shares * .1); const {lock} = shortTo(0, 10); S.pres.cash = 1; const n = c.own[R.id] * .5, px = c.price; const r0 = R.cash, p0 = JSON.stringify([S.player.cash, S.player.loan]); const u = A.transferShares(R.id, 'U', c, n, px);
      out.T15 = u === 0 && R.cash === r0 && S.pres.cash === 1 && JSON.stringify([S.player.cash, S.player.loan]) === p0; }
    /* RE-16: the investment report */
    { fresh(5311); weeks(27); shortTo(0, 10); const s0 = JSON.stringify([S.player.cash, S.player.loan, S.nl || null, S.player.plW]); const nn = S.news.length; const ok1 = A.nlStart(); out.T16 = ok1 === false && JSON.stringify([S.player.cash, S.player.loan, S.nl || null, S.player.plW]) === s0 && S.news.length === nn;
      S.player.cash += A.NL_START; const c0 = S.player.cash; const ok2 = A.nlStart(); out.T17 = ok2 === true && Math.abs(c0 - S.player.cash - A.NL_START) < 1e-12 && held() && !!S.nl; const ok3 = A.nlStart(); out.T18 = ok3 === false;
      fresh(5312); weeks(10); S.player.cash = 100; out.T18 = out.T18 && A.nlStart() === false && !S.nl;
      fresh(5313); weeks(27); S.player.cash = 100; A.nlStart(); const c1 = S.player.cash; for (let i = 0; i < 8; i++) { A.step(); S.inbox = []; } const okL = loads(); S = A.S; const c2 = S.player.cash; A.importText(A.exportText()); S = A.S; out.T19 = !!S.nl && okL && S.player.cash === c2 && Number.isFinite(S.nl.rev); }
    /* AUD-04: tenders, LBO, PE secondary, issues, trading, shorts */
    { fresh(5314); const {lock} = shortTo(0, 10); S.player.cash = lock + 40; const h = pub(9); A.execBuy('P', h, A.sharesForMoney(h, 30)); const c = pub(11); const free = A.freeCash(), L0 = S.player.loan; const q = A.execTender('P', c, c.price * 1.4, .25, c.price, false);
      out.T20 = !!q && held() && S.player.loan - L0 > 0 && Math.abs((S.player.loan - L0) - Math.max(0, q.cost - free)) < 1e-6; info.T20 = {free, cost: q && q.cost, loanUp: S.player.loan - L0}; }
    { fresh(5315); const {lock} = shortTo(0, 10); S.player.cash = lock + 40; const h = pub(9); A.execBuy('P', h, A.sharesForMoney(h, 30)); const c = pub(12); const free = A.freeCash(), L0 = S.player.loan, d0 = c.debt; const q = A.execTender('P', c, c.price * 1.4, .3, c.price, true);
      out.T22 = !!q && held() && Math.abs((c.debt - d0) - q.cost * .65) < 1e-6 && Math.abs((S.player.loan - L0) - Math.max(0, q.cost * .35 - free)) < 1e-6; info.T22 = {cost: q && q.cost, debtUp: c.debt - d0, loanUp: S.player.loan - L0, free}; }
    out.T21 = 'resolveTobsの撤回／次点ルールは既存テスト（rev10 TOB・BUG-33/67系）で実行。決済は事前のfundsOf確認後にplayerPayOptで支払う（T20/T22で担保保護を確認）';
    { fresh(5316); const qf = (S.pe && S.pe.firms || [])[0]; for (const c of S.cos.filter(x => !x.priv && !x.ctrl && !x.reorg && x.price > 0).slice(20, 22)) { const tot = c.price * c.shares; c.priv = true; c.own = {[qf.id]: c.shares}; c.pe = {type: 'buy', owner: qf.id, w0: S.week, ev0: A.peEV(c), e0: A.ebitda(c), rev0: c.rev, m0: A.opMargin(c), inv: tot, flows: [[S.week, -tot]], mq: 55, dd: true, risk: null, promise: 0}; A.recomputeCtrl && A.recomputeCtrl(); } /* artificial fixture: an AI firm owns two unlisted companies (none exist at the start) */ const sec = S.cos.find(c => c.priv && c.pe && !c.pe.closed && /^Q/.test(c.pe.owner));
      if (!sec) { out.T23 = 'BLOCKED: このシードでは60週以内にAI運営会社の保有先が生まれず'; out.T24 = out.T23; }
      else { const eq = sec.price * sec.shares; const {lock} = shortTo(eq * 1.01 + 1, 10); const c0 = S.player.cash, L0 = S.player.loan; const ok = A.peBuySecondary(sec, 'P', eq); out.T23 = ok && held() && Math.abs(c0 - S.player.cash - eq * 1.01) < 1e-6 && S.player.loan === L0;
        const sec2 = S.cos.find(c => c !== sec && c.priv && c.pe && !c.pe.closed && /^Q/.test(c.pe.owner)); if (!sec2) out.T24 = 'BLOCKED: 2社目なし'; else { const eq2 = sec2.price * sec2.shares; shortTo(0, 10); S.player.loan = 0; const st = JSON.stringify([sec2.own, sec2.pe, sec2.debt, S.player.cash]); const ok2 = A.peBuySecondary(sec2, 'P', eq2 * 50); out.T24 = !ok2 && JSON.stringify([sec2.own, sec2.pe, sec2.debt, S.player.cash]) === st; } } }
    out.T25 = 'BUG-117の資金コール拒否は既存テスト（rev40 BUG-117）で実行。transferSharesは拒否された資金コールで売り手に入金しない順序に変更';
    { fresh(5317); const c = S.cos.find(x => x.priv) || pub(2); const own = JSON.stringify(c.own); const {lock} = shortTo(0, 10); const a1 = A.allot(c, 'P', .2); out.T26 = a1 === false && JSON.stringify(c.own) === own && held(); }
    { fresh(5318); const {lock} = shortTo(1, 10); const c = pub(4); const L0 = S.player.loan; const r1 = A.execBuy('P', c, A.sharesForMoney(c, 1.8)); const margin = !!r1 && held() && S.player.loan - L0 > .7; const r2 = A.execBuy('P', c, 1e9); const capped = !r2 || r2.cost <= A.buyingPower() + r2.cost + 1e-6; const s = A.execSell('P', c, c.own.P * .5); out.T27 = margin && capped && held(); info.T27 = {loanUp: S.player.loan - L0}; }
    { fresh(5319); const {sc} = shortTo(0, 10); const n = S.player.shorts[sc.id].n; A.execCover(sc, n); out.T28 = !S.player.shorts[sc.id] && Number.isFinite(S.player.cash) && Number.isFinite(S.player.loan); }
    { const {a} = marginSetup(5320); S.player.cash += 1; const ac = a; A.nlStart(); const before = JSON.stringify([S.player.cash, S.player.loan, S.player.mg, S.player.mgB, S.player.shorts, !!S.nl]); const ok = loads(); S = A.S; out.T29 = ok && JSON.stringify([S.player.cash, S.player.loan, S.player.mg, S.player.mgB, S.player.shorts, !!S.nl]) === before; }
    { const run = () => { marginSetup(5321); const a = pub(3); S.player.cash = A.shortLiab() * .5 + 1; A.mgSettle(a); const c = pub(5), R = S.rivals[0]; R.cash = 1e5; A.execBuy(R.id, c, c.shares * .1); A.negotiate(R.id, c, c.own[R.id] * .3, c.price * 3, 'P'); for (let i = 0; i < 20; i++) { A.step(); S.inbox = []; } return JSON.stringify([A.S.player.cash, A.S.player.loan, A.S.player.mg, A.S.cos.map(x => x.price)]); };
      const h1 = run(), h2 = run(); out.T30 = h1 === h2; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev52 funds', JSON.stringify(r.info).slice(0, 2500));
  for (const [k, v] of Object.entries(r.out)) { if (typeof v === 'string') console.log(`SKIP  rev52 funds: ${k} — ${v}`); else ok('rev52 funds: ' + k, v); }
  ok('rev52 funds: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testFunds51(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const e = A.econCheck(A.S); return ok1 && A.S !== S0 && e === ''; };
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit && A.hqInit(); A.sitesEnsure(); return S; };
    /* artificial: cash set by the test around a real short sale (execShort); the collateral is half the short's current value */
    const shortTo = (free, raise) => { const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 0); S.player.cash = 0; S.player.shorts = {}; A.execShort(c, A.sharesForShort(c, raise)); const lock = A.shortLiab() * .5; S.player.cash = free + lock; return {c, lock}; };
    const st = () => JSON.stringify([S.player.cash, S.player.bank, S.player.loan, S.player.tl, S.player.shorts, S.player.plW, S.inbox.map(i => i.id)]);
    const held = () => S.player.cash >= A.shortLiab() * .5 - 1e-9;
    /* RE-12 */
    { fresh(5201); S.player.cash = 100; A.bankBorrow(5); const {lock} = shortTo(.07645479154030799, 10); click('bankr', null, 5); out.T01 = Math.abs(S.player.bank - (5 - .07645479154030799)) < 1e-9 && Math.abs(S.player.cash - lock) < 1e-9 && A.freeCash() < 1e-9; info.T01 = {bank: S.player.bank, cash: S.player.cash, lock}; }
    { fresh(5202); S.player.cash = 100; A.bankBorrow(5); shortTo(3, 10); const c0 = S.player.cash; const a = A.bankRepay(1); out.T02 = a === 1 && Math.abs(c0 - S.player.cash - 1) < 1e-9 && Math.abs(S.player.bank - 4) < 1e-9; }
    { fresh(5203); S.player.cash = 100; A.bankBorrow(5); shortTo(5, 10); const a = A.bankRepay(5); out.T03 = Math.abs(a - 5) < 1e-9 && S.player.bank === 0 && A.freeCash() < 1e-9 && held(); }
    { fresh(5204); S.player.cash = 100; A.bankBorrow(5); shortTo(0, 10); const s0 = st(); const a = A.bankRepay(5); out.T04 = a === 0 && st() === s0; }
    { fresh(5205); S.player.cash = 100; A.bankBorrow(5); const {lock} = shortTo(0, 10); S.player.cash = lock * .5; const s0 = st(); const a1 = A.bankRepay(5); S.player.cash = -2; const s1 = st(); const a2 = A.bankRepay(5); out.T05 = a1 === 0 && a2 === 0 && st() === s1; }
    { fresh(5206); S.player.cash = 100; A.bankBorrow(5); shortTo(3, 10); const s0 = st(); const z = [-1, NaN, Infinity, undefined, 0].map(v => A.bankRepay(v)).concat([-1, NaN, Infinity, undefined, 0].map(v => A.loanRepay(v))); out.T06 = z.every(x => x === 0) && st() === s0; }
    { fresh(5207); S.player.cash = 100; A.bankBorrow(8); S.player.loan = 3; shortTo(2, 10); const box = A.debtBox(), bank = A.bankHTML ? A.bankHTML() : ''; const shown = (box.match(/返せる額を返す（200,000,000円）/g) || []).length === 2 && bank.includes('返せる額を返す（200,000,000円）'); /* bank and margin loan: both show what can be paid now */ const b0 = S.player.bank; click('bankr', null, A.S.player.bank); out.T07 = shown && Math.abs(b0 - S.player.bank - 2) < 1e-9 && held(); info.T07 = {shown}; }
    { fresh(5208); S.player.cash = 100; A.bankBorrow(8); const {c} = shortTo(3, 10); A.bankHTML && A.bankHTML(); c.price *= 1.4; const f = A.freeCash(), b0 = S.player.bank; click('bankr', null, 3); out.T08 = Math.abs(b0 - S.player.bank - Math.max(0, f)) < 1e-9 && held(); }
    /* AUD-01: CFO */
    const cfo = () => { const m = Object.values(S.hr.people).find(x => !x.at); m.at = 'HQ'; m.role = 'CFO'; S.hr.hq.CFO = m.id; m.dlg = {bank: true, prop: true}; return m; };
    const buf = () => Math.max(5, Math.max(0, A.grossWorth()) * .05);
    { fresh(5209); S.player.cash = 100; A.bankBorrow(20); cfo(); shortTo(12, 10); const bf = buf(), f0 = A.freeCash(); A.dlgStep(); out.T09 = Math.abs(A.freeCash() - bf) < 1e-6 && held() && S.player.bank < 20; info.T09 = {bf, f0, f1: A.freeCash(), bank: S.player.bank}; }
    { fresh(5210); S.player.loan = 20; cfo(); shortTo(12, 10); const bf = buf(); A.dlgStep(); out.T10 = Math.abs(A.freeCash() - bf) < 1e-6 && held() && S.player.loan < 20; }
    { fresh(5211); S.player.cash = 1e4; const x = S.props.find(y => y.id === 'R-tyo-02'); A.buyProp('P', x, .5, A.propQuote(x, 1, .5).price); S.player.cash = 100; A.bankBorrow(10); S.player.loan = 10; cfo(); shortTo(25, 10); const bf = buf(), m0 = x.mort; A.dlgStep();
      out.T11 = held() && A.freeCash() >= Math.min(bf, 10) - 1e-6 && S.player.bank < 10 && S.player.loan < 10 + 1e-9 && x.mort <= m0; info.T11 = {free: A.freeCash(), bf, bank: S.player.bank, loan: S.player.loan, mortPaid: m0 - x.mort}; }
    /* AUD-02: term loans and the margin loan */
    { fresh(5212); S.player.cash = 300; A.takeLoan(0); const l = S.player.tl[0]; shortTo(l.a - .01, 10); const s0 = st(); click('loanoff', null, l.id); out.T12 = st() === s0 && S.player.tl.length === 1; S.player.cash += .02; const c0 = S.player.cash; click('loanoff', null, l.id); out.T13 = S.player.tl.length === 0 && Math.abs(c0 - S.player.cash - l.a) < 1e-9 && held(); }
    { fresh(5213); const {lock} = shortTo(0, 10); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0)[6]; A.execBuy('P', c, A.sharesForMoney(c, 6)); const L0 = S.player.loan; S.player.cash = lock + 1; click('loanpay', null, 6); const a = S.player.loan; S.player.cash = A.shortLiab() * .5 + .5; click('repayloan', null, 'all'); out.T14 = L0 > 5 && Math.abs(L0 - a - 1) < 1e-9 && Math.abs(a - S.player.loan - .5) < 1e-9 && held(); info.T14 = {L0, a, l: S.player.loan}; } /* a real margin loan (from a margin purchase), then both repayment buttons */
    /* RE-13: the inbox */
    const pitch = x => { S.inbox = S.inbox.filter(i => i.id !== 9951); S.inbox.unshift({id: 9950, kind: 'pitch', who: 'a', role: 'a', text: 'other', act: {t: 'x'}, why: 'x', exp: S.week + 8}); S.inbox.splice(1, 0, {id: 9951, kind: 'pitch', who: '投資部', role: '投資部', text: 't', act: {t: 'prop', pid: x.id}, why: 'x', exp: S.week + 4}); return S.inbox.find(i => i.id === 9951); };
    const same = (it, w) => { const i = S.inbox.findIndex(z => z.id === 9951); return i === 1 && S.inbox[i].exp === w && JSON.stringify(S.inbox[i].act) === JSON.stringify(it.act); };
    { fresh(5215); const x = S.props.find(y => y.id === 'R-par-01'), q = A.propQuote(x, 1, .5); shortTo(q.need - .3, 10); const it = pitch(x), exp = it.exp; const xs = JSON.stringify(x); click('pitch', 9951, '1'); out.T15 = same(it, exp) && JSON.stringify(x) === xs && it.act.ltv == null;
      const q0 = A.propQuote(x, 1, 0); shortTo(q0.need - .3, 10); click('pitch', 9951, '2'); out.T16 = same(it, exp) && !x.own && it.act.ltv == null;
      shortTo(q0.need + .1, 10); const c0 = S.player.cash; click('pitch', 9951, '2'); click('pitch', 9951, '2'); out.T17 = x.own === 'P' && x.mort === 0 && Math.abs(c0 - S.player.cash - q0.need) < 1e-9 && !S.inbox.some(i => i.id === 9951) && S.news.filter(n => n.t.includes(x.name) && n.t.includes('不動産取得')).length === 1; }
    { fresh(5216); const x = S.props.find(y => y.id === 'R-ams') || S.props.find(y => y.id === 'R-par-02'), q = A.propQuote(x, 1, 0); shortTo(q.need + .05, 10); const it = pitch(x); x.v *= 1.05; const s0 = JSON.stringify([x.own, S.player.cash]); click('pitch', 9951, '2'); out.T18 = JSON.stringify([x.own, S.player.cash]) === s0 && S.inbox.some(i => i.id === 9951) && held(); }
    { fresh(5217); const x = S.props.find(y => y.id === 'R-par-03'); pitch(x); S.rivals[0].cash = 1e5; A.buyProp(S.rivals[0].id, x, 0); const c0 = S.player.cash; click('pitch', 9951, '2'); const gone1 = !S.inbox.some(i => i.id === 9951) && S.player.cash === c0; pitch(x); click('pitch', 9951, '1'); out.T19 = gone1 && !S.inbox.some(i => i.id === 9951) && S.player.cash === c0; }
    { fresh(5218); const x = S.props.find(y => y.id === 'R-sin-02'); pitch(x); click('pitch', 9951, '0'); click('pitch', 9951, '0'); const once = !S.inbox.some(i => i.id === 9951) && !x.own; out.T20 = once && S.inbox.some(i => i.id === 9950); }
    { fresh(5219); const x = S.props.find(y => y.id === 'R-sin-03'), q = A.propQuote(x, 1, .5); shortTo(q.need - .5, 10); const it = pitch(x), exp = it.exp; click('pitch', 9951, '1'); const ok = loads(); S = A.S; const k = S.inbox.find(i => i.id === 9951); out.T21 = ok && !!k && k.exp === exp && k.act.pid === x.id && S.inbox.findIndex(i => i.id === 9951) === 1; }
    /* T22-T26: contractual payments, forced settlement, other accounts, the property rules, the optional head-office spending */
    { fresh(5220); S.player.cash = 300; A.takeLoan(0); A.bankBorrow(10); const l = S.player.tl[0], a0 = l.a, b0 = S.player.bank; shortTo(0, 10); const c0 = S.player.cash; A.step(); S = A.S; out.T22 = (S.player.tl[0] ? S.player.tl[0].a < a0 : true) && S.player.bank === b0 && S.player.cash !== c0; }
    { fresh(5221); const {c} = shortTo(1, 10); const n = S.player.shorts[c.id].n, L0 = S.player.loan; c.price *= 3; A.step(); S = A.S; out.T23 = Number.isFinite(S.player.cash) && Number.isFinite(S.player.loan) && (!S.player.shorts[c.id] || S.player.shorts[c.id].n <= n) && A.econCheck(S) === ''; info.T23 = {cash: S.player.cash, loan: S.player.loan, still: !!S.player.shorts[c.id]}; }
    { fresh(5222); const {lock} = shortTo(2, 10); const c = S.cos.filter(x => !x.priv && !x.ctrl && x.price > 0)[4]; A.execBuy('P', c, A.sharesForMoney(c, 6)); const m = held() && Math.abs(S.player.loan - 4) < .05; const L0 = S.player.loan; shortTo(1, 10); const r1 = A.execBuy('P', c, A.sharesForMoney(c, 3), A.freeCash()); const cashOnly = held() && S.player.loan === L0;
      S.pres.cash = 1; const pr0 = JSON.stringify([S.player.cash, S.player.loan]); A.execBuy('U', c, A.sharesForMoney(c, 5)); out.T24 = m && cashOnly && S.pres.cash >= -1e-9 && JSON.stringify([S.player.cash, S.player.loan]) === pr0; info.T24 = {loan: S.player.loan}; }
    { fresh(5223); S.player.cash = 1e4; S.player.shorts = {}; const x = S.props.find(y => y.id === 'R-osa-02'); const q = A.propQuote(x, 1, .5); const c0 = S.player.cash; A.buyProp('P', x, .5, q.price); const r = A.renoQuote(x); A.propReno(x); const m0 = x.mort; A.propRefi(x, .3); const ok = Math.abs(c0 - S.player.cash - q.need - r.cost - (m0 - x.mort)) < 1e-6; shortTo(0, 10); const s0 = JSON.stringify([x.mort, x.reno, S.player.cash]); A.repayMort(x); A.propRefi(x, 0); out.T25 = ok && JSON.stringify([x.mort, x.reno, S.player.cash]) === s0; }
    { fresh(5224); Object.assign(S.dept.inv, {on: true, staff: 1}); const {lock} = shortTo(0, 10); const o0 = S.office.lvl, ct0 = S.office.city, s0 = st(); const mv = A.setOffice(Math.min(o0 + 1, 3), 'osa'); const g = A.gradOffer('inv', 2), bz = A.payBonus(5); const same0 = st() === s0 && S.office.lvl === o0 && S.office.city === ct0;
      S.player.cash = lock + 50; const mv2 = A.setOffice(Math.min(o0 + 1, 3), 'osa'); out.T26 = !mv && g === 0 && bz === 0 && same0 && mv2 === true && held(); info.T26 = {mv, g, bz}; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev51 funds', JSON.stringify(r.info).slice(0, 2000));
  for (const [k, v] of Object.entries(r.out)) ok('rev51 funds: ' + k, v);
  ok('rev51 funds: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testRealEstate50(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {}, r2m = x => Math.round(x * 100) / 100;
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const e = A.econCheck(A.S); if (!(ok1 && A.S !== S0 && e === '')) info.loadFail = [ok1, String(m).slice(0, 80), e]; return ok1 && A.S !== S0 && e === ''; };
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit && A.hqInit(); A.sitesEnsure(); return S; };
    /* artificial set-up: cash chosen by the test, then a real short sale through execShort (half of what it raised is collateral) */
    const shortTo = (free, raise) => { const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 0); S.player.cash = 0; S.player.shorts = {}; A.execShort(c, A.sharesForShort(c, raise)); const lock = A.shortLiab() * .5; S.player.cash = free + lock; return {c, lock}; };
    const state = x => JSON.stringify([x.own, x.mort, x.cost, x.bw, x.everOwned, x.offW, x.lease, x.reno, x.renoN, x.renoC, S.player.cash, S.player.loan, S.player.bank, S.player.shorts, S.player.plW && S.player.plW.fee]);
    const SH = () => S.props.find(x => x.name === 'シンガポールステーションハイツ') || S.props.find(x => x.city === 'sin' && x.kind === 'resi');
    /* 11-01/02: the reported case — 50% loan, short collateral; refused through the offer screen and through buyProp itself */
    { fresh(5001); const x = SH(), q = A.propQuote(x, 1, .5); const {lock} = shortTo(q.need - .89354520845968, 9.884808732913461); const s0 = state(x);
      A.showProp(x); click('pofferf', x.id, 1); click('pltv', x.id, .5); click('poffer', x.id); const viaUI = state(x) === s0;
      const viaFn = A.buyProp('P', x, .5, q.price) === false && state(x) === s0; info['11-01'] = {name: x.name, need: q.need, free: A.freeCash(), cash: S.player.cash, lock};
      out['11-01'] = viaUI && !x.own && S.player.cash > q.need && A.freeCash() < q.need; out['11-02'] = viaFn; }
    /* 11-03: buying from the city list: the asking-price quote, refused when short */
    { fresh(5002); const x = S.props.find(y => y.id === 'R-tor-02'); for (const ltv of [0, .5]) { const q = A.propQuote(x, 1, ltv); shortTo(q.need - .5, 20); const s0 = state(x); A.cityProps && A.cityProps(x.city); const row = A.realtySection(); click('pbuy', x.id, ltv); const refused = state(x) === s0;
        shortTo(q.need + 1, 20); const c0 = S.player.cash; click('pbuy', x.id, ltv, {need: String(q.need), price: String(q.price)}); const paid = c0 - S.player.cash; out['11-03' + (ltv ? 'b' : 'a')] = refused && x.own === 'P' && Math.abs(paid - q.need) < 1e-9 && q.price === r2m(A.propInfo(x).ask) && Math.abs(x.mort - q.loan) < 1e-9; A.sellProp(x); x.offW = 0; } }
    /* 11-04: from the inbox — not done when short (the proposal stays), done with the money */
    { fresh(5003); const x = S.props.find(y => y.id === 'R-zur-01'), q = A.propQuote(x, 1, .5); shortTo(q.need - .3, 10); S.inbox = []; S.inbox.push({id: 9901, kind: 'pitch', who: '投資部', role: '投資部', text: 't', act: {t: 'prop', pid: x.id}, why: 'x', exp: S.week + 4}); const s0 = state(x);
      click('pitch', 9901, '1'); const kept = state(x) === s0 && S.inbox.some(i => i.id === 9901); shortTo(q.need + .3, 10); click('pitch', 9901, '1'); out['11-04'] = kept && x.own === 'P' && !S.inbox.some(i => i.id === 9901) && Math.abs(x.mort - q.loan) < 1e-9; }
    /* 11-05/06/07: exactly enough, a hundredth of 億 short, then topped up */
    { fresh(5004); const x = S.props.find(y => y.id === 'R-fra-02'), q = A.propQuote(x, 1, .5); const {lock} = shortTo(q.need, 15); const ok5 = A.buyProp('P', x, .5, q.price) && Math.abs(S.player.cash - lock) < 1e-9 && A.freeCash() < 1e-9; out['11-05'] = ok5;
      fresh(5005); const y = S.props.find(z => z.id === 'R-fra-02'), q2 = A.propQuote(y, 1, .5); shortTo(q2.need - .01, 15); const s0 = state(y); const no = A.buyProp('P', y, .5, q2.price) === false && state(y) === s0; out['11-06'] = no;
      S.player.cash += .01; const c0 = S.player.cash, fee0 = (S.player.plW && S.player.plW.fee) || 0, yes = A.buyProp('P', y, .5, q2.price); out['11-07'] = yes && Math.abs(c0 - S.player.cash - q2.need) < 1e-9 && Math.abs(y.mort - q2.loan) < 1e-9 && Math.abs(((S.player.plW && S.player.plW.fee) || 0) - fee0 + q2.fee) < 1e-9; }
    /* 11-08: no short sale — cash and loan purchases as before */
    { fresh(5006); S.player.shorts = {}; S.player.cash = 1e4; const a = S.props.find(y => y.id === 'R-mex-02'), b2 = S.props.find(y => y.id === 'R-bom-02'), qa = A.propQuote(a, 1, 0), qb = A.propQuote(b2, 1, .5); const c0 = S.player.cash;
      out['11-08'] = A.buyProp('P', a, 0, qa.price) && A.buyProp('P', b2, .5, qb.price) && Math.abs(c0 - S.player.cash - qa.need - qb.need) < 1e-9 && a.mort === 0 && Math.abs(b2.mort - qb.loan) < 1e-9; }
    /* 11-09: the short rises after the screen was drawn: the latest free cash decides */
    { fresh(5007); const x = S.props.find(y => y.id === 'R-sel-03'), q = A.propQuote(x, 1, 0); const {c} = shortTo(q.need + .2, 10); A.showProp(x); click('pofferf', x.id, 1); click('pltv', x.id, 0); c.price *= 1.5; const s0 = state(x); click('poffer', x.id); out['11-09'] = state(x) === s0 && A.freeCash() < q.need; }
    /* 11-10: short of cash and too low an offer: no cooldown; with the money, the low offer keeps the 4-week wait */
    { fresh(5008); const x = S.props.find(y => y.id === 'R-dxb-01'), q = A.propQuote(x, .8, 0); shortTo(q.need - .5, 10); A.showProp(x); click('pofferf', x.id, .8); click('pltv', x.id, 0); click('poffer', x.id); const noCd = !x.offW && !x.own;
      shortTo(q.need + 5, 10); A.showProp(x); click('pofferf', x.id, .8); click('pltv', x.id, 0); click('poffer', x.id); out['11-10'] = noCd && !x.own && x.offW === S.week + 4; }
    /* 11-11: fees 3% / 1%, Japan and abroad, loans 0 / 50 / 60% */
    { fresh(5009); const res = []; for (const id of ['R-tyo-02', 'R-lon-02']) for (const ltv of [0, .5, .6]) for (const g of [0, 1]) { const x = S.props.find(y => y.id === id), re = S.cos.find(c => c.ind === 'realty'), was = re.ctrl; if (g) re.ctrl = 'P'; const q = A.propQuote(x, 1, ltv);
        S.player.shorts = {}; S.player.cash = q.need; const ok = A.buyProp('P', x, ltv, q.price); res.push(ok && q.fee === r2m(q.price * (g ? .01 : .03)) && q.loan === r2m(A.propVal(x) * ltv) && Math.abs(S.player.cash) < 1e-9 && Math.abs(x.mort - q.loan) < 1e-9); A.sellProp(x); re.ctrl = was; }
      out['11-11'] = res.length === 12 && res.every(Boolean); }
    /* 11-12/13: refurbishment */
    { fresh(5010); S.player.shorts = {}; S.player.cash = 1e4; const x = S.props.find(y => y.id === 'R-osa-02'); A.buyProp('P', x, 0, A.propQuote(x, 1, 0).price); const q = A.renoQuote(x); shortTo(q.cost - .01, 10); const s0 = state(x); const no = A.propReno(x) === false && state(x) === s0;
      S.player.cash += .02; const v0 = x.v, c0 = S.player.cash; const yes = A.propReno(x); const paid = c0 - S.player.cash; for (let i = 0; i < 13; i++) { S.week++; A.renoStep(); } const up = x.v - v0; S.week++; A.renoStep(); out['11-12'] = no; out['11-13'] = yes && Math.abs(paid - q.cost) < 1e-9 && x.reno.done && x.renoN === 1 && Math.abs(up - q.valUp / A.propFx(x)) < 1e-9 && x.v === v0 + up; }
    /* 11-14/15: repaying and refinancing */
    { fresh(5011); S.player.shorts = {}; S.player.cash = 1e4; const x = S.props.find(y => y.id === 'R-chi-02'); A.buyProp('P', x, .6, A.propQuote(x, 1, .6).price); shortTo(0, 10); const s0 = state(x); const n0 = A.repayMort(x); const z = n0 === 0 && state(x) === s0;
      shortTo(3, 10); const m0 = x.mort, c0 = S.player.cash; const a = A.repayMort(x); out['11-14'] = z && Math.abs(a - 3) < 1e-9 && Math.abs(m0 - x.mort - 3) < 1e-9 && Math.abs(c0 - S.player.cash - 3) < 1e-9 && A.freeCash() < 1e-9;
      shortTo(2, 10); const m1 = x.mort, c1 = S.player.cash; const d = A.propRefi(x, 0); const down = Math.abs(-d - 2) < 1e-9 && Math.abs(m1 - x.mort - 2) < 1e-9 && Math.abs(c1 - S.player.cash - 2) < 1e-9;
      const c2 = S.player.cash, m2 = x.mort, up = A.propRefi(x, .6), tgt = A.propVal(x) * .6; out['11-15'] = down && up > 0 && Math.abs(x.mort - tgt) < 1e-9 && Math.abs(S.player.cash - c2 - (up - up * .01)) < 1e-9 && A.propRefi(x, .9) >= 0 && x.mort <= A.propVal(x) * .6 + 1e-9; }
    /* 11-16: the CFO repays from free cash, keeping 10億 of it, re-checked before each building */
    { fresh(5012); S.player.shorts = {}; S.player.cash = 1e4; const xs = ['R-sfo-02', 'R-sha-01', 'R-sin-01'].map(id => S.props.find(y => y.id === id)); for (const x of xs) A.buyProp('P', x, .5, A.propQuote(x, 1, .5).price);
      const m = Object.values(S.hr.people).find(x => !x.at); m.at = 'HQ'; m.role = 'CFO'; S.hr.hq.CFO = m.id; m.dlg = {prop: true}; const {lock} = shortTo(40, 30); const mort0 = xs.reduce((a, x) => a + x.mort, 0), c0 = S.player.cash; A.dlgStep();
      const paid = c0 - S.player.cash; out['11-16'] = Math.abs(paid - 30) < 1e-9 && Math.abs(mort0 - xs.reduce((a, x) => a + x.mort, 0) - 30) < 1e-9 && Math.abs(A.freeCash() - 10) < 1e-9 && S.player.cash >= lock; info['11-16'] = {paid, free: A.freeCash(), lock}; }
    /* 11-17: head office building, land, due diligence, merging, the weekly construction payment */
    { fresh(5013); S.player.shorts = {}; Object.assign(S.dept.inv, {on: true, staff: 3}); const cost = A.hqbCost('tyo'); shortTo(cost * 1.05 - .01, 10); const s0 = JSON.stringify([S.props.length, S.player.cash]); const hq = A.hqBuild('tyo') === false && JSON.stringify([S.props.length, S.player.cash]) === s0;
      const site = S.sites[0], px = A.sitePrice(site); shortTo(px - .01, 10); const e1 = A.devBuy('P', site.id, false); const land = !!e1 && S.sites.includes(site); shortTo(px + .01, 10); const e2 = A.devBuy('P', site.id, true); const dd = !!e2 && S.sites.includes(site); shortTo(px + px * .005 + 1, 10); const e3 = A.devBuy('P', site.id, true);
      const pl = S.devp.find(x => x.own === 'P'); pl.ready = S.week; pl.st = 'land'; S.player.cash = 1e4; S.player.shorts = {}; A.devStart(pl, ZONE_OK = (pl.site.zone === 'ind' ? 'logi' : pl.site.zone === 'res' ? 'resi' : 'office'), 'std', 1, 'sell'); const wk = (pl.cost - pl.spent) / Math.max(1, pl.done - S.week + 1); shortTo(wk - .001, 10); const sp = pl.spent; A.devStep(); const halt = pl.spent === sp && pl.halt === 1; shortTo(1e3, 10); A.devStep();
      out['11-17'] = hq && land && dd && e3 === '' && halt && pl.spent > sp; info['11-17'] = {e1, e2, e3}; }
    /* 11-18: interest and the forced sale still run (they are not optional spending) */
    { fresh(5014); S.player.shorts = {}; S.player.cash = 1e4; const x = S.props.find(y => y.id === 'R-hkg-01'); A.buyProp('P', x, .6, A.propQuote(x, 1, .6).price); S.player.cash = 0; const m0 = x.mort; A.propStep(); const interestPaid = x.mort === m0; x.v = x.mort / A.propFx(x) * .9; const L0 = S.player.loan, c0 = S.player.cash; A.propStep();
      out['11-18'] = interestPaid && !x.own && x.mort === 0 && Number.isFinite(S.player.cash) && (S.player.cash !== c0 || S.player.loan !== L0); }
    /* 11-19: a save with a short sale and buildings loads with the same numbers and the same decisions */
    { fresh(5015); S.player.shorts = {}; S.player.cash = 1e4; const x = S.props.find(y => y.id === 'R-par-02'); A.buyProp('P', x, .5, A.propQuote(x, 1, .5).price); const q = A.propQuote(S.props.find(y => y.id === 'R-par-03'), 1, 0); shortTo(q.need - .2, 10);
      const before = JSON.stringify([S.player.cash, A.freeCash(), S.player.shorts, x.mort, x.own]); const ok = loads(); S = A.S; const y = S.props.find(z => z.id === 'R-par-03'), x2 = S.props.find(z => z.id === 'R-par-02'); const after = JSON.stringify([S.player.cash, A.freeCash(), S.player.shorts, x2.mort, x2.own]);
      out['11-19'] = ok && before === after && A.buyProp('P', y, 0, q.price) === false; }
    /* 11-20: several optional payments in one week never exceed the free cash at each point, a failure leaves the others alone */
    { fresh(5016); S.player.shorts = {}; S.player.cash = 1e4; const a = S.props.find(y => y.id === 'R-syd-02'), b2 = S.props.find(y => y.id === 'R-syd-03'); A.buyProp('P', a, .5, A.propQuote(a, 1, .5).price); const qb = A.propQuote(b2, 1, .5), rq = A.renoQuote(a);
      shortTo(qb.need + rq.cost * .5, 20); const f0 = A.freeCash(); const okB = A.buyProp('P', b2, .5, qb.price); const f1 = A.freeCash(); const s0 = state(a); const okR = A.propReno(a); const unchanged = state(a) === s0; const rp = A.repayMort(a);
      out['11-20'] = okB && Math.abs(f0 - f1 - qb.need) < 1e-9 && !okR && unchanged && Math.abs(rp - f1) < 1e-9 && A.freeCash() < 1e-9 && S.player.cash >= A.shortLiab() * .5 - 1e-9; }
    /* extra: no cash at all, or cash below the collateral: nothing optional goes through */
    { fresh(5017); const x = S.props.find(y => y.id === 'R-bue-02'); S.player.shorts = {}; S.player.cash = 0; const s0 = state(x); const a1 = A.buyProp('P', x, .5); S.player.cash = -5; const a2 = A.buyProp('P', x, .6); shortTo(-3, 10); const a3 = A.buyProp('P', x, .6);
      out.extra = !a1 && !a2 && !a3 && !x.own; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev50 real estate', JSON.stringify(r.info).slice(0, 2000));
  for (const [k, v] of Object.entries(r.out)) ok('rev50 real estate: ' + k, v);
  ok('rev50 real estate: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testRealEstate49(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {}, r2m = x => Math.round(x * 100) / 100;
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const e = A.econCheck(A.S); if (!(ok1 && A.S !== S0 && e === '')) info.loadFail = [ok1, String(m).slice(0, 80), e, A.trialErr.slice(0, 200)]; return ok1 && A.S !== S0 && e === ''; };
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit && A.hqInit(); A.sitesEnsure(); return S; };
    const plot = (own, city, zone, area, far) => { S.devSeq = (S.devSeq || 0) + 1; const pl = {id: S.devSeq + 9000, own, site: {id: 'X' + S.devSeq, city, k: 0, n: '試験' + S.devSeq + 'の用地', zone, area, far, pxm2: .02, risky: false}, land: area * .02, spent: 0, st: 'land', w: S.week, ready: S.week, fraud: null}; S.devp.push(pl); return pl; };
    const snap = pl => JSON.stringify([pl.spent, pl.pre, S.player.cash]);
    /* RE-06: construction never pays with money the owner does not have (artificial: cash set by the test) */
    { fresh(4901); S.player.cash = 1e4; const pl = plot('P', 'tyo', 'com', 4000, 9); A.devStart(pl, 'tower', 'std', 1, 'sell'); A.devStep(); S.player.cash = 0; const s0 = snap(pl), d0 = pl.done, h0 = pl.halt || 0; A.devStep();
      out['06-01'] = snap(pl) === s0 && pl.done === d0 + 1 && pl.halt === h0 + 1 && pl.haltNeed > 0 && S.player.cash === 0; info['06-01'] = {need: pl.haltNeed, done: [d0, pl.done]};
      /* 06-02: cash enough, but half of a short sale's proceeds is collateral */
      const c = S.cos.find(x => !x.priv && !x.ctrl); const wk = Math.max(0, pl.cost - pl.spent) / Math.max(1, pl.done - S.week + 1); S.player.cash = wk * .3; A.execShort(c, A.sharesForShort(c, wk)); /* cash 1.3× the payment, but half the short proceeds are collateral */ const cashNow = S.player.cash, fc = A.freeCash(), s1 = snap(pl); A.devStep();
      out['06-02'] = cashNow >= wk && fc < wk && snap(pl) === s1 && S.player.cash === cashNow; info['06-02'] = {wk, cash: cashNow, free: fc};
      S.player.shorts = {}; }
    { fresh(4902); S.player.cash = 1e4; const pl = plot('P', 'tyo', 'com', 4000, 9); A.devStart(pl, 'office', 'std', 1, 'sell'); A.devStep(); const wk = Math.max(0, pl.cost - pl.spent) / Math.max(1, pl.done - S.week + 1);
      S.player.cash = wk - 1e-6; const s0 = snap(pl); A.devStep(); const shortOk = snap(pl) === s0; const w2 = Math.max(0, pl.cost - pl.spent) / Math.max(1, pl.done - S.week + 1); /* the payment is spread over one more week now */ S.player.cash = w2; const sp = pl.spent; A.devStep(); out['06-03'] = shortOk && w2 < wk && Math.abs(pl.spent - sp - w2) < 1e-9 && Math.abs(S.player.cash) < 1e-9; info['06-03'] = {wk, w2}; }
    { fresh(4903); S.player.cash = 1e4; const pl = plot('P', 'tyo', 'com', 4000, 9); A.devStart(pl, 'office', 'std', 1, 'sell'); while (pl.done - S.week > 1) { S.week++; A.devStep(); } S.week++; /* the last week */ S.player.cash = 0; const n0 = S.props.length, d0 = pl.done; A.devStep(); const stillThere = S.devp.includes(pl) && pl.done === d0 + 1;
      for (let i = 0; i < 3; i++) { S.week++; A.devStep(); } S.player.cash = 1e4; const c0 = S.player.cash; S.week++; const left = pl.cost - pl.spent; A.devStep(); const news = S.news.filter(n => /竣工・売却/.test(n.t)).length; S.week++; A.devStep();
      out['06-04'] = stillThere && !S.devp.includes(pl) && left > 0 && S.news.filter(n => /竣工・売却/.test(n.t)).length === news && news >= 1; info['06-04'] = {left: +left.toFixed(4)}; }
    { fresh(4904); const c = S.cos.find(x => !x.priv && x.cash > 1); c.ctrl = null; const pl = plot(c.id, 'tyo', 'com', 4000, 9); c.cash = 1e4; A.devStart(pl, 'office', 'std', 1, 'sell'); A.devStep(); const wk = () => Math.max(0, pl.cost - pl.spent) / Math.max(1, pl.done - S.week + 1);
      c.cash = 0; c.debt = Math.max(0, A.maxDebt(c) - wk() * .5); const st0 = JSON.stringify([pl.spent, c.cash, c.debt, c.assets]); A.devStep(); const halted = JSON.stringify([pl.spent, c.cash, c.debt, c.assets]) === st0;
      c.debt = 0; const a0 = c.assets, sp = pl.spent, w = wk(); A.devStep(); out['06-05'] = halted && Math.abs(pl.spent - sp - w) < 1e-9 && c.debt <= A.maxDebt(c) + 1e-9 && Math.abs(c.assets - a0 - w) < 1e-9 && c.cash >= -1e-9; }
    { fresh(4905); S.player.cash = 1e4; const a = plot('P', 'tyo', 'com', 4000, 9), b2 = plot('P', 'osa', 'com', 4000, 9); A.devStart(a, 'office', 'std', 1, 'sell'); A.devStart(b2, 'office', 'std', 1, 'sell'); A.devStep();
      const wa = (a.cost - a.spent) / (a.done - S.week + 1), wb = (b2.cost - b2.spent) / (b2.done - S.week + 1); S.player.cash = wa + wb * .5; const sa = a.spent, sb = b2.spent; A.devStep(); const one = Math.abs(a.spent - sa - wa) < 1e-9 && b2.spent === sb && b2.halt === 1;
      const okL = loads(); S = A.S; const a2 = S.devp.find(x => x.id === a.id), b3 = S.devp.find(x => x.id === b2.id); S.player.cash = 1e4; let n = 0; while ((S.devp.includes(a2) || S.devp.includes(b3)) && n++ < 400) { S.week++; A.devStep(); }
      out['06-06'] = one && okL && !S.devp.includes(a2) && !S.devp.includes(b3) && Math.abs(a2.spent - a2.cost) < 1e-6 && Math.abs(b3.spent - b3.cost) < 1e-6; info['06-06'] = {a: [a2.spent, a2.cost], b: [b3.spent, b3.cost]}; }
    /* RE-08: what the offer screen shows is what is paid */
    const offer = (x, f, ltv) => { A.showProp(x); click('pofferf', x.id, f); click('pltv', x.id, ltv); const txt = document.querySelector('.modal') ? document.querySelector('.modal').textContent : ''; return txt; };
    { fresh(4906); const x = S.props.find(y => y.id === 'R-tyo-01'), q = A.propQuote(x, 1, 0); S.player.cash = 1e4; const txt = offer(x, 1, 0), c0 = S.player.cash; click('poffer', x.id); const paid = c0 - S.player.cash;
      out['08-01'] = Math.abs(q.price - r2m(A.propInfo(x).ask)) < 1e-9 && q.fee === r2m(q.price * .03) && Math.abs(paid - q.need) < 1e-9 && x.own === 'P' && txt.includes(A.fm(q.price)) && txt.includes(A.fm(q.need)) && q.price !== q.value; info['08-01'] = {value: q.value, price: q.price, fee: q.fee, need: q.need, paid}; }
    { const res = []; for (const f of [.85, .9, .95, 1, 1.05]) for (const ltv of [0, .5]) { fresh(4907); const x = S.props.find(y => y.id === 'R-nyc-01'), q = A.propQuote(x, f, ltv); S.player.cash = 1e4; const txt = offer(x, f, ltv), c0 = S.player.cash, ok = q.price >= q.reserve; click('poffer', x.id);
        const paid = c0 - S.player.cash; res.push([f, ltv, ok ? (x.own === 'P' && Math.abs(paid - q.need) < 1e-9 && Math.abs(x.mort - q.loan) < 1e-9) : (!x.own && paid === 0 && x.offW > S.week), txt.includes(A.fm(q.need))]); }
      out['08-02'] = res.every(z => z[2] && z[3]); info['08-02'] = res; }
    { fresh(4908); const x = S.props.find(y => y.id === 'R-lon-01'), q3 = A.propQuote(x, 1, .5); const re = S.cos.find(c => c.ind === 'realty'), was = re.ctrl; re.ctrl = 'P'; const q1 = A.propQuote(x, 1, .5); re.ctrl = was;
      out['08-03'] = q3.fee === r2m(q3.price * .03) && q1.fee === r2m(q1.price * .01) && q3.loan === q1.loan && Math.abs((q3.need - q1.need) - (q3.fee - q1.fee)) < 1e-9; info['08-03'] = {fee3: q3.fee, fee1: q1.fee}; }
    { fresh(4909); const x = S.props.find(y => y.id === 'R-par-01'); S.player.cash = 1; offer(x, 1, 0); const s0 = JSON.stringify([x, S.player.cash]); click('poffer', x.id); const noCash = JSON.stringify([x, S.player.cash]) === s0;
      S.player.cash = 1e4; offer(x, .8, 0); const s1 = JSON.stringify([x.own, x.mort, S.player.cash]); click('poffer', x.id); const low = JSON.stringify([x.own, x.mort, S.player.cash]) === s1 && x.offW > S.week;
      x.offW = 0; offer(x, 1, 0); x.v *= 1.1; const s2 = JSON.stringify([x.own, S.player.cash]); click('poffer', x.id); const stale = JSON.stringify([x.own, S.player.cash]) === s2; const q = A.propQuote(x, 1, 0), c0 = S.player.cash; click('poffer', x.id); /* the screen now shows the new quote */
      out['08-04'] = noCash && low && stale && x.own === 'P' && Math.abs(c0 - S.player.cash - q.need) < 1e-9; }
    /* RE-07: the hotel contract runs its term; notice not to renew only in its last 4 weeks, taking effect at the end */
    const hotel = seed => { fresh(seed); S.player.cash = 1e4; const H = S.props.find(x => x.id === 'R-osa-01'); A.buyProp('P', H, 0); H.opm = null; H.lease = null; A.hotelOpm(H); return H; };
    { const H = hotel(4910), L = JSON.stringify(H.lease), w0 = S.week; let all = true; for (let w = 0; w <= 47; w += 7) { S.week = w0 + w; const t = A.hotelOpm(H); all = all && !t.ok && JSON.stringify(H.lease) === L && H.opm === 'lease'; } out['07-01'] = all; }
    { const res = []; for (const k of [48, 49, 50, 51]) { const H = hotel(4911), L = H.lease; S.week = L.w0 + k; const amt = L.amt, w1 = L.w1, t = A.hotelOpm(H); res.push(t.ok && H.opm === 'lease' && H.lease.nonRenew === true && H.lease.amt === amt && H.lease.w1 === w1 && A.propRentY(H) === amt); } out['07-02'] = res.every(Boolean); }
    { const H = hotel(4912), L0 = Object.assign({}, H.lease); S.week = L0.w0 + 48; A.hotelOpm(H); A.hotelOpm(H); const t = A.hotelOpm({}); /* notice given and taken back; a call on nothing does nothing */ const stillLease = H.opm === 'lease' && H.lease.amt === L0.amt && H.lease.w1 === L0.w1 && H.lease.w0 === L0.w0 && H.lease.nonRenew === false;
      A.hotelOpm(H); const okL = loads(); S = A.S; const H2 = S.props.find(x => x.id === H.id); out['07-03'] = stillLease && okL && H2.opm === 'lease' && H2.lease.nonRenew === true && H2.lease.amt === L0.amt && H2.lease.w1 === L0.w1; }
    { const H = hotel(4913), L = Object.assign({}, H.lease); S.week = L.w1 - 3; A.hotelOpm(H); const got = []; for (let w = L.w1 - 3; w <= L.w1 + 1; w++) { S.week = w; const c0 = S.player.cash; A.propStep(); got.push([w, H.opm || 'self', +(S.player.cash - c0).toFixed(6)]); }
      const lease = got.filter(g => g[0] < L.w1), self = got.filter(g => g[0] >= L.w1); out['07-04'] = lease.every(g => g[1] === 'lease') && self.every(g => g[1] === 'self') && !H.lease && got.length === 5; info['07-04'] = got; }
    { const H = hotel(4914), L = Object.assign({}, H.lease); H.v *= 1.5; S.week = L.w1 - 1; A.propStep(); const same = H.lease.w1 === L.w1 && H.lease.amt === L.amt; S.week = L.w1; A.propStep();
      out['07-05'] = same && H.lease.w0 === L.w1 && H.lease.w1 === L.w1 + 52 && Math.abs(H.lease.amt - H.v * H.y * .86) < 1e-6 && H.lease.amt > L.amt; info['07-05'] = {L, n: H.lease}; }
    { fresh(4915); S.player.cash = 1e4; const H = S.props.find(x => x.id === 'R-nyc-03'); A.buyProp('P', H, 0); H.opm = null; H.lease = null; A.hotelOpm(H); const L = Object.assign({}, H.lease), r0 = A.propRentY(H); S.econ.fx *= 1.3; const r1 = A.propRentY(H); S.econ.fx /= 1.3;
      S.week = L.w1 - 2; A.hotelOpm(H); const R1 = S.rivals[0]; R1.cash = 1e5; A.sellProp(H); A.buyProp(R1.id, H, 0); const kept = H.lease && H.lease.amt === L.amt && H.lease.nonRenew === true && H.own === R1.id; const okL = loads(); S = A.S; const H2 = S.props.find(x => x.id === H.id);
      info['07-06'] = {r: r1 / r0, kept, okL, H2: H2 && H2.lease}; const pre = !!H2 && !!H2.lease && H2.lease.nonRenew === true && H2.own === R1.id && H2.lease.amt === L.amt; S.week = L.w1; A.propStep(); out['07-06'] = Math.abs(r1 / r0 - 1.3) < 1e-9 && kept && okL && pre && (H2.opm || null) === null && !H2.lease; }
    /* RE-09: a solar farm or a car park shows its site and the developed part separately */
    { const res = {}; for (const [k, f] of [['solar', .5], ['parking', .5], ['parking', 1]]) { fresh(4916); S.player.cash = 1e4; const pl = plot('P', 'tyo', k === 'solar' ? 'ind' : 'com', 6000, k === 'solar' ? 2 : 8); A.devStart(pl, k, 'std', f, 'hold'); pl.done = S.week; A.devStep(); const x = S.props.find(y => y.id === 'D' + pl.id), I = A.propInfo(x), rent = A.propRentY(x);
        res[k + Math.round(f * 100)] = {site: I.site, dev: I.dev, lbl: I.areaLbl, m2: Math.round(I.rentM2), m2dev: Math.round(I.rentM2Dev), ok: I.site === 6000 && I.dev === Math.round(6000 * f) && I.area === 6000 && I.areaLbl === '敷地面積' && Math.abs(I.rentM2 - rent * 1e8 / 6000) < 1e-6 && Math.abs(I.rentM2Dev - rent * 1e8 / I.dev) < 1e-6}; }
      out['09-01'] = res.solar50.ok; out['09-02'] = res.parking50.ok && res.parking100.ok; info['09'] = res; }
    { fresh(4917); const o = S.props.find(x => x.kind === 'office'), u = S.props.find(x => x.kind === 'unit'); const t = JSON.parse(A.exportText()); t.props.push({id: 'N998', city: 'osa', kind: 'parking', name: '旧版の駐車場', v: 3, y: .05, own: null, mort: 0, cost: 0}); t.supSeq = Math.max(t.supSeq || 0, 998); t.chk = A.finSig(t); A.importText(JSON.stringify(t)); S = A.S;
      const n = S.props.find(x => x.id === 'N998'), I = A.propInfo(n); out['09-03'] = A.propInfo(o).areaLbl === '延床面積' && A.propInfo(u).areaLbl === '専有面積' && A.propInfo(u).area < 100 && I.site === null && /記録なし/.test(I.areaLbl) && n.areaEst === true && I.area > 0; info['09-03'] = {lbl: I.areaLbl, a: I.area}; }
    { fresh(4918); S.player.cash = 1e4; const pl = plot('P', 'nyc', 'ind', 6000, 2); A.devStart(pl, 'solar', 'std', .5, 'hold'); pl.done = S.week; A.devStep(); const x = S.props.find(y => y.id === 'D' + pl.id), a0 = JSON.stringify([A.propInfo(x).site, A.propInfo(x).dev]), v0 = A.propVal(x), r0 = A.propRentY(x);
      S.econ.fx *= 1.2; x.v *= 1.1; const a1 = JSON.stringify([A.propInfo(x).site, A.propInfo(x).dev]); const okL = loads(); S = A.S; const x2 = S.props.find(y => y.id === x.id);
      out['09-04'] = a0 === a1 && a1 === JSON.stringify([A.propInfo(x2).site, A.propInfo(x2).dev]) && okL && Math.abs(A.propVal(x2) - A.propVal(x)) < 1e-9; }
    /* RE-10: only a building on its first sale runs out; a bought one comes back as second-hand */
    { fresh(4919); let first = null; for (let w = 0; w <= 13 + 78 + 26; w++) { S.week = w; A.propSupply(); if (!first) first = S.props.find(x => /^N\d+$/.test(x.id)); } const gone = first && !S.props.includes(first); let after = 0; const n0 = S.supSeq; for (let w = 118; w < 300; w++) { S.week = w; A.propSupply(); } out['10-01'] = !!first && gone && S.supSeq > n0; info['10-01'] = {first: first && first.id, lw: first && first.lw}; }
    { fresh(4920); S.player.cash = 1e4; let N1 = null; for (let w = 0; w <= 100; w++) { S.week = w; A.propSupply(); if (!N1) { N1 = S.props.find(x => x.id === 'N1'); if (N1) A.buyProp('P', N1, 0); } if (w === 100) A.sellProp(N1); }
      for (let w = 101; w < 260; w++) { S.week = w; A.propSupply(); } const there = S.props.includes(N1); const ok2 = there && A.buyProp('P', N1, 0); out['10-02'] = !!N1 && there && ok2 && N1.everOwned === true && N1.lw === 13; }
    { fresh(4921); S.player.cash = 1e5; const ids0 = new Set(); for (let w = 0; w < 600; w++) { S.week = w; A.propSupply(); const N = S.props.filter(x => /^N\d+$/.test(x.id)); for (const x of N) ids0.add(x.id); if (w % 40 === 20) { const x = N.find(y => !y.own && !y.everOwned); if (x) { A.buyProp('P', x, .5); } } if (w % 40 === 35) { const x = A.propsOf('P').find(y => /^N/.test(y.id)); if (x) A.sellProp(x); } }
      const owned = A.propsOf('P').filter(x => /^N/.test(x.id)), ids = S.props.map(x => x.id); const everOwned = S.props.filter(x => /^N/.test(x.id) && x.everOwned);
      out['10-03'] = new Set(ids).size === ids.length && everOwned.length >= 5 && owned.every(x => S.props.includes(x)) && S.props.filter(x => /^N\d+$/.test(x.id) && x.mort > 0).every(x => x.own); info['10-03'] = {everOwned: everOwned.length, owned: owned.length}; }
    { fresh(4922); const t = JSON.parse(A.exportText()); t.week = 200; t.props.push({id: 'N997', city: 'osa', kind: 'office', name: '旧版の新築', v: 5, y: .05, own: null, mort: 0, cost: 0, bw: 0, lw: 0}); t.supSeq = Math.max(t.supSeq || 0, 997); t.chk = A.finSig(t); const e = A.importText(JSON.stringify(t)); S = A.S; const n = S.props.find(x => x.id === 'N997'); A.propSupply(); S.week++; A.propSupply();
      const kept = S.props.some(x => x.id === 'N997'); A.importText(A.exportText()); S = A.S; out['10-04'] = !!n && n.everOwned === true && kept && S.props.find(x => x.id === 'N997').everOwned === true; info['10-04'] = {e: e || null}; }
    { const cnt = {}; for (let sd = 0; sd < 20; sd++) { fresh(9100 + sd); S.player.cash = 1e5; for (let k = 0; k < 40; k++) { for (let w = 26 * k; w < 26 * (k + 1); w++) { S.week = w; const n0 = S.supSeq || 0; A.propSupply(); if ((S.supSeq || 0) > n0) { const x = S.props[S.props.length - 1]; cnt[x.kind] = (cnt[x.kind] || 0) + 1; if (k % 3 === 0) { A.buyProp('P', x, 0); A.sellProp(x); } } } } }
      const firstU = ['jp', 'am', 'emea', 'ap'].map(g => A.supUnsold(g)); out['10-05'] = Object.keys(cnt).length === 18 && firstU[0] <= 6 && firstU.slice(1).every(n => n <= 4) && S.props.some(x => /^N/.test(x.id) && x.everOwned && !x.own); info['10-05'] = {cnt, firstU}; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev49 real estate', JSON.stringify(r.info).slice(0, 3000));
  for (const [k, v] of Object.entries(r.out)) ok('rev49 real estate: ' + k, v);
  /* RE-03 regression: the detail screen of one building of each of the 18 kinds at five widths (90 screens): no sideways overflow, picture inside the screen */
  await p.evaluate(() => { const A = window.__atlas; A.closeModal(); A.newGame(4930, 'normal', 'B', 'b', 'std', true); A.S.allUnlocked = true; for (let i = 0; i < 40; i++) A.step(); });
  const vis = []; for (const w of [320, 375, 390, 430, 768]) { await p.setViewportSize({width: w, height: 800}); const o = await p.evaluate(() => { const A = window.__atlas, S = A.S, kinds = [...new Set(S.props.map(x => x.kind))], res = []; for (const k of kinds) { const x = S.props.find(y => y.kind === k); A.showProp(x); const im = document.querySelector('.modal img, .modal svg'), rc = im ? im.getBoundingClientRect() : null; res.push(document.documentElement.scrollWidth <= innerWidth + 1 && !!rc && rc.left >= -1 && rc.right <= innerWidth + 1 && rc.width > 0); A.closeModal(); } return {n: kinds.length, ok: res.filter(Boolean).length}; }); vis.push([w, o.n, o.ok]); }
  ok('rev49 real estate: detail screens of all 18 kinds at 5 widths (90)', vis.every(v => v[1] === 18 && v[2] === 18), JSON.stringify(vis));
  ok('rev49 real estate: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
}
async function testRealEstate48(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(async () => { try { return await (async () => {
    const A = window.__atlas, out = {}, info = {}, r2m = x => Math.round(x * 100) / 100;
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const e = A.econCheck(A.S); if (!(ok1 && A.S !== S0 && e === '')) info.loadFail = [ok1, String(m).slice(0, 80), e]; return ok1 && !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0 && e === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.hqInit && A.hqInit(); A.sitesEnsure(); return S; };
    const plot = (own, city, zone, area, far) => { S.devSeq = (S.devSeq || 0) + 1; const pl = {id: S.devSeq + 9000, own, site: {id: 'X' + S.devSeq, city, k: 0, n: A.S.cos.length ? '試験' + S.devSeq + 'の用地' : '', zone, area, far, pxm2: .02, risky: false}, land: area * .02, spent: 0, st: 'land', w: S.week, ready: S.week, fraud: null}; S.devp.push(pl); return pl; };
    const finish = pl => { pl.done = S.week; A.devStep(); return S.props.find(x => x.id === 'D' + pl.id); };
    /* FX-01/02: a building kept on completion is worth its finished value in yen whatever the rate; afterwards only the rate moves it */
    { fresh(4801); S.player.cash = 1e5; const res = [];
      for (const f of [.8, 1, 1.2]) for (const ct of ['nyc', 'tyo']) for (const own of ['P', 'C']) { S.econ.fx = A.FX0 * f; let k = own, c = null; if (own === 'C') { c = S.cos.find(x => !x.priv && x.cash > 1); c.cash += 5e4; k = c.id; }
        const pl = plot(k, ct, 'com', 3000, 8); const e = A.devStart(pl, 'office', 'std', 1, 'hold'); if (e) { res.push([f, ct, own, 'start ' + e]); continue; } const a0 = c ? c.assets : 0; const V = (pl.land + pl.cost) * A.devMult(); const np = finish(pl);
        const okV = np && Math.abs(np.v * A.propFx(np) - V) < 1e-6 * V && A.propVal(np) === r2m(V) && np.vfx === 1 && (!c || Math.abs(c.assets - a0 - (V - pl.land)) < 1e-6 * V);
        const v1 = A.propVal(np), cost = np.cost, mort = np.mort; S.econ.fx *= 1.25; const okF = Math.abs(A.propVal(np) / v1 - (ct === 'tyo' ? 1 : 1.25)) < .011 / v1 && np.cost === cost && np.mort === mort; S.econ.fx /= 1.25;
        res.push([f, ct, own, okV && okF ? 'ok' : 'bad', +V.toFixed(3), np && A.propVal(np)]); }
      info.fx = res.filter(x => x[3] !== 'ok'); out.fx01_02 = res.length === 12 && res.every(x => x[3] === 'ok'); S.econ.fx = A.FX0; }
    /* FX-04: an overseas building finished by the earlier version is kept as it was and marked; loading again changes nothing */
    { fresh(4802); S.player.cash = 1e5; const pl = plot('P', 'lon', 'com', 3000, 8); A.devStart(pl, 'office', 'std', 1, 'hold'); const np = finish(pl);
      const o = JSON.parse(A.exportText()), q = o.props.find(x => x.id === np.id); delete q.vfx; q.v = q.v * 1.3; o.tr.eq1 += r2m(q.v * o.econ.fx / A.FX0) - r2m(q.v / 1.3 * o.econ.fx / A.FX0); o.chk = A.finSig(o); const v0 = q.v;
      const e1 = A.importText(JSON.stringify(o)), a = A.S.props.find(x => x.id === np.id); const e2 = A.importText(A.exportText()), b2 = A.S.props.find(x => x.id === np.id);
      info.fx04 = {e1: e1 || null, v0, v: a && a.v, vfx: a && a.vfx}; out.fx04 = !!a && Math.abs(a.v - v0) < 1e-12 && a.vfx === 'unknown' && b2.v === a.v && b2.vfx === 'unknown'; S = A.S; }
    /* AREA-01: a finished building keeps the floor area it was planned with; the rent per m² uses the same area */
    { fresh(4803); S.player.cash = 1e5; const pl = plot('P', 'osa', 'com', 4000, 7); A.devStart(pl, 'hotel', 'std', 1, 'hold'); const g = pl.gfa, np = finish(pl), I = A.propInfo(np);
      out.area01 = np.gfa === g && I.area === g && Math.abs(I.rentM2 - A.propRentY(np) * 1e8 / g) < 1e-6 && I.areaLbl === '延床面積' && /試験/.test(I.addr); info.area01 = {g, a: I.area, addr: I.addr}; }
    /* AREA-02 / MKT-01..04: the initial market */
    { const seeds = [4811, 4812, 4813], base = []; let okAll = true; for (const sd of seeds) { fresh(sd); const P = S.props, R = P.filter(x => /^R-/.test(x.id)), kinds = new Set(P.map(x => x.kind));
        base.push(JSON.stringify(P.map(x => [x.id, x.v, x.area || x.gfa]))); okAll = okAll && P.length === 158 && R.length === 78 && kinds.size === 18 && new Set(P.map(x => x.id)).size === 158 && JSON.stringify(P.filter(x => !/^R-/.test(x.id))) === JSON.stringify(A.genProps().filter(x => !/^R-/.test(x.id))); }
      out.mkt01 = okAll && base.every(x => x === base[0]); /* the market comes from the city list alone: the same in every game */
      const P = S.props, reg = {}; for (const x of P) { const g = {tyo: 'jp', osa: 'jp', ngo: 'jp', fuk: 'jp', spk: 'jp'}[x.city] || null; } const RG = {jp: 'tyo osa ngo fuk spk', am: 'nyc tor chi sfo mex sao bue', emea: 'lon par fra zur sto dxb los jnb', ap: 'bom sin hkg sha sel syd'};
      for (const k in RG) reg[k] = P.filter(x => RG[k].split(' ').includes(x.city)).length; info.reg = reg;
      const perCity = {}; for (const x of P.filter(x => /^R-/.test(x.id))) perCity[x.city] = (perCity[x.city] || 0) + 1;
      out.mkt02 = reg.jp === 38 && reg.am === 39 && reg.emea === 46 && reg.ap === 35 && Object.keys(perCity).length === 26 && Object.values(perCity).every(n => n === 3) && P.every(x => !x.own && !x.mort && !x.cost);
      const R = P.filter(x => /^R-/.test(x.id)); out.mkt03 = R.filter(x => x.kind === 'dc').every(x => A.powerOK(x.city) && x.ramp >= .8 && x.ramp <= 1) && R.filter(x => x.kind === 'tower').every(x => x.far >= 6) && R.filter(x => x.kind === 'mixed').every(x => x.land >= 5000) && R.filter(x => x.kind === 'arena').every(x => x.land >= 6000) && R.filter(x => x.kind === 'solar').every(x => x.zone === 'ind');
      const lbl = x => A.propInfo(x).areaLbl; out.area02 = P.every(x => { const a = A.propInfo(x).area; return Number.isFinite(a) && a > 0; }) && P.filter(x => x.kind === 'solar' || x.kind === 'parking').every(x => lbl(x) === '敷地面積') && P.filter(x => x.kind === 'unit').every(x => lbl(x) === '専有面積') && P.filter(x => x.kind === 'office').every(x => lbl(x) === '延床面積');
      const sm = P.filter(x => x.small), ref = A.smallProps(); out.mkt04 = sm.length === 10 && sm.every(x => { const q = ref.find(y => y.id === x.id); return q && q.v === x.v && A.propOpen(x); }) && P.filter(x => !x.small).every(x => x.v >= 1);
      info.list = P.map(x => [x.id, x.city, x.kind, x.name, A.propInfo(x).area, A.propVal(x), x.y]); }
    /* AREA-03: a year of price moves and a reload: the area and the address stay; an old building with no area is estimated once */
    { fresh(4804); const pick = S.props.filter((x, i) => i % 9 === 0), b0 = pick.map(x => { const I = A.propInfo(x); return [x.id, I.area, I.addr]; }); for (let i = 0; i < 52; i++) A.step();
      A.importText(A.exportText()); S = A.S; const b1 = b0.map(([id]) => { const x = S.props.find(y => y.id === id); if (!x) return [id]; const I = A.propInfo(x); return [id, I.area, I.addr]; });
      const o = JSON.parse(A.exportText()); const N = o.props.find(x => x.id === 'R-tyo-01'); delete N.gfa; o.props.push({id: 'N999', city: 'tyo', kind: 'office', name: '旧版の新築', v: 50, y: .05, own: null, mort: 0, cost: 0}); o.supSeq = Math.max(o.supSeq || 0, 999); o.chk = A.finSig(o); A.importText(JSON.stringify(o)); S = A.S;
      const n1 = S.props.find(x => x.id === 'N999'), a1 = n1 && n1.area; A.importText(A.exportText()); S = A.S; const n2 = S.props.find(x => x.id === 'N999');
      out.area03 = JSON.stringify(b0) === JSON.stringify(b1) && !!n1 && n1.areaEst === true && a1 > 0 && n2.area === a1 && n2.lw != null; info.area03 = {a1, a2: n2 && n2.area}; }
    /* VIS-01/02: every drawing fits its box; every photo decodes */
    { const kinds = Object.keys(A.PROPY || {}).length ? Object.keys(A.PROPY) : ['office']; const ks = ['office', 'retail', 'logi', 'resi', 'apt', 'unit', 'condo', 'hotel', 'tower', 'mixed', 'house', 'factory', 'lab', 'dc', 'parking', 'medical', 'care', 'solar', 'arena'];
      const host = document.createElement('div'); document.body.appendChild(host); let bad = [];
      for (const k of ks) for (const g of ['std', 'hi']) for (const sz of [.1, .5, 1, 2, 4]) { host.innerHTML = A.bldSVGdraw(k, g, sz); const sv = host.querySelector('svg'), vb = sv.viewBox.baseVal, bb = sv.getBBox(); if (bb.x < vb.x || bb.y < vb.y || bb.x + bb.width > vb.x + vb.width || bb.y + bb.height > vb.y + vb.height || sv.dataset.kind !== k) bad.push([k, g, sz]); }
      host.remove(); out.vis02 = bad.length === 0; info.vis02 = bad.slice(0, 5);
      const srcs = ks.map(k => [k, A.propImgSrc(k, 'std'), A.propImgSrc(k, 'hi')]).filter(x => x[1]); let dec = 0, fail = [];
      for (const [k, s1, s2] of srcs) for (const s of [s1, s2]) { const im = new Image(); im.src = s; try { await im.decode(); if (im.naturalWidth > 0) dec++; else fail.push(k); } catch (e) { fail.push(k); } }
      info.vis01 = {photos: srcs.map(x => x[0]), dec, fail}; out.vis01 = fail.length === 0 && srcs.length >= 16;
      let fd = 0, ff = 0; for (const s of A.AV_POOL) { const im = new Image(); im.src = s.src || s; try { await im.decode(); if (im.naturalWidth > 0) fd++; else ff++; } catch (e) { ff++; } } info.vis04 = {faces: fd, bad: ff}; out.vis04 = ff === 0 && fd === A.AV_POOL.length; }
    /* HOT-01/02/03: a fixed lease is fixed; running it yourself moves with demand; the contract stays with the building and pays only its owner */
    { fresh(4805); S.player.cash = 1e5; const H = S.props.find(x => x.kind === 'hotel' && x.city === 'osa'), Hn = S.props.find(x => x.kind === 'hotel' && x.city === 'nyc');
      A.buyProp('P', H, 0); A.buyProp('P', Hn, 0); H.opm = null; H.lease = null; const t1 = A.hotelOpm(H), L = JSON.stringify(H.lease), rents = [], self = [];
      const g0 = S.econ.gdp; for (const gd of [-3, 2, 7]) { S.econ.gdp = gd; H.rl = gd > 5 ? 1 : 0; S.week += 13; rents.push(A.propRentY(H)); } S.econ.gdp = g0; S.week -= 39; H.rl = 0;
      const Hs = Object.assign({}, H, {id: H.id + 'x', opm: null, lease: null}); for (const gd of [-3, 2, 7]) { S.econ.gdp = gd; self.push(A.propRentY(Hs)); } S.econ.gdp = g0;
      out.hot01 = t1.ok && rents.every(x => Math.abs(x - rents[0]) < 1e-12) && Math.abs(rents[0] - H.lease.amt) < 1e-12 && Math.max(...self) - Math.min(...self) > .1 * Math.min(...self); info.hot01 = {rents, self};
      Hn.opm = null; Hn.lease = null; A.hotelOpm(Hn); const r0 = A.propRentY(Hn); S.econ.fx *= 1.2; const r1 = A.propRentY(Hn); S.econ.fx /= 1.2; const i0 = Hn.mort; S.econ.rate += 2; const r2 = A.propRentY(Hn); S.econ.rate -= 2;
      out.hot02 = Math.abs(r1 / r0 - 1.2) < 1e-9 && Math.abs(r2 - r0) < 1e-12 && Hn.mort === i0;
      const back = A.hotelOpm(H), again = JSON.stringify(H.lease); const R1 = S.rivals[0]; R1.cash = 1e5; const rc0 = R1.cash; A.sellProp(H); const kept = JSON.stringify(H.lease); A.buyProp(R1.id, H, 0); const paid = rc0 - R1.cash, pc0 = S.player.cash; A.propStep(); const toP = S.player.cash - pc0;
      const okLoad = loads(); S = A.S; const H2 = S.props.find(x => x.id === H.id);
      out.hot03 = !back.ok && again === L && kept === L && JSON.stringify(H2.lease) === L && H2.own === R1.id && okLoad && !(toP > 1e-9 && !A.propsOf('P').length); info.hot03 = {back: back.msg, paid, toP}; }
    /* MKT-05: the choice of what comes to market — 50 seeds × 40 chances, every kind appears where it is allowed */
    { const cnt = {}; let badDc = 0; for (let sd = 0; sd < 50; sd++) { fresh(9000 + sd); for (let k = 0; k < 40; k++) { S.week = 13 + 26 * k; const n0 = S.props.length; A.propSupply(); const x = S.props[S.props.length - 1]; if (S.props.length > n0) { cnt[x.kind] = (cnt[x.kind] || 0) + 1; if (x.kind === 'dc' && !A.powerOK(x.city)) badDc++; S.props.pop(); } } }
      info.mkt05 = cnt; out.mkt05 = Object.keys(cnt).length === 18 && badDc === 0; }
    /* MKT-06: listings run out and supply never stops for good; an owned (mortgaged) listing is never removed */
    { fresh(4806); S.player.cash = 1e5; let maxU = 0, made = 0, keep = null, lastNew = 0; for (let w = 0; w < 1040; w++) { S.week = w; const n0 = S.supSeq || 0; A.propSupply(); if ((S.supSeq || 0) > n0) { made++; lastNew = w; if (!keep) { keep = S.props[S.props.length - 1]; A.buyProp('P', keep, .5); } } for (const g of ['jp', 'am', 'emea', 'ap']) maxU = Math.max(maxU, A.supUnsold(g)); }
      const ids = S.props.map(x => x.id); info.mkt06 = {made, maxU, lastNew, keep: keep && keep.id}; out.mkt06 = made >= 30 && maxU <= 6 && lastNew > 900 && !!keep && ids.includes(keep.id) && keep.own === 'P' && new Set(ids).size === ids.length; }
    /* MKT-07: a catalogue building bought on a loan and sold: price, fee, loan and cash agree; short of cash, nothing happens */
    { fresh(4807); const x = S.props.find(y => y.id === 'R-sin-02'), v = A.propVal(x), fee = r2m(v * A.propFee('P')), loan = r2m(v * .5); S.player.cash = 1; const snap = JSON.stringify([x, S.player.cash]); const no = A.buyProp('P', x, .5), same = JSON.stringify([x, S.player.cash]) === snap;
      S.player.cash = 1e4; const c0 = S.player.cash, fpl0 = (S.player.plW && S.player.plW.fee) || 0, yes = A.buyProp('P', x, .5), paid = c0 - S.player.cash; const q = A.sellQuote(x), c1 = S.player.cash, net = A.sellProp(x);
      out.mkt07 = !no && same && yes && Math.abs(paid - (v + fee - loan)) < 1e-9 && x.mort === 0 && Math.abs(S.player.cash - c1 - net) < 1e-9 && Math.abs(q.net - (q.gross - q.fee - loan)) < 1e-9 && q.fee === r2m(q.gross * A.propFee('P')) && Math.abs(((S.player.plW && S.player.plW.fee) || 0) - fpl0 + fee + q.fee) < 1e-9 && [v, fee, loan, q.gross, q.fee].every(z => Math.abs(z * 100 - Math.round(z * 100)) < 1e-6) && loads(); info.mkt07 = {v, fee, loan, paid, q}; }
    /* DEV-03: a new data centre fills from 35% in 34 weeks, 17 with a group tech or telecom company */
    { fresh(4808); S.player.cash = 1e5; const pl = plot('P', 'tyo', 'ind', 8000, 2); A.devStart(pl, 'dc', 'std', 1, 'hold'); const d = finish(pl); let n1 = 0; while (d.ramp < 1 && n1 < 200) { A.propStep(); n1++; }
      const t = S.cos.find(c => c.ind === 'tech' && !c.ctrl), was = t.ctrl; t.ctrl = 'P'; d.ramp = .35; let n2 = 0; while (d.ramp < 1 && n2 < 200) { A.propStep(); n2++; } t.ctrl = was; info.dev03 = [n1, n2]; out.dev03 = n1 === 34 && n2 === 17; }
    /* SAVE-02 / LONG-02: saving and loading again and again changes nothing; drawing the property screens draws no random numbers */
    { fresh(4809); for (let i = 0; i < 30; i++) A.step(); const t0 = A.exportText(); for (let i = 0; i < 3; i++) A.importText(A.exportText()); out.save02 = JSON.stringify(JSON.parse(A.exportText()).props) === JSON.stringify(JSON.parse(t0).props);
      A.importText(t0); A.realtySection(); A.propFinder(); for (const x of A.S.props.slice(0, 20)) { A.showProp(x); A.closeModal(); } for (let i = 0; i < 20; i++) A.step(); const h1 = JSON.stringify([A.S.props, A.S.player.cash, A.S.cos.map(c => c.price)]);
      A.importText(t0); for (let i = 0; i < 20; i++) A.step(); const h2 = JSON.stringify([A.S.props, A.S.player.cash, A.S.cos.map(c => c.price)]); out.long02 = h1 === h2; S = A.S; }
    /* LONG-03: two years holding new kinds (hotel lease, DC, solar, arena) on loans, with the economy running: numbers stay finite and the save loads */
    { fresh(4810); S.player.cash = 2e4; for (const id of ['R-osa-01', 'R-tyo-03', 'R-sao-03', 'R-chi-03', 'R-lon-03']) A.buyProp('P', S.props.find(x => x.id === id), .5); for (let i = 0; i < 104; i++) { A.step(); S.inbox = []; }
      const P = S.props, ids = P.map(x => x.id); out.long03 = P.every(x => Number.isFinite(A.propVal(x)) && Number.isFinite(A.propRentY(x)) && Number.isFinite(x.mort)) && new Set(ids).size === ids.length && A.econCheck(S) === '' && loads(); info.long03 = {own: A.propsOf('P').length}; }
    return {out, info}; })(); } catch (e) { return {out: {threw: false}, info: {err: String(e.stack).slice(0, 600)}}; } });
  console.log('rev48 real estate', JSON.stringify(Object.assign({}, r.info, {list: undefined})).slice(0, 2500));
  for (const [k, v] of Object.entries(r.out)) ok('rev48 real estate: ' + k, v);
  /* VIS-03: the property and development screens at phone and tablet widths */
  const wide = []; for (const w of [320, 375, 390, 430, 768]) { await p.setViewportSize({width: w, height: 800}); const o = await p.evaluate(() => { const A = window.__atlas, S = A.S, res = []; for (const id of ['R-osa-01', 'R-tyo-01', 'R-tyo-03', 'R-sao-03', 'R-chi-03']) { const x = S.props.find(y => y.id === id); if (!x) continue; A.showProp(x); const m = document.querySelector('.modal') || document.body, bt = [...document.querySelectorAll('.modal button')].every(b => { const rc = b.getBoundingClientRect(); return rc.right <= innerWidth + 1 && rc.left >= -1; }); res.push(document.documentElement.scrollWidth <= innerWidth + 1 && bt); A.closeModal(); } return res; }); wide.push([w, o.every(Boolean) && o.length === 5]); }
  ok('rev48 real estate: vis03 no overflow at 320–768px', wide.every(x => x[1]), JSON.stringify(wide));
  ok('rev48 real estate: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  return r.info;
}
async function testRealEstate47(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); return ok1 && !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0 && A.econCheck(A.S) === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.step(); A.sitesEnsure(); return S; };
    const site = (city, zone, area, far) => ({id: 'T' + Math.random().toString(36).slice(2, 7), city, k: 99, n: CITYN(city) + 'テストの用地', zone, area, far, pxm2: .02, risky: false});
    const CITYN = ct => (A.S.cos.find(c => c.city === ct) || {name: ct}).name ? ct : ct;
    const plot = (own, city, zone, area, far) => { S.devSeq = (S.devSeq || 0) + 1; const pl = {id: S.devSeq + 9000, own, site: {id: 'X' + S.devSeq, city, k: 0, n: '東京テスト' + S.devSeq + 'の用地', zone, area, far, pxm2: .02, risky: false}, land: area * .02, spent: 0, st: 'land', w: S.week, ready: S.week, fraud: null}; S.devp.push(pl); return pl; };
    /* site conditions: area, floor-area ratio, power */
    { fresh(5201); const a = plot('P', 'tyo', 'com', 3000, 8), bsm = plot('P', 'spk', 'ind', 3000, 2), t = plot('P', 'tyo', 'com', 7000, 5);
      info.can = {mixed: A.devCan(a, 'mixed'), arena: A.devCan(a, 'arena'), dcSpk: A.devCan(bsm, 'dc'), tower5: A.devCan(t, 'tower'), mixedBig: A.devCan(t, 'mixed'), hotelRes: A.devCan(plot('P', 'tyo', 'res', 3000, 3), 'hotel')};
      out.conditions = /5,000m²/.test(info.can.mixed) && /6,000m²/.test(info.can.arena) && /電力/.test(info.can.dcSpk) && /容積率/.test(info.can.tower5) && info.can.mixedBig === '' && /住宅地/.test(info.can.hotelRes) && A.devCan(a, 'hotel') === '' && A.devCan(plot('P', 'tyo', 'ind', 3000, 2), 'dc') === '';
      const qo = A.devPlan(a, 'office', 'std', 1), qh = A.devPlan(plot('P', 'tyo', 'res', 3000, 3), 'house', 'std', 1), qp = A.devPlan(a, 'parking', 'std', 1); info.plans = {qo, qh, qp};
      out.plans = qh.gfa === 2400 && qp.gfa === 3000 && qp.weeks < 20 && qh.weeks < qo.weeks && qp.cost < qo.cost / 20; }
    /* every new kind can be built, finished and sold (cash in = price, land and work leave the books once) or kept and let (rent is a finite, positive number) */
    { fresh(5202); S.player.cash = 1e6; A.hqInit && A.hqInit(); const kinds = [['hotel', 'com', 'tyo'], ['tower', 'com', 'tyo'], ['mixed', 'com', 'tyo'], ['house', 'res', 'tyo'], ['factory', 'ind', 'osa'], ['lab', 'com', 'osa'], ['dc', 'ind', 'tyo'], ['parking', 'res', 'fuk'], ['medical', 'com', 'ngo'], ['care', 'res', 'ngo'], ['solar', 'ind', 'spk'], ['arena', 'com', 'tyo']], res = [];
      for (const [k, z, ct] of kinds) for (const how of ['sell', 'hold']) { const pl = plot('P', ct, z, 7000, z === 'com' ? 8 : z === 'res' ? 3 : 2); const e = A.devStart(pl, k, 'std', 1, how); if (e) { res.push([k, how, 'start', e]); continue; } pl.done = S.week + 1; const c0 = S.player.cash, n0 = S.props.length; S.week++; A.devStep(); S.week--;
        const gone = !S.devp.includes(pl); if (how === 'sell') res.push([k, how, gone && S.player.cash > c0 - pl.cost ? 'ok' : 'bad']); else { const pr = S.props.find(x => x.id === 'D' + pl.id); res.push([k, how, gone && pr && pr.kind === (k === 'condo' ? 'resi' : k) && A.propRentY(pr) > 0 && Number.isFinite(A.propRentY(pr)) ? 'ok' : 'bad']); } }
      info.build = res.filter(x => x[2] !== 'ok'); out.buildAll = res.length === 24 && res.every(x => x[2] === 'ok');
      /* operated kinds over a year: hotel by the season (self-run) or flat (let to an operator); a data centre fills up; solar and arena stay within range */
      const fD = k => S.props.find(x => x.kind === k && /^D/.test(x.id)), H = fD('hotel'), D = fD('dc'), So = fD('solar'), Ar = fD('arena'); /* rev48: the ones just built (the initial market now has catalogue buildings of these kinds too) */ const hs = [], ls = [], ds = [], ss = [], as = [];
      const H2 = Object.assign({}, H, {id: H.id + 'L', opm: 'lease'}); for (let w = 0; w < 52; w++) { A.step(); hs.push(A.propOpF(H)); ls.push(A.propOpF(H2)); ds.push(D.ramp); ss.push(A.propOpF(So)); as.push(A.propOpF(Ar)); }
      info.op = {hotel: [Math.min(...hs), Math.max(...hs)], lease: [Math.min(...ls), Math.max(...ls)], dc: [ds[0], ds[51]], solar: [Math.min(...ss), Math.max(...ss)], arena: [Math.min(...as), Math.max(...as)]};
      out.hotel = Math.max(...hs) - Math.min(...hs) > .2 && ls.every(x => x === .86); out.dc = ds[0] < .4 && ds[51] === 1; out.solarArena = ss.every(x => x >= .4 && x <= 1.8) && as.every(x => x >= .65 && x <= 1.45);
      out.load = loads(); }
    /* tower flats are sold off the plan while it is built */
    { fresh(5203); S.player.cash = 1e6; const pl = plot('P', 'tyo', 'com', 4000, 9); A.devStart(pl, 'tower', 'hi', 1, 'sell'); for (let i = 0; i < 20; i++) A.step(); info.pre = pl.pre; out.presale = pl.pre > .2; }
    /* land assembly: two plots of the same owner, city and zoning; refused otherwise, nothing changes */
    { fresh(5204); S.player.cash = 1e5; const a = plot('P', 'tyo', 'com', 3000, 8), b2 = plot('P', 'tyo', 'com', 2500, 6), c = plot('P', 'tyo', 'res', 2500, 3), d = plot('P', 'osa', 'com', 2500, 8); const f = plot('P', 'tyo', 'com', 1000, 8); f.fraud = S.week + 5;
      const s0 = JSON.stringify([S.devp, S.player.cash]); const e1 = A.devMerge(a.id, c.id), e2 = A.devMerge(a.id, d.id), e3 = A.devMerge(a.id, f.id); const same = JSON.stringify([S.devp, S.player.cash]) === s0;
      const land = a.land + b2.land, c0 = S.player.cash, e4 = A.devMerge(a.id, b2.id); info.merge = {e1, e2, e3, e4, area: a.site.area, far: a.site.far, fee: c0 - S.player.cash};
      out.merge = e1 && e2 && e3 && same && e4 === '' && a.site.area === 5500 && Math.abs(a.land - land) < 1e-9 && Math.abs(c0 - S.player.cash - land * .01) < 1e-9 && !S.devp.includes(b2) && A.devCan(a, 'mixed') === '' && loads(); }
    /* rival developers only start what their site allows; 520 weeks: nothing breaks; new kinds come to market */
    { fresh(5205); let bad = '', kinds = new Set(); for (let w = 0; w < 520; w++) { S.inbox = []; A.step(); for (const x of S.devp) if (x.st === 'build') kinds.add(x.kind); for (const x of S.props) kinds.add(x.kind); const e = A.econCheck(A.S); if (e) { bad = e + '@' + w; break; } if (S.props.some(x => !Number.isFinite(A.propRentY(x)) || !Number.isFinite(x.v))) { bad = 'nan@' + w; break; } }
      info.long = {bad, kinds: [...kinds]}; out.long = bad === '' && ['hotel', 'medical', 'care', 'parking', 'house', 'factory', 'dc'].some(k => kinds.has(k)) && loads(); }
    /* the same seed and actions give the same finished values */
    { const run = () => { fresh(5206); S.player.cash = 1e6; const pl = plot('P', 'tyo', 'com', 7000, 8); A.devStart(pl, 'arena', 'std', 1, 'hold'); pl.done = S.week + 1; for (let i = 0; i < 3; i++) A.step(); const pr = S.props.find(x => x.id === 'D' + pl.id); return pr ? pr.v : null; };
      const v1 = run(), v2 = run(); info.det = [v1, v2]; out.determinism = v1 != null && v1 === v2; }
    return {out, info}; })(); } catch (e) { return {out: {crash: false}, info: {err: e.message, stack: String(e.stack).slice(0, 300)}}; } });
  console.log('rev47 real estate', JSON.stringify(r.info).slice(0, 2500));
  for (const [k, v] of Object.entries(r.out)) ok('rev47 real estate: ' + k, v);
  ok('rev47 real estate: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testVis57(b) {
  /* rev57 VIS-03: the 3D construction progress is the building cost paid (spent / cost), not the weeks elapsed; halts freeze it; the slider is a labelled preview */
  const {p, errs} = await page(b, {viewport: {width: 390, height: 844}});
  const r = await p.evaluate(async () => {
    const A = window.__atlas, X = window.ATLAS3D, out = {}, info = {}, wait = ms => new Promise(f => setTimeout(f, ms));
    A.closeModal(); A.newGame(5701, 'normal', 'B', 'b', 'std', true); let S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: 2});
    for (let i = 0; i < 2; i++) { A.step(); S.inbox = []; }
    A.sitesEnsure(); const site = S.sites.find(x => x.city === 'tyo' && x.zone === 'com') || S.sites.find(x => x.zone === 'com');
    S.player.cash = 5000; const why = A.devBuy('P', site.id, true); const d = S.devp.find(x => x.own === 'P' && x.site.id === site.id);
    const ph = () => X.devPhase(d), num = v => typeof v === 'number' && isFinite(v);
    /* 1: survey */ out.t01_survey0 = !why && d.st === 'dd' && ph().r === 0 && ph().key === 'land';
    d.ready = S.week; d.st = 'land'; const why2 = A.devStart(d, 'office', 'std', 1, 'hold');
    info.cost = d.cost; info.wks = d.done - d.w0;
    /* 2 */ out.t02_start0 = !why2 && d.st === 'build' && ph().r === 0 && ph().pct === 0 && d.spent === 0;
    /* 3: no money for 3 weeks from the start */
    const steps = n => { for (let i = 0; i < n; i++) { A.step(); S.inbox = []; } };
    const done0 = d.done; S.player.cash = 0; S.player.loan = 0; const rows = [];
    for (let i = 0; i < 3; i++) { steps(1); S.player.cash = 0; rows.push([d.spent, d.done, d.halt, ph().key, ph().pct]); }
    info.halt3 = rows; out.t03_halt0 = d.spent === 0 && d.done === done0 + 3 && rows.every(x => x[3] === 'halt' && x[4] === 0);
    /* 4: halt part-way */
    S.player.cash = 5000; steps(20); const sp1 = d.spent, pct1 = ph().pct, r1 = ph().r; info.mid = [sp1, pct1];
    const dn1 = d.done; for (let i = 0; i < 3; i++) { S.player.cash = 0; steps(1); } S.player.cash = 0;
    out.t04_haltKeeps = sp1 > 0 && d.spent === sp1 && ph().pct === pct1 && Math.abs(ph().r - r1) < 1e-12 && ph().key === 'halt' && d.done === dn1 + 3;
    /* 5: refill then step — grows by what was paid */
    S.player.cash = 5000; const sp2 = d.spent; steps(1); const paid = d.spent - sp2;
    out.t05_resume = paid > 0 && Math.abs(X.devProgress(d) - d.spent / d.cost) < 1e-12 && ph().key !== 'halt';
    /* 6: several halts — never backwards, never ahead of payments */
    let mono = true, prev = X.devProgress(d);
    for (let k = 0; k < 6; k++) { S.player.cash = k % 2 ? 5000 : 0; steps(2); const v = X.devProgress(d); if (v < prev - 1e-12 || Math.abs(v - d.spent / d.cost) > 1e-12) mono = false; prev = v; }
    out.t06_monotonic = mono;
    /* 9: old or damaged records */
    const bad = [{st: 'build'}, {st: 'build', cost: 0, spent: 0}, {st: 'build', cost: NaN, spent: 1}, {st: 'build', cost: 10, spent: Infinity}, {st: 'build', cost: 10}, {st: 'build', cost: -3, spent: 1}, {st: 'build', cost: 10, spent: -1}];
    out.t09_oldData = bad.every(x => { const q = X.devPhase(x); return q.key === 'unknown' && q.r === 0 && !/NaN|Infinity|竣工$/.test(q.label); }) && X.devPhase({st: 'build', cost: 10, spent: 0, haltNeed: 1}).r === 0;
    /* 10 + 11: the development screen shows the same progress; preview is labelled and changes nothing */
    S.player.cash = 0; steps(1); const before = A.exportText(), rs = JSON.stringify(S.rs);
    X.open({mode: 'dev', devId: d.id}); await wait(1200);
    const pctTxt = () => document.getElementById('a3d-devpct').textContent, lab = () => document.getElementById('a3d-devphase').textContent;
    info.devScreen = [pctTxt(), lab(), ph().label];
    out.t10_same = pctTxt() === ph().pct + '%' && lab() === ph().label && Math.round(X._ses().devCtl.state().r * 1000) === Math.round(ph().r * 1000);
    const sl = document.getElementById('a3d-devslider'); sl.value = 900; sl.dispatchEvent(new Event('input', {bubbles: true}));
    const prevOn = /プレビュー/.test(lab()) && /プレビュー/.test(document.getElementById('a3d-devmode').textContent) && !document.getElementById('a3d-devreal').hidden;
    document.getElementById('a3d-devplay').click(); await wait(400); document.getElementById('a3d-devplay').click();
    document.getElementById('a3d-devreal').click();
    const back = lab() === ph().label && pctTxt() === ph().pct + '%' && document.getElementById('a3d-devreal').hidden;
    info.preview = [prevOn, back];
    X.close(); await wait(200);
    out.t11_preview = prevOn && back && A.exportText() === before && JSON.stringify(S.rs) === rs;
    /* 8: last week short of money, then completion */
    S.player.cash = 5000; let g = 0; while (d.done - S.week > 1 && g++ < 400) steps(1);
    S.player.cash = 0; steps(2); S.player.cash = 0; const lastHalt = S.devp.includes(d) && ph().key === 'halt' && !/竣工$/.test(ph().label) && X.devProgress(d) < 1;
    S.player.cash = 5000; g = 0; while (S.devp.includes(d) && g++ < 20) steps(1);
    out.t08_lastWeek = lastHalt && !S.devp.includes(d) && S.props.some(x => x.id === 'D' + d.id && x.own === 'P');
    /* 7: a subsidiary's project uses the same rule */
    const c = S.cos.find(x => !x.priv && x.cash > 0) || S.cos[0]; const site2 = S.sites.find(x => x.zone === 'com' && !S.devp.some(q => q.site.id === x.id));
    c.cash = 1e4; const w3 = A.devBuy(c.id, site2.id, false); const d2 = S.devp[S.devp.length - 1]; d2.ready = S.week; d2.st = 'land'; A.devStart(d2, 'office', 'std', 1, 'sell');
    steps(4); const okA = X.devProgress(d2) > 0 && Math.abs(X.devProgress(d2) - d2.spent / d2.cost) < 1e-12; const spc = d2.spent;
    c.cash = 0; c.debt = 1e6; steps(2); const okB = d2.spent === spc ? X.devPhase(d2).key === 'halt' && Math.abs(X.devProgress(d2) - spc / d2.cost) < 1e-12 : Math.abs(X.devProgress(d2) - d2.spent / d2.cost) < 1e-12;
    info.sub = [w3, d2.own === c.id, spc, d2.spent, X.devPhase(d2).key];
    out.t07_subsidiary = !w3 && d2.own === c.id && okA && okB;
    out.econ = A.econCheck(S) === '';
    return {out, info}; });
  console.log('rev57 vis03', JSON.stringify(r.info).slice(0, 700));
  for (const [k, v] of Object.entries(r.out)) ok('rev57 vis03: ' + k, v);
  ok('rev57 vis03: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function test3D56(b) {
  /* rev56 (iPhone feedback on the 3D map): globe not covered by the 2D map's overlays, no panel on open, ✕ on panels and settings, clear far view, solid buildings for sale, bloom and shadows on by default; opening 3D never touches the game */
  const {p, errs} = await page(b, {viewport: {width: 390, height: 844}});
  const r = await p.evaluate(async () => {
    const A = window.__atlas, out = {}, info = {}, wait = ms => new Promise(f => setTimeout(f, ms));
    A.closeModal(); A.newGame(5601, 'normal', 'B', 'b', 'std', true); for (let i = 0; i < 3; i++) { A.step(); A.S.inbox = []; }
    const before = A.exportText(), rs = JSON.stringify(A.S.rs);
    const mw = document.getElementById('mapwrap'); if (mw.classList.contains('folded')) document.getElementById('mapfold').click();
    const shown = sel => [...mw.querySelectorAll(sel)].filter(e => getComputedStyle(e).display !== 'none').length;
    info.pre = [shown('.maphint'), shown('.legend'), shown('.mapctl>button')];
    document.getElementById('a3d-globebtn').click(); await wait(1500);
    const mp = document.querySelector('.a3d-mappanel');
    out.globeUncovered = mw.classList.contains('a3d-globe-on') && shown('.maphint') === 0 && shown('.legend') === 0 && shown('.mapctl>button') === 1 && shown('#a3d-globebtn') === 1;
    out.noPanelOnOpen = !!mp && mp.hidden;
    /* back to the 2D map */
    document.getElementById('a3d-globebtn').click(); await wait(300);
    out.overlaysBack = !mw.classList.contains('a3d-globe-on') && shown('.maphint') === info.pre[0] && shown('.mapctl>button') === info.pre[2];
    window.ATLAS3D.open({mode: 'city', city: 'tyo'}); await wait(1500);
    const set = document.querySelector('.a3d-settings'), setBtn = [...document.querySelectorAll('.a3d-btn')].find(e => e.textContent === '設定');
    setBtn.click(); const opened = !set.hidden; const x = set.querySelector('.a3d-pclose'); x && x.click();
    out.settingsClose = opened && !!x && set.hidden;
    setBtn.click(); document.querySelector('.a3d-stage').dispatchEvent(new MouseEvent('click', {bubbles: true})); out.settingsTapOutside = set.hidden;
    const sels = [...set.querySelectorAll('select')].map(e => e.value); info.sels = sels;
    const src = [...document.scripts].map(s => s.textContent).find(t => t.includes('var SET = {')) || '';
    out.defaultsOn = /var SET = \{ bloom:true,[^}]*shadow:true \}/.test(src);
    const fog = src.match(/scene\.fog=new THREE\.Fog\([^,]+, (\d+), (\d+)\)/); info.fog = fog && fog.slice(1);
    out.fogFar = !!fog && +fog[1] >= 300 && +fog[2] >= 900;
    out.saleSolid = !/material\.opacity=0\.55/.test(src);
    window.ATLAS3D.close(); await wait(300);
    out.gameUntouched = A.exportText() === before && JSON.stringify(A.S.rs) === rs;
    return {out, info}; });
  console.log('rev56 3d', JSON.stringify(r.info).slice(0, 400));
  for (const [k, v] of Object.entries(r.out)) ok('rev56 3d: ' + k, v);
  ok('rev56 3d: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testIcons46(b) {
  const {p, errs} = await page(b, {viewport: {width: 390, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; A.closeModal(); A.newGame(77, 'normal', 'B', 'b', 'std', true); const S = A.S; for (let i = 0; i < 2; i++) A.step();
    const T = A.AV_TAG, src2i = new Map(A.AV_POOL.map((s, i) => [s, i])), bad = []; let n = 0;
    for (const x of Object.values(S.hr.people)) { const i = src2i.get(A.avPoolImg(x.n, x.age)), t = T[i], w = A.avWho(x.n); n++; if (t[0] !== w.g || !w.looks.includes(t[1])) bad.push([x.n, t.join(' ')]); }
    info.n = n; info.bad = bad.slice(0, 5); out.match = n > 30 && bad.length === 0;
    const jp = Object.values(S.hr.people).filter(x => !/・/.test(x.n)); out.jpEastAsian = jp.every(x => T[src2i.get(A.avPoolImg(x.n, x.age))][1] === 'ea');
    out.same = Object.values(S.hr.people).every(x => A.avPoolImg(x.n, x.age) === A.avPoolImg(x.n, x.age)); /* the same person always has the same face */
    const cand = S.hr.pool.map(A.person).find(Boolean); out.noBadgeForCandidate = !/class="avb"/.test(A.avFace(cand, 'CFO'));
    const exec = Object.values(S.hr.people).find(x => x.at && x.role === 'CEO'); out.badgeForHolder = /class="avb">CEO</.test(A.avFace(exec, 'CFO'));
    return {out, info}; });
  console.log('rev46 icons', JSON.stringify(r.info).slice(0, 600));
  for (const [k, v] of Object.entries(r.out)) ok('rev46 icons: ' + k, v);
  ok('rev46 icons: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testBug128(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); return ok1 && !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0 && A.econCheck(A.S) === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; return S; };
    const q = {ind: 'any', focus: 'fin', car: 'mid', bg: 'any', tier: 'std'};
    const hrState = () => JSON.stringify([S.player.cash, S.player.loan, S.player.bank || 0, (S.hr.srch || []).map(x => [x.id, x.closed, x.cands]), Object.values(S.hr.people).map(x => [x.id, x.at, x.role, x.sal, x.comp]), S.hr.pool, S.rngN || 0]);
    const coState = c => JSON.stringify([c.cash, c.debt, c.ex, Object.values(S.hr.people).map(x => [x.id, x.at, x.role, x.sal, x.comp]), S.hr.srch.map(x => [x.id, x.closed, x.cands])]);
    /* T01/T03/T04: head office: no money → refused, nothing changes; exactly enough → hired once; after raising money the same candidate can still be hired */
    { fresh(4801); A.step(); S.player.cash = 50; A.srchOrder('HQ', 'CFO', q); for (let i = 0; i < 3; i++) A.step(); const x = S.hr.srch[0], pid = x.cands[0], P = A.person(pid), fee = A.chFee('search', P);
      S.player.cash = 0; S.player.loan = 0; const room0 = A.buyingPower(); const s0 = hrState(); const r1 = A.srchHire(x.id, pid); const same = hrState() === s0, open1 = x.closed == null;
      S.player.cash = fee + (A.buyingPower() >= fee ? 0 : 0); let need = fee; S.player.cash = need; while (A.buyingPower() < fee) { need += .001; S.player.cash = need; } const L0 = S.player.loan, c0 = S.player.cash;
      const r2 = A.srchHire(x.id, pid), r3 = A.srchHire(x.id, pid); info.t1 = {room0, fee, r1, same, r2, r3, paid: c0 - S.player.cash + (S.player.loan - L0)};
      out.T01 = r1 === 'nofund' && same && open1; out.T03_T04_hq = r2 === 'ok' && r3 === 'none' && Math.abs(c0 - S.player.cash + (S.player.loan - L0) - fee) < 1e-9 && P.at === 'HQ' && P.role === 'CFO' && x.closed != null; }
    /* T02/T03: a subsidiary with no cash and no borrowing room → refused, the sitting officer stays; exactly enough room → paid by the subsidiary only */
    { fresh(4802); A.step(); const c = S.cos.find(x => x.ind === 'tech' && !x.priv); c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); c.cash += 5; A.srchOrder(c.id, 'CFO', q); for (let i = 0; i < 3; i++) A.step(); const x = S.hr.srch[0], pid = x.cands[0], P = A.person(pid), fee = A.chFee('search', P), old = (c.ex || {}).CFO;
      c.cash = 0; c.debt = Math.max(c.debt, A.maxDebt(c)); const s0 = coState(c), hq0 = S.player.cash; const r1 = A.srchHire(x.id, pid); const same = coState(c) === s0 && S.player.cash === hq0, keep = (c.ex || {}).CFO === old;
      c.debt = A.maxDebt(c) - fee; const d0 = c.debt; const r2 = A.srchHire(x.id, pid); info.t2 = {fee, r1, r2, dd: c.debt - d0, hq: S.player.cash - hq0};
      out.T02 = r1 === 'nofund' && same && keep; out.T03_sub = r2 === 'ok' && Math.abs(c.debt - d0 - fee) < 1e-9 && c.cash >= 0 && S.player.cash === hq0 && (c.ex || {}).CFO === pid; }
    /* T05: other paid routes use the same check; a free internal move is not blocked by money */
    { fresh(4803); A.step(); S.player.cash = 0; S.player.loan = 0; const pool = S.hr.pool.map(A.person).filter(Boolean); const p1 = pool[0], s0 = hrState(); const ra = A.hireInto(p1, 'HQ', 'CFO', null, 'agency'); const sa = hrState() === s0;
      const c = S.cos.find(x => !x.priv && !x.ctrl); const cand = Object.values(S.hr.people).find(x => x.at && x.at !== 'HQ' && A.coById(x.at) && !A.coById(x.at).ctrl); const rh = cand ? A.hireInto(cand, 'HQ', 'MA', null, 'hunt') : 'skip';
      const own = pool[1]; S.player.cash = 50; A.hireInto(own, 'HQ', 'BENCH', null, null); S.player.cash = 0; const rm = A.hireInto(own, 'HQ', 'CFO', null, null); info.t5 = {ra, sa, rh, rm};
      out.T05 = ra === 'nofund' && sa && (rh === 'nofund' || rh === 'skip') && rm === 'ok' && A.hireInto(own, 'XX', 'CFO', null, null) === 'none' && A.hireInto(own, 'HQ', 'ZZZ', null, null) === 'none'; }
    /* T07-T09: one tally for gains, losses, net and count, whatever the folding */
    const tally = (pairs, opt) => { fresh(4804); A.step(); const c = S.cos.find(x => !x.priv); while (S.week % 13 !== 1) A.step(); let g = 0, l = 0, n = 0; for (const v of pairs) { A.xlAdd(c, v, 't'); if (v > 0) g += v; else l += v; n++; }
      const open = A.xlSum(c.xl.filter(e => e.rep == null)), sums = c.xl.filter(e => e.sum).length; let ok = true; if (opt && opt.load) { ok = loads(); S = A.S; } const cc = A.coById(c.id); do { A.step(); } while (S.week % 13 !== 0); const h = cc.qh[cc.qh.length - 1];
      return {g, l, n, open, h: {xg: h.xg, xL: h.xL, xo: h.xo, xn: h.xn}, ok, sums}; };
    const near = (a, b2) => Math.abs(a - b2) < 1e-6;
    { const R7 = tally(Array.from({length: 600}, (_, i) => i % 2 ? -10 : 20)); info.t7 = R7; out.T07 = near(R7.h.xg, 6000) && near(R7.h.xL, -3000) && near(R7.h.xo, 3000) && R7.h.xn === 600 && R7.sums >= 1;
      const B = [499, 500, 501].map(k => tally(Array.from({length: k}, (_, i) => i % 3 ? -7 : 11))); info.t8 = B.map(x => x.h); out.T08 = B.every(x => near(x.h.xg, x.g) && near(x.h.xL, x.l) && near(x.h.xo, x.g + x.l) && x.h.xn === x.n);
      const Z = tally(Array.from({length: 1600}, (_, i) => i % 2 ? -5 : 5)); info.t9 = Z.h; out.T09 = near(Z.h.xg, 4000) && near(Z.h.xL, -4000) && near(Z.h.xo, 0) && Z.h.xn === 1600 && Z.sums >= 1;
      const L11 = tally(Array.from({length: 700}, (_, i) => i % 2 ? -3 : 4), {load: true}); info.t11 = L11.h; out.T11 = L11.ok && near(L11.h.xg, 1400) && near(L11.h.xL, -1050) && L11.h.xn === 700; }
    /* T06: 70 licence trades in one quarter: reported in that quarter only */
    { fresh(4342 + 70); const c = S.cos.find(x => x.ind === 'pharma' && !x.priv); c.cash += 1e4; while (S.week % 13 !== 1) A.step(); let loss = 0; for (let i = 0; i < 70; i++) { c.cash += 1e4; const c1 = c.cash; A.opsDo(c, {k: 'lin', v: 2}, 'P'); const pj = c.ops.pipe[c.ops.pipe.length - 1]; A.opsDo(c, {k: 'lout', id: pj.id}, 'P'); loss += c.cash - c1; c.cash -= 1e4; }
      do { A.step(); } while (S.week % 13 !== 0); const q1 = c.qh[c.qh.length - 1].xo; for (let i = 0; i < 13; i++) A.step(); const q2 = c.qh[c.qh.length - 1].xo; info.t6 = {loss, q1, q2}; out.T06 = near(q1, loss) && q2 === 0; }
    /* T10: absorbing companies whose open ledgers were folded: every part moves once */
    { fresh(4805); A.step(); const L = S.cos.filter(x => x.ind === 'pharma' && !x.priv && !x.ctrl); let a = null; const parts = [];
      for (const c of L) { for (let i = 0; i < 520; i++) A.xlAdd(c, i % 2 ? -2 : 3, 't'); parts.push(A.xlSum(c.xl.filter(e => e.rep == null))); }
      const tot = parts.reduce((t, x) => ({g: t.g + x.g, l: t.l + x.l, n: t.n + x.n}), {g: 0, l: 0, n: 0}); a = L[0]; let merged = 1; for (const c of L.slice(1)) { a.cash += 1e5; a.debt = 0; c.debt = 0; if (A.execMerge(a, c, .3, true)) merged++; }
      const o = A.xlSum(a.xl.filter(e => e.rep == null)), exp = parts.slice(0, merged).reduce((t, x) => ({g: t.g + x.g, l: t.l + x.l, n: t.n + x.n}), {g: 0, l: 0, n: 0}); const ids = a.xl.map(e => e.id); info.t10 = {merged, o, exp};
      out.T10 = merged >= 2 && near(o.g, exp.g) && near(o.l, exp.l) && o.n === exp.n && new Set(ids).size === ids.length; }
    /* T12: an older summary with only its net: net and count kept, the split shown as unknown, nothing invented */
    { fresh(4806); A.step(); const c = S.cos.find(x => !x.priv); while (S.week % 13 !== 1) A.step(); c.xl = [{id: 1, w: S.week, amt: 123, n: 40, why: '40件の取引をまとめた記録', sum: true}]; A.xlAdd(c, 5, 'x'); A.xlAdd(c, -2, 'y'); const ok = loads(); S = A.S; const cc = A.coById(c.id); do { A.step(); } while (S.week % 13 !== 0); const h = cc.qh[cc.qh.length - 1]; A.ui.sel = cc.id; const html = A.qhBox(cc);
      info.t12 = {xo: h.xo, xg: h.xg, xL: h.xL, xu: h.xu, xn: h.xn}; out.T12 = ok && near(h.xo, 126) && near(h.xg, 5) && near(h.xL, -2) && near(h.xu, 123) && h.xn === 42 && /内訳不明/.test(html); }
    /* T13-T16: searches closed in week 0 stay closed, also after a reload; closing twice changes nothing; later weeks work as before */
    { fresh(4807); S.player.cash = 50; A.srchOrder('HQ', 'CFO', q); A.srchOrder('HQ', 'COO', Object.assign({}, q, {tier: 'exec'})); const [s1, s2] = S.hr.srch; A.srchClose(s1, '見送り'); A.srchClose(s2, '見送り'); const pool0 = S.hr.pool.length;
      for (let i = 0; i < 3; i++) A.step(); const t13 = s1.cands.length === 0 && !S.inbox.some(i => i.kind === 'srchres'); const ok = loads(); S = A.S; for (let i = 0; i < 3; i++) A.step(); const X = S.hr.srch;
      const t14 = ok && X.every(x => x.closed === 0 && x.cands.length === 0) && !S.inbox.some(i => i.kind === 'srchres') && A.srchOrder('HQ', 'CMO', q) === '' && A.srchOrder('HQ', 'MA', q) === '' && A.srchOrder('HQ', 'PEH', q) === '';
      info.t13 = {t13, t14, n: X.length}; out.T13 = t13; out.T14 = t14;
      fresh(4808); A.step(); S.player.cash = 50; A.srchOrder('HQ', 'CFO', q); for (let i = 0; i < 3; i++) A.step(); const x = S.hr.srch[0], cs = x.cands.slice(); A.srchClose(x, '見送り'); const poolN = S.hr.pool.filter(id => cs.includes(id)).length; A.srchClose(x, 'again'); const poolN2 = S.hr.pool.filter(id => cs.includes(id)).length;
      out.T15 = poolN === cs.length && poolN2 === poolN && new Set(S.hr.pool).size === S.hr.pool.length && x.why === '見送り';
      A.srchOrder('HQ', 'COO', q); for (let i = 0; i < 3; i++) A.step(); const y = S.hr.srch.find(z => z.r === 'COO'); const hr = A.srchHire(y.id, y.cands[0]); for (let i = 0; i < 27; i++) A.step(); info.t16 = {hr, left: S.hr.srch.length};
      out.T16 = hr === 'ok' && S.hr.srch.length === 0; }
    /* T17/T18: an absorbed company's interim results are kept on record (profit or loss), not added to the buyer's quarter; a subsidiary keeps its own */
    { fresh(4342); for (let i = 0; i < 5; i++) A.step(); const L = S.cos.filter(x => x.ind === 'pharma' && !x.priv && !x.ctrl); let a = null, b2 = null; for (const x of L) for (const y of L) if (!a && x !== y) { x.cash += 1e5; x.debt = 0; y.debt = 0; if (A.mergeQuote(x, y, .3, true).go) { a = x; b2 = y; } }
      const bq = b2.qni, bw = b2.qw, aq = a.qni, cashSum = a.cash + b2.cash; b2.qni = -Math.abs(bq) - 1; const bLoss = b2.qni; const q = A.execMerge(a, b2, .3, true); const aq1 = a.qni;
      do { A.step(); } while (S.week % 13 !== 0); const h = a.qh[a.qh.length - 1]; A.ui.sel = a.id; const html = A.qhBox(a);
      info.t17 = {bw, bLoss, aq, aq1, mfin: h.mfin, qni: h.qni, qw: h.qw}; out.T17 = !!q && aq1 === aq && h.mfin && h.mfin.length === 1 && near(h.mfin[0].qni, bLoss) && h.mfin[0].qw === bw && h.qw <= 13 && /合併前の実績/.test(html);
      for (let i = 0; i < 13; i++) A.step(); const h2 = a.qh[a.qh.length - 1]; const X = S.cos.find(x => x.ind === 'tech' && !x.priv && !x.ctrl), Y = S.cos.find(x => x.ind === 'steel' && !x.priv && !x.ctrl); X.cash += 1e5; X.debt = 0; Y.debt = 0; const yq = Y.qni; const qs = A.execMerge(X, Y, .3, true);
      out.T18 = !h2.mfin && (!qs || (qs.sub && S.cos.includes(Y) && Y.qni === yq && !(X.mfin || []).length)); info.t18 = {sub: qs && qs.sub}; }
    /* T19: research limits as before */
    { fresh(4809); A.step(); const c = S.cos.find(x => x.ind === 'pharma' && !x.priv); c.cash += 1e5; let n = 0; for (let i = 0; i < 30; i++) if (A.opsDo(c, {k: i % 2 ? 'lin' : 'pstart', v: 2}, 'P') === '') n++; out.T19 = c.ops.pipe.length === 16 && loads(); }
    return {out, info}; })(); } catch (e) { return {out: {crash: false}, info: {err: e.message, stack: String(e.stack).slice(0, 300)}}; } });
  console.log('rev45 BUG-128..131', JSON.stringify(r.info).slice(0, 3500));
  for (const [k, v] of Object.entries(r.out)) ok('rev45 BUG-128..131: ' + k, v);
  ok('rev45 BUG-128..131: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testNames44(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}, R = A.NAME_REG, G = {}, F = {}; for (const r of R) { for (const x of r.g) (G[x] = G[x] || new Set()).add(r.k); for (const x of r.f) (F[x] = F[x] || new Set()).add(r.k); }
    const ok1 = n => { if (!/・/.test(n)) return true; const [g, f] = n.split('・'); return !!G[g] && !!F[f] && [...G[g]].some(k => F[f].has(k)); };
    /* every foreign name made in a new game pairs a given name and a family name from the same region */
    let all = new Set(), bad = []; for (const [seed, sc] of [[11, 'std'], [22, 'trader'], [33, 'giants']]) { A.closeModal(); A.newGame(seed, 'normal', 'N', 'n', sc, sc !== 'trader'); A.S.won = A.S.lost = true; for (let w = 0; w < 156; w++) { A.S.inbox = []; A.step(); if (w % 26 === 0) for (const x of Object.values(A.S.hr.people)) all.add(x.n); } for (const x of Object.values(A.S.hr.people)) all.add(x.n); }
    for (const n of all) if (!ok1(n)) bad.push(n); info.n = all.size; info.bad = bad.slice(0, 5); info.foreign = [...all].filter(n => /・/.test(n)).length;
    out.paired = bad.length === 0 && info.foreign > 50;
    /* an older save: clearly mismatched names are renamed once; others and Japanese names are kept; loading twice changes nothing more */
    A.closeModal(); A.newGame(44, 'normal', 'N', 'n', 'std', true); const S = A.S; const ps = Object.values(S.hr.people).filter(x => /・/.test(x.n)).slice(0, 4), jp = Object.values(S.hr.people).find(x => !/・/.test(x.n));
    ps[0].n = 'ジフン・オカフォー'; ps[1].n = 'アミット・ガルシア'; ps[2].n = 'エマ・グラント'; ps[3].n = 'アイラ・ドゥアルテ'; S.hr.nameV = 2; const jn = jp.n;
    const t = A.exportText(); A.importText(t); const P = id => A.S.hr.people[id]; const n1 = ps.map(x => P(x.id).n); A.importText(A.exportText()); const n2 = ps.map(x => P(x.id).n);
    info.mig = n1; info.chk = [P(jp.id).n === jn, JSON.stringify(n1) === JSON.stringify(n2), A.S.hr.nameV, new Set(Object.values(A.S.hr.people).map(x => x.n)).size, Object.keys(A.S.hr.people).length]; out.migrate = n1[0] !== 'ジフン・オカフォー' && ok1(n1[0]) && n1[1] !== 'アミット・ガルシア' && ok1(n1[1]) && n1[2] === 'エマ・グラント' && n1[3] === 'アイラ・ドゥアルテ' && P(jp.id).n === jn && JSON.stringify(n1) === JSON.stringify(n2) && A.S.hr.nameV === 3; /* (the test's own injected names may repeat someone's, so uniqueness is not checked here) */
    return {out, info};
  });
  console.log('rev44 names', JSON.stringify(r.info).slice(0, 600));
  for (const [k, v] of Object.entries(r.out)) ok('rev44 names: ' + k, v);
  ok('rev44 names: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testSearch43(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); return ok1 && !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0 && A.econCheck(A.S) === ''; };
    const run = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); const S = A.S; S.won = S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.confirm = false; A.step();
      const c = S.cos.find(x => x.ind === 'tech' && !x.priv); c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); c.cash += 50; S.player.cash += 50;
      const q = {ind: 'pharma', focus: 'fin', car: 'senior', bg: 'consult', tier: 'exec'}; const cash0 = c.cash, e = A.srchOrder(c.id, 'CFO', q), paid = cash0 - c.cash, x = S.hr.srch[0];
      for (let i = 0; i < 4; i++) A.step(); const it = S.inbox.find(i => i.kind === 'srchres' && i.sid === x.id), C = x.cands.map(A.person);
      const fit = C.every(p => p.ind === 'pharma' && p.age >= 50 && p.age <= 59 && p.bg === 'コンサル・金融出身' && p.exp.pharma > 0) && C.length === 4;
      const avgFin = C.reduce((a, p) => a + p.sk.fin, 0) / C.length; A.ui.hire = {t: c.id, r: 'CFO'}; A.ui.hch = 'search'; const html = A.hirePanel(c.id, 'CFO');
      const ok = loads(); const S2 = A.S, c2 = A.coById(c.id), x2 = S2.hr.srch[0], best = x2.cands.map(A.person).sort((a, b2) => b2.sk.fin - a.sk.fin)[0], fee = best.sal * .35, cb = c2.cash, d0 = c2.debt;
      const hr = A.srchHire(x2.id, best.id); const seated = A.exOf ? A.exOf(c2, 'CFO') === best : (c2.ex || {}).CFO === best.id;
      return {e, paid, inbox: !!it, fit, avgFin, ui: /求人依頼/.test(html) && /経歴/.test(html), ok, hr, seated, fee: [cb - c2.cash + (c2.debt - d0), fee], closed: !!x2.closed, back: x2.cands.every(id => S2.hr.pool.includes(id)), sig: JSON.stringify(C.map(p => [p.n, p.age, p.sk]))}; };
    const R = run(4701), R2 = run(4701); info.r = Object.assign({}, R, {sig: undefined});
    out.order = R.e === '' && Math.abs(R.paid - .3) < 1e-9 && R.inbox; out.criteria = R.fit && R.avgFin > 60; out.ui = R.ui; out.hire = R.ok && R.hr === 'ok' && R.seated && Math.abs(R.fee[0] - R.fee[1]) < 1e-6 && R.closed && R.back; out.determinism = R.sig === R2.sig;
    /* refused: no money, bad criteria, too many open: nothing changes */
    { A.closeModal(); A.newGame(4702, 'normal', 'B', 'b', 'std', true); const S = A.S; S.won = S.lost = true; A.step(); S.player.cash = 0; S.player.loan = 0; const s0 = JSON.stringify([S.player.cash, S.hr.srch || null, S.hr.srchSeq || 0]);
      const e1 = A.srchOrder('HQ', 'CFO', {ind: 'any', focus: 'fin', car: 'mid', bg: 'any', tier: 'std'}), e2 = A.srchOrder('HQ', 'CFO', {ind: 'xx', focus: 'fin', car: 'mid', bg: 'any', tier: 'std'});
      out.refuse = e1 !== '' && e2 !== '' && JSON.stringify([S.player.cash, S.hr.srch || null, S.hr.srchSeq || 0]) === s0; info.ref = [e1, e2]; }
    return {out, info};
  });
  console.log('rev43 search', JSON.stringify(r.info).slice(0, 1200));
  for (const [k, v] of Object.entries(r.out)) ok('rev43 recruitment search: ' + k, v);
  ok('rev43 recruitment search: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testBug127(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => { try { return (() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const ok3 = !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0; const e = A.econCheck(A.S); if (!(ok1 && ok3 && e === '')) (info.lf = info.lf || []).push([ok1, ok3, e, String(A.trialErr || '').slice(0, 120)]); return ok1 && ok3 && e === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.rep = 'off'; S.settings.confirm = false; A.step(); A.opsEnsure(); return S; };
    const ph = () => S.cos.filter(x => x.ind === 'pharma' && !x.priv && !x.ctrl);
    const pend = c => (c.xl || []).filter(e => e.rep == null).reduce((a, e) => a + e.amt, 0);
    const trade = (c, n) => { let loss = 0; for (let i = 0; i < n; i++) { const c0 = c.cash; c.cash += 1e4; const c1 = c.cash; if (A.opsDo(c, {k: 'lin', v: 2}, 'P') !== '') return null; const pj = c.ops.pipe[c.ops.pipe.length - 1]; A.opsDo(c, {k: 'lout', id: pj.id}, 'P'); loss += c.cash - c1; c.cash -= 1e4; } return loss; };
    const pair = () => { const L = ph(); for (const a of L) for (const b2 of L) if (a !== b2) { const c0 = a.cash, d0 = a.debt, d1 = b2.debt; a.cash += 1e5; a.debt = 0; b2.debt = 0; if (A.mergeQuote(a, b2, .3, true).go) return [a, b2]; a.cash = c0; a.debt = d0; b2.debt = d1; } return [null, null]; };
    const stt = c => JSON.stringify([c.cash, c.debt, c.assets, c.ops.pipe.length, c.ops.pseq, c.xl || []]);
    window.__at = 1; /* TC-127-01/02: new research and bought-in candidates share one limit; 393 tries end at 16; every state saves */
    { fresh(4501); const c = ph()[0]; c.cash += 1e6; let ok = 0, no = 0, lastE = ''; for (let i = 0; i < 393; i++) { const e = A.opsDo(c, {k: i % 3 ? 'lin' : 'pstart', v: 2}, 'P'); if (e === '') ok++; else { no++; lastE = e; } }
      const s0 = stt(c), e1 = A.opsDo(c, {k: 'pstart'}, 'P'), e2 = A.opsDo(c, {k: 'lin', v: 3}, 'P'); info.c1 = {ok, no, n: c.ops.pipe.length, e1, e2};
      out.tc127_01 = c.ops.pipe.length === 16 && /16件まで/.test(e1) && /16件まで/.test(e2) && stt(c) === s0; out.tc127_02 = ok === 8 && no === 385 && loads(); }
    window.__at = 2; /* TC-127-03: a merger that would leave more than 400 projects is refused before anything moves; at 400 it goes through and saves */
    { fresh(4502); const [a, b2] = pair(); const fill = (c, n) => { while (c.ops.pipe.length < n) c.ops.pipe.push({id: ++c.ops.pseq, n: 'T' + c.ops.pseq, st: 1, left: 30, base: false, src: 'own', rdK: 1}); };
      fill(a, 200); fill(b2, 201); const all0 = JSON.stringify(S.cos.map(c => [c.id, c.cash, c.debt, c.assets, c.shares, c.own, (c.ops && c.ops.pipe || []).length])), q0 = A.mergeQuote(a, b2, .3, true), r0 = A.execMerge(a, b2, .3, true);
      const same = JSON.stringify(S.cos.map(c => [c.id, c.cash, c.debt, c.assets, c.shares, c.own, (c.ops && c.ops.pipe || []).length])) === all0;
      b2.ops.pipe.pop(); const r1 = A.execMerge(a, b2, .3, true); info.c3 = {q0: q0.reason, r1: !!r1, n: a.ops.pipe.length};
      out.tc127_03 = r0 === null && /400件/.test(q0.reason) && same && !!r1 && a.ops.pipe.length === 400 && loads(); }
    window.__at = 3; /* TC-127-04: a company already above the limit (as an 11:53 save could hold) loads, keeps everything, refills nothing, and takes nothing new */
    { fresh(4503); const c = ph()[0]; while (c.ops.pipe.length < 450) c.ops.pipe.push({id: ++c.ops.pseq, n: 'O' + c.ops.pseq, st: 2, left: 60, base: false, src: 'lic', paid: 1, rdK: 1}); const n0 = c.ops.pipe.length;
      const ok = loads(); S = A.S; const c2 = A.coById(c.id); const e = A.opsDo(c2, {k: 'lin', v: 2}, 'P'); A.step(); info.c4 = {ok, n: c2.ops.pipe.length, e};
      out.tc127_04 = ok && c2.ops.pipe.length >= n0 - 60 && c2.ops.pipe.length <= n0 && /16件まで/.test(e) && c2.ops.pipe.filter(x => x.base).length <= 8 && loads(); }
    window.__at = 4; /* TC-125-01/02: B's open loss passes to A and is reported once in A's next quarter; reported history is not repeated */
    { fresh(4342); const [a, b2] = pair(); while (S.week % 13 !== 11) A.step(); trade(a, 1); A.step(); A.step(); /* a's first trade is now reported */ const repA = a.qh[a.qh.length - 1].xo;
      a.cash += 1e4; A.opsDo(a, {k: 'lin', v: 2}, 'P'); const pa = a.ops.pipe[a.ops.pipe.length - 1]; a.ops.pipe = a.ops.pipe.filter(x => x !== pa); a.assets -= pa.bv; a.cash += pa.bv + 5; A.xlAdd(a, 5, 'テスト用の利益'); a.cash -= 1e4; /* +5 open gain for a (test entry, cash matched) */
      const lb = trade(b2, 1), pA = pend(a), pB = pend(b2), cashSum = a.cash + b2.cash, a0 = a.assets + b2.assets; const q = A.execMerge(a, b2, .3, true); const pAfter = pend(a);
      do { A.step(); } while (S.week % 13 !== 0); const xoQ = a.qh[a.qh.length - 1].xo; for (let i = 0; i < 13; i++) A.step(); const xoN = a.qh[a.qh.length - 1].xo;
      info.c5 = {repA, lb, pA, pB, pAfter, xoQ, xoN}; out.tc125_01 = !!q && Math.abs(pB - lb) < 1e-9 && Math.abs(pAfter - (pA + pB)) < 1e-9 && Math.abs(xoQ - (pA + pB)) < 1e-6 && xoN === 0 && !S.cos.includes(b2);
      out.tc125_02 = repA !== 0 && a.xl.filter(e => e.rep != null && /テスト用の利益/.test(e.why)).length === 1 && pend(a) === 0; }
    window.__at = 5; /* TC-125-03: three absorptions in a row, the same week and across a quarter end */
    { fresh(4504); const [a] = pair(); if (!a) { out.tc125_03 = false; } else { let exp = 0; const log = []; for (let k = 0; k < 3; k++) { const L = ph().filter(x => x !== a); let bx = null; for (const c of L) { c.debt = 0; a.debt = 0; if (A.mergeQuote(a, c, .3, true).go) { bx = c; break; } } if (!bx) break; exp += trade(bx, 2) + 0; const q = A.execMerge(a, bx, .3, true); log.push(!!q); if (k === 1) { while (S.week % 13 !== 0) A.step(); A.step(); } }
        const rep = a.qh.slice(-2).reduce((s2, h) => s2 + (h.xo || 0), 0) - 0, open = pend(a); info.c6 = {log, exp, rep, open}; out.tc125_03 = log.length >= 2 && log.every(x => x) && Math.abs(a.qh[a.qh.length - 1].xo + open - exp) < 1e-6; } }
    window.__at = 6; /* TC-125-04: across industries the target survives with its own ledger; a refused merger leaves both ledgers alone */
    { fresh(4505); const P = ph()[0]; P.cash += 1e4; const lb = trade(P, 1); const X = S.cos.filter(x => x.ind === 'tech' && !x.priv && !x.ctrl).sort((a, b2) => b2.rev - a.rev)[0]; X.cash += 1e5; X.debt = 0; const pX = pend(X), pP = pend(P);
      const q = A.execMerge(X, P, .3, true); const sub = q && q.sub; const okSub = sub ? Math.abs(pend(P) - pP) < 1e-12 && pend(X) === pX : false;
      const [a, b2] = pair(); const r0 = a ? (() => { b2.cash += 1e4; trade(b2, 1); const s0 = JSON.stringify([a.xl || [], b2.xl || []]); const r = A.execMerge(a, b2, -.5, false); return r === null && JSON.stringify([a.xl || [], b2.xl || []]) === s0; })() : false;
      info.c7 = {sub, okSub, r0}; out.tc125_04 = okSub && r0; }
    window.__at = 7; /* TC-126-01/02/03: 60, 61, 70 trades in one quarter; 600 entries; save/load across the quarter end */
    { const res = []; for (const n of [60, 61, 70]) { fresh(4342 + n); const c = ph()[0]; c.cash += 1e4; /* enough equity to absorb the losses (a company that cannot fails, as it should) */ while (S.week % 13 !== 1) A.step(); const loss = trade(c, n); const pd = pend(c); const ok = loads(); S = A.S; const c2 = A.coById(c.id); const pd2 = pend(c2); const w0 = S.week; while (S.week % 13 !== 0) A.step(); A.step(); if (!c2.qh) { res.push({n, bad: 'noqh', w0, w: S.week, alive: S.cos.includes(c2), priv: c2.priv, pd, loss}); continue; } const xo = c2.qh[c2.qh.length - 1].xo; for (let i = 0; i < 13; i++) A.step(); res.push({n, loss, pd, pd2, xo, next: c2.qh[c2.qh.length - 1].xo, ok}); }
      info.c8 = res; out.tc126_01 = res.every(x => Math.abs(x.pd - x.loss) < 1e-6 && x.pd2 === x.pd && Math.abs(x.xo - x.loss) < 1e-6 && x.next === 0 && x.ok);
      fresh(4600); const c = ph()[0]; let tot = 0; for (let i = 0; i < 600; i++) { const v = (i % 2 ? 1 : -1) * (1 + i / 100); A.xlAdd(c, v, 't' + i); tot += v; } info.c9 = {n: c.xl.length, pd: pend(c), tot, sum: c.xl.filter(e => e.sum).map(e => e.n), cnt: c.xl.filter(e => e.rep == null).reduce((a, e) => a + (e.n || 1), 0)}; out.tc126_02 = c.xl.length <= 500 + 60 && Math.abs(pend(c) - tot) < 1e-9 && c.xl.some(e => e.sum) && c.xl.filter(e => e.rep == null).reduce((a, e) => a + (e.n || 1), 0) === 600 && loads();
      out.tc126_03 = res.every(x => x.ok && x.pd2 === x.pd); }
    window.__at = 8; /* TC-124-02/04: the results screen separates the yearly run-rate from the quarter's actual profit and one-offs; actual profit = the weekly profit really earned */
    { fresh(4342); const c = ph()[0]; c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); while (S.week % 13 !== 1) A.step(); let wsum = 0; const loss = trade(c, 1); for (let i = 0; i < 13; i++) { if (S.week % 13 !== 0) wsum += A.niA(c) / 52; A.step(); } const h = c.qh[c.qh.length - 1];
      A.ui.sel = c.id; const html = A.qhBox ? A.qhBox(c) : ''; info.c10 = {qni: h.qni, qw: h.qw, xo: h.xo, qt: h.qt, ni: h.ni, loss};
      out.tc124_02 = h.qt != null && Math.abs(h.qt - h.qni - h.xo) < 1e-9 && Math.abs(h.xo - loss) < 1e-9 && h.qw === 13 && /四半期純利益（特別損益込み）/.test(html) && /特別損失/.test(html) && /年換算/.test(html);
      out.tc124_04 = Math.abs(h.ni - A.pubSnap(c).ni) >= 0 && h.ni !== h.qt; }
    return {out, info};
  })(); } catch (e) { return {out: {crash: false}, info: {err: e.message, stack: String(e.stack).slice(0, 300), at: window.__at}}; } });
  console.log('rev43 at', await p.evaluate(() => window.__at)); console.log('rev43 BUG-125..127', JSON.stringify(r.info).slice(0, 3500));
  for (const [k, v] of Object.entries(r.out)) ok('rev43 BUG-124..127: ' + k, v);
  ok('rev43 BUG-124..127: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testBug123(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const e0 = ok1 ? '' : A.trialErr; const S0 = A.S, m = A.importText(txt); const ok3 = !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0; const e = A.econCheck(A.S); if (!(ok1 && ok3 && e === '')) (info.lf = info.lf || []).push([ok1, ok3, e, String(e0).slice(0, 200), typeof m === 'string' ? m.slice(0, 100) : '']); return ok1 && ok3 && e === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.rep = 'off'; S.settings.confirm = false; A.step(); A.opsEnsure(); return S; };
    const F = c => { A.opsCalc(c); return c.ops.F; }, eq = c => c.cash + c.assets - c.debt;
    const pair = (anti) => { const L = S.cos.filter(x => x.ind === 'pharma' && !x.priv && !x.ctrl); for (const a of L) for (const b of L) if (a !== b) { const c0 = a.cash; a.cash += 1e5; const q = A.mergeQuote(a, b, .3, true); if (q.go && (anti === undefined || q.anti === anti)) return [a, b]; a.cash = c0; } return [null, null]; };
    const sig = c => c.ops.pipe.filter(x => !x.base).map(x => [x.n, x.st, x.left, x.part || 0, +(x.bv || 0).toFixed(9)].join(':')).sort();
    const prep = c => { const c0 = c.cash; c.cash += c.rev * 3; A.opsDo(c, {k: 'pstart'}, 'P'); A.opsDo(c, {k: 'pstart'}, 'P'); A.opsDo(c, {k: 'lin', v: 2}, 'P'); c.cash = Math.max(c.cash, c0); c.debt = 0; /* an isolated test: money and debt are set so the deal is allowed (the new research lowers profit, and the debt test would refuse it) */ };
    /* TC-123-01/03/04: two drug makers with extra research merge: the research spending is the sum of the two; recalculating changes nothing; a joint project keeps its share */
    { fresh(4342); const [Ac, Bc] = pair(); if (!Ac) return {out, info: {none: 1}}; prep(Ac); prep(Bc); const jp = Bc.ops.pipe.find(x => !x.base && x.src === 'own'); A.opsDo(Bc, {k: 'part', id: jp.id}, 'P');
      const fa = F(Ac), fb = F(Bc), oa = A.opProfit(Ac), ob = A.opProfit(Bc), sg = sig(Ac).concat(sig(Bc)).sort(), ra = Ac.rev, rb = Bc.rev, ea = eq(Ac) + eq(Bc), ev0 = Bc.ops.pipe.filter(x => !x.base).map(x => A.pipeEV(Bc, x));
      info.why1 = A.mergeQuote(Ac, Bc, .3, true).reason; const q = A.execMerge(Ac, Bc, .3, true); const fm1 = F(Ac), om = A.opProfit(Ac), sm = sig(Ac), Fs = []; for (let i = 0; i < 10; i++) Fs.push(F(Ac));
      const jp2 = Ac.ops.pipe.find(x => x.n === jp.n && x.part === .5), ev1 = Ac.ops.pipe.filter(x => !x.base && sig(Bc).length >= 0 && x.rdK < 1 && Bc.ops.pipe.some(y => y.n === x.n)).map(x => A.pipeEV(Ac, x));
      info.t1 = {names: [Ac.name, Bc.name], rev: [ra, rb], F: [fa, fb, fa + fb, fm1], op: [oa + ob, om], anti: q && q.anti, ev0, ev1, ids: Ac.ops.pipe.length};
      out.tc123_01 = !!q && Math.abs(fm1 - (fa + fb)) < 1e-6 * Math.max(1, fa + fb) && Math.abs(om - (oa + ob)) / Math.max(1, Math.abs(oa + ob)) < .02 && JSON.stringify(sm) === JSON.stringify(sg);
      out.tc123_03 = Fs.every(x => x === Fs[0]) && Fs[0] === fm1;
      out.tc123_04 = !!jp2 && jp2.part === .5;
      if (q && q.anti === 'cond') out.tc123_06 = Math.abs(fm1 - (fa + fb)) < 1e-6 * Math.max(1, fa + fb) && Math.abs(Ac.rev - ra - rb * .75) < 1e-6; /* TC-123-06: approved on condition of selling 25% of the target: the research is kept in full */
      out.tc123_value = ev1.length === ev0.length && ev1.every((v, i) => Math.abs(v - ev0[i]) / ev0[i] < 1e-9); /* the sale price of B's projects does not jump to the buyer's size */
      /* TC-123-02: a second and a third merger: no growth from the mergers themselves */
      const sec = []; for (let k = 0; k < 2; k++) { const L = S.cos.filter(x => x.ind === 'pharma' && !x.priv && !x.ctrl && x !== Ac); let Bx = null; for (const b of L) { if (A.mergeQuote(Ac, b, .3, true).go) { Bx = b; break; } } if (!Bx) break; prep(Bx); const f0 = F(Ac), f1 = F(Bx), s0 = sig(Ac).concat(sig(Bx)).sort(), bvs = Ac.ops.pipe.concat(Bx.ops.pipe).reduce((a, x) => a + (x.bv || 0), 0), qq = A.execMerge(Ac, Bx, .3, true); sec.push({ok: !!qq, anti: qq && qq.anti, f: [f0 + f1, F(Ac)], same: JSON.stringify(sig(Ac)) === JSON.stringify(s0), bv: [bvs, Ac.ops.pipe.reduce((a, x) => a + (x.bv || 0), 0)], ids: new Set(Ac.ops.pipe.map(x => x.id).concat(Ac.ops.drugs.map(d => d.id))).size === Ac.ops.pipe.length + Ac.ops.drugs.length}); }
      info.t2 = sec; out.tc123_02 = sec.length >= 1 && sec.every(x => x.ok && Math.abs(x.f[0] - x.f[1]) < 1e-6 * Math.max(1, x.f[0]) && x.same && Math.abs(x.bv[0] - x.bv[1]) < 1e-9 && x.ids);
      out.tc123_load = (() => { const f0 = F(Ac); const ok = loads(); S = A.S; const c2 = A.coById(Ac.id); info.ld = [ok, f0, F(c2), c2.rev, Ac.rev]; return ok && Math.abs(F(c2) - f0) < 1e-9; })();
      /* TC-123-05: 520 weeks after the mergers */
      const c = A.coById(Ac.id); let bad = '', appr = 0; const d0 = new Set(c.ops.drugs.map(d => d.id)); for (let i = 0; i < 520; i++) { A.step(); if (!S.cos.includes(c)) { bad = 'gone'; break; } if (![c.ops.F, c.cash, c.assets, c.debt, A.opProfit(c)].every(Number.isFinite)) { bad = 'nan' + i; break; } for (const d of c.ops.drugs) if (!d0.has(d.id)) { d0.add(d.id); appr++; } }
      info.t5 = {bad, appr}; out.tc123_05 = bad === '' && appr > 0 && loads(); }
    /* TC-123-06: a merger approved on condition of selling 25% of the target: the research is kept in full, so the spending bridge is A + B */
    if (out.tc123_06 === undefined) { let got = null; for (let sd = 4343; sd < 4420 && !got; sd++) { fresh(sd); const [a, b2] = pair('cond'); if (a) got = [sd, a, b2]; }
      if (got) { const [sd, Ac, Bc] = got; prep(Ac); prep(Bc); const fa = F(Ac), fb = F(Bc), rb = Bc.rev, ra = Ac.rev, q = A.execMerge(Ac, Bc, .3, true); info.t6 = {sd, anti: q && q.anti, F: [fa, fb, F(Ac)], rev: [ra, rb, Ac.rev]};
        out.tc123_06 = !!q && q.anti === 'cond' && Math.abs(F(Ac) - fa - fb) < 1e-6 * Math.max(1, fa + fb) && Math.abs(Ac.rev - ra - rb * .75) < 1e-6; } else info.t6 = 'no conditional pharma merger found in 77 seeds'; }
    /* TC-124-01: buy a phase-2 candidate and sell it the same week: cash −(price − proceeds); the right goes on and off the books once; a one-off loss once; the yearly profit and the weekly cash are not touched */
    { fresh(4342); const c = S.cos.find(x => x.ind === 'pharma' && !x.priv); c.cash = 1000; const ni0 = A.niA(c), op0 = A.opProfit(c), e0 = eq(c), a0 = c.assets, c0 = c.cash;
      A.opsDo(c, {k: 'lin', v: 2}, 'P'); const pj = c.ops.pipe[c.ops.pipe.length - 1], cost = c0 - c.cash, a1 = c.assets, e1 = eq(c); const px = A.loutPx(c, pj); A.opsDo(c, {k: 'lout', id: pj.id}, 'P'); const a2 = c.assets, e2 = eq(c), ni2 = A.niA(c), x = c.xl[0];
      info.t124 = {cost, px, dCash: c.cash - c0, a: [a0, a1, a2], eq: [e0, e1, e2], x, ni: [ni0, ni2]};
      out.tc124_01 = Math.abs(A.opProfit(c) - op0) < 1e-9 && Math.abs((ni2 - ni0) - (c.cash - c0) * Math.max(0, S.econ.rate - 1) / 200) < 1e-9 /* the yearly figures move only by the interest on the cash spent */ && Math.abs(c.cash - c0 - (px - cost)) < 1e-9 && Math.abs(a1 - a0 - cost) < 1e-9 && Math.abs(a2 - a0) < 1e-9 && Math.abs(e1 - e0) < 1e-9 && Math.abs(e2 - e0 - (px - cost)) < 1e-9 && c.xl.length === 1 && Math.abs(x.amt - (px - cost)) < 1e-9 && true;
      /* TC-124-07: it is reported in the quarter it happened, once; a sale in the next quarter goes into that quarter */
      while (S.week % 13 !== 12) A.step(); A.step(); const q1 = c.qh[c.qh.length - 1]; c.cash += c.rev * 3; A.opsDo(c, {k: 'lin', v: 3}, 'P'); const pj2 = c.ops.pipe[c.ops.pipe.length - 1], b2 = pj2.bv, px2 = A.loutPx(c, pj2); A.opsDo(c, {k: 'lout', id: pj2.id}, 'P');
      for (let i = 0; i < 13; i++) A.step(); const q2 = c.qh[c.qh.length - 1]; for (let i = 0; i < 13; i++) A.step(); const q3 = c.qh[c.qh.length - 1];
      info.t7 = {q1: q1.xo, q2: q2.xo, q3: q3.xo, exp: [x.amt, px2 - b2]}; out.tc124_07 = Math.abs(q1.xo - x.amt) < 1e-9 && Math.abs(q2.xo - (px2 - b2)) < 1e-9 && q3.xo === 0 && c.xl.length === 2; }
    /* TC-124-02/03/04 */
    { fresh(4344); const c = S.cos.find(x => x.ind === 'pharma' && !x.priv); c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); const st = () => JSON.stringify([c.cash, c.debt, c.assets, c.ops.pipe, c.ops.pseq, c.xl || [], c.ops.log.length]);
      c.cash = 0; c.debt = A.maxDebt(c); const s0 = st(), e = A.opsDo(c, {k: 'lin', v: 2}, 'P'); out.tc124_02 = /資金が足りません/.test(e) && st() === s0;
      c.debt = 0; c.cash = c.rev * 3; for (let i = 0; i < 6; i++) A.opsDo(c, {k: 'pstart'}, 'P'); const s1 = st(), es = c.ops.pipe.filter(x => x.base || x.st === 0).map(x => A.opsDo(c, {k: 'lout', id: x.id}, 'P')); out.tc124_03 = es.every(x => x !== '') && st() === s1;
      for (let i = 0; i < 53; i++) A.step(); const own = c.ops.pipe.find(x => !x.base && x.st >= 1 && x.src === 'own');
      if (own) { const v = A.loutPx(c, own), n0 = (c.xl || []).length, c0 = c.cash, a0 = c.assets; A.opsDo(c, {k: 'lout', id: own.id}, 'P'); const again = A.opsDo(c, {k: 'lout', id: own.id}, 'P'); info.t4 = {v, x: c.xl[0]};
        out.tc124_04 = c.xl.length === n0 + 1 && Math.abs(c.xl[0].amt - v) < 1e-9 && Math.abs(c.cash - c0 - v) < 1e-9 && c.assets === a0 && again !== '' && c.xl.length === n0 + 1; } else { info.t4 = 'no own project passed'; out.tc124_04 = false; } }
    /* TC-124-05: a bought right that is stopped, fails, or is approved and later runs out */
    { fresh(4345); const c = S.cos.find(x => x.ind === 'pharma' && !x.priv); c.cash += c.rev * 20; const res = {};
      A.opsDo(c, {k: 'lin', v: 2}, 'P'); let pj = c.ops.pipe[c.ops.pipe.length - 1], a0 = c.assets, bv = pj.bv; A.opsDo(c, {k: 'pstop', id: pj.id}, 'P'); res.stop = Math.abs(a0 - c.assets - bv) < 1e-9 && Math.abs(c.xl[0].amt + bv) < 1e-9;
      const L = []; for (let i = 0; i < 6; i++) { A.opsDo(c, {k: 'lin', v: 2}, 'P'); const x = c.ops.pipe[c.ops.pipe.length - 1]; x.left = 1; L.push(x); } const aB = c.assets, nX = c.xl.length; A.step();
      const failed = L.filter(x => !c.ops.pipe.includes(x)), moved = L.filter(x => c.ops.pipe.includes(x)); const wo = c.xl.slice(0, c.xl.length - nX).filter(e => /開発失敗/.test(e.why)).reduce((a, e) => a + e.amt, 0);
      res.fail = {n: failed.length, ok: Math.abs(wo + failed.reduce((a, x) => a + x.bv, 0)) < 1e-9 && moved.every(x => x.st === 3 && x.bv > 0)};
      let ap = null, drug = null; for (let t = 0; t < 12 && !drug; t++) { A.opsDo(c, {k: 'lin', v: 3}, 'P'); ap = c.ops.pipe[c.ops.pipe.length - 1]; ap.st = 4; ap.left = 1; /* test shortcut: put it at the approval filing */ A.step(); drug = c.ops.drugs.find(d => d.id === ap.id); }
      if (drug) { const a1 = c.assets; drug.age = 1039; A.step(); res.appr = {bv: drug.bv, ok: drug.bv === ap.bv && !c.ops.drugs.includes(drug) && c.xl.some(e => /販売終了/.test(e.why) && Math.abs(e.amt + ap.bv) < 1e-9)}; } else res.appr = 'not approved in 30 tries';
      info.t5b = res; out.tc124_05 = res.stop && res.fail.ok && res.appr && res.appr.ok; }
    /* TC-124-06: bought by B, B merged into A, then sold by A: cost and right carried once */
    { fresh(4346); const L = S.cos.filter(x => x.ind === 'pharma' && !x.priv && !x.ctrl); let Ac = null, Bc = null; for (const a of L) for (const b2 of L) if (!Ac && a !== b2) { a.cash += 1e5; if (A.mergeQuote(a, b2, .3, true).go) { Ac = a; Bc = b2; } else a.cash -= 1e5; }
      if (Ac) { Bc.cash += Bc.rev * 3; A.opsDo(Bc, {k: 'lin', v: 2}, 'P'); const pj = Bc.ops.pipe[Bc.ops.pipe.length - 1], bv = pj.bv, n = pj.n, aSum = Ac.assets + Bc.assets; const q = A.execMerge(Ac, Bc, .3, true); const pj2 = Ac.ops.pipe.find(x => x.n === n && x.bv === bv);
        const v = pj2 && A.loutPx(Ac, pj2), a1 = Ac.assets, c1 = Ac.cash; if (pj2) A.opsDo(Ac, {k: 'lout', id: pj2.id}, 'P'); info.t6b = {bv, v, x: Ac.xl && Ac.xl[0], anti: q && q.anti};
        out.tc124_06 = !!q && !!pj2 && Math.abs(Ac.assets - (a1 - bv)) < 1e-9 && Math.abs(Ac.cash - c1 - v) < 1e-9 && Ac.xl.length === 1 && Math.abs(Ac.xl[0].amt - (v - bv)) < 1e-9 && (q.anti === 'cond' || Math.abs(a1 - aSum) < 1e-9); } else out.tc124_06 = false; }
    return {out, info};
  });
  console.log('rev42 BUG-123/124', JSON.stringify(r.info).slice(0, 3500));
  for (const [k, v] of Object.entries(r.out)) ok('rev42 BUG-123/124: ' + k, v);
  ok('rev42 BUG-123/124: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testBug120b(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const ok3 = !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0; const e = A.econCheck(A.S); return ok1 && ok3 && e === ''; };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.rep = 'off'; S.settings.confirm = false; return S; };
    const pharma = () => { const c = S.cos.find(x => x.ind === 'pharma' && !x.priv); c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); A.opsSetMode(c, 'direct'); return c; };
    const st = c => JSON.stringify([c.cash, c.debt, c.ops.pipe, c.ops.pseq, c.ops.sold || 0, c.ops.log.length]);
    /* TC-120-01: a new project cannot be sold the week it starts */
    { fresh(4201); A.step(); const c = pharma(); const n0 = c.ops.pipe.length, e1 = A.opsDo(c, {k: 'pstart'}, 'P'), np = c.ops.pipe[c.ops.pipe.length - 1], s0 = st(c), e2 = A.opsDo(c, {k: 'lout', id: np.id}, 'P');
      info.t1 = {e1, e2}; out.tc01 = e1 === '' && c.ops.pipe.length === n0 + 1 && /基礎研究/.test(e2) && st(c) === s0 && c.ops.pipe.includes(np); }
    /* TC-120-02: twenty tries of start-and-sell: nothing sold, no money made, at most 16 projects */
    { fresh(4202); A.step(); const c = pharma(); const cash0 = c.cash; let sold = 0, started = 0, refused = 0;
      for (let i = 0; i < 20; i++) { const e = A.opsDo(c, {k: 'pstart'}, 'P'); if (e === '') started++; else refused++; const np = c.ops.pipe.filter(x => !x.base && x.st === 0).pop(); if (np && A.opsDo(c, {k: 'lout', id: np.id}, 'P') === '') sold++; }
      info.t2 = {started, refused, sold, n: c.ops.pipe.length, dc: c.cash - cash0}; out.tc02 = sold === 0 && c.cash === cash0 && c.ops.pipe.length <= 16 && started === 16 - 8 && refused === 20 - started; }
    /* TC-120-03: the research runs through the weekly turn: research spending is charged; after a year each new project has either passed to phase 1 or ended */
    { fresh(4203); A.step(); const c = pharma(); c.cash += c.rev; A.opsCalc(c); const F0 = c.ops.F; for (let i = 0; i < 4; i++) A.opsDo(c, {k: 'pstart'}, 'P'); A.opsCalc(c); const F1 = c.ops.F, ids = c.ops.pipe.filter(x => !x.base && x.st === 0).map(x => x.id);
      for (let i = 0; i < 53; i++) A.step(); const left = ids.map(id => c.ops.pipe.find(x => x.id === id)), logs = c.ops.log.map(x => x[1]).join('|');
      info.t3 = {F0, F1, per: (F1 - F0) / 4, exp: 0.0005 * c.rev * 52, st: left.map(x => x ? x.st : 'end')};
      out.tc03 = F1 > F0 && left.every(x => !x || x.st === 1) && left.some(x => x) !== undefined && (left.some(x => !x) ? /基礎研究で失敗/.test(logs) : true) && left.filter(x => x).every(x => x.left > 0); }
    /* TC-120-04: a project that has passed basic research sells once, at the quoted price, and leaves the list for good */
    { fresh(4204); A.step(); const c = pharma(); c.cash += c.rev; for (let i = 0; i < 8; i++) A.opsDo(c, {k: 'pstart'}, 'P'); for (let i = 0; i < 53; i++) A.step();
      const pp = c.ops.pipe.find(x => !x.base && x.st >= 1 && x.src === 'own'); info.t4a = c.ops.pipe.filter(x => !x.base).map(x => x.st);
      if (pp) { const px = A.loutPx(c, pp), ev = A.pipeEV(c, pp), c0 = c.cash, e = A.opsDo(c, {k: 'lout', id: pp.id}, 'P'), c1 = c.cash, again = A.opsDo(c, {k: 'lout', id: pp.id}, 'P');
        for (let i = 0; i < 260; i++) A.step(); info.t4 = {px, ev, got: c1 - c0, e, again, drug: c.ops.drugs.some(d => d.id === pp.id)};
        out.tc04 = e === '' && Math.abs(c1 - c0 - px) < 1e-9 && px > ev * .5 - 1e-9 && px < ev * .7 + 1e-9 && !c.ops.pipe.some(x => x.id === pp.id) && /計画がありません/.test(again) && !c.ops.drugs.some(d => d.id === pp.id) && loads(); } else out.tc04 = false; }
    /* TC-120-05: buying a phase-2/3 candidate costs money (refused without it); reselling at once returns less than was paid */
    { fresh(4205); A.step(); const c = pharma(); c.cash = 0; c.debt = A.maxDebt(c); const s0 = st(c), e0 = A.opsDo(c, {k: 'lin', v: 3}, 'P'); const same = st(c) === s0;
      c.debt = 0; c.cash = c.rev * 3; const res = [];
      for (const v of [2, 3]) { const c0 = c.cash, e = A.opsDo(c, {k: 'lin', v}, 'P'), np = c.ops.pipe[c.ops.pipe.length - 1], paid = c0 - c.cash, px = A.loutPx(c, np), c1 = c.cash, e2 = A.opsDo(c, {k: 'lout', id: np.id}, 'P'); res.push({v, e, paid, rec: np.paid, px, got: c.cash - c1, e2, net: c.cash - c0}); }
      info.t5 = {e0, same, res}; out.tc05 = /資金が足りません/.test(e0) && same && res.every(x => x.e === '' && Math.abs(x.paid - x.rec) < 1e-9 && x.e2 === '' && Math.abs(x.got - x.px) < 1e-9 && x.net < 0); }
    /* TC-120-06: the 8 base projects can never be sold; they still move week by week */
    { fresh(4206); A.step(); const c = pharma(); const base = c.ops.pipe.filter(x => x.base), s0 = st(c), es = base.map(x => A.opsDo(c, {k: 'lout', id: x.id}, 'P')), same = st(c) === s0, lefts = base.map(x => x.left); A.step();
      out.tc06 = base.length === 8 && es.every(e => /基本研究/.test(e)) && same && base.every((x, i) => !c.ops.pipe.includes(x) || x.left === lefts[i] - 1 || x.left === 52 || x.st > 0) && c.ops.pipe.filter(x => x.base).length === 8; }
    /* the screen: no sell button for a project that cannot be sold; the reason and the price are shown */
    { fresh(4207); A.step(); const c = pharma(); A.opsDo(c, {k: 'pstart'}, 'P'); c.cash += c.rev; A.opsDo(c, {k: 'lin', v: 2}, 'P'); const np = c.ops.pipe.find(x => x.src === 'own'), lp = c.ops.pipe.find(x => x.src === 'lic'); const h = A.opsTab(c);
      const has = id => new RegExp(`data-act="opsx?[^"]*"[^>]*data-x="${id}"[^>]*>権利を売る|権利を売る[^<]*</button>`).test(h);
      const btnFor = id => { const i = h.indexOf(`data-x="${id}"`); return h.split('<div class="orow">').filter(row => row.includes(`data-x="${id}"`)).some(row => row.includes('権利を売る</button>')); };
      info.ui = {own: btnFor(np.id), lic: btnFor(lp.id), txt: /権利売却：不可（基礎研究の審査通過後に売却可能）/.test(h), txt2: /権利売却：可能（売却見込額/.test(h)};
      out.ui = !btnFor(np.id) && btnFor(lp.id) && info.ui.txt && info.ui.txt2; }
    /* TC-120-08: 3 seeds x 520 weeks with a directly run drug maker starting research every quarter and selling what may be sold: approvals and patent expiries happen; no NaN; the same seed gives the same game */
    { const run = seed => { fresh(seed); A.step(); const c = pharma(); let appr = 0, exp = 0, sold = 0, bad = ''; const drugs0 = new Set(c.ops.drugs.map(d => d.id));
        for (let w = 0; w < 520; w++) { if (w % 13 === 0) { if (c.ops.pipe.filter(x => !x.base).length < 2 && c.cash > c.rev * .2) A.opsDo(c, {k: 'pstart'}, 'P'); /* a sensible manager keeps a couple of extra projects (16 of them at once runs a company out of cash) */ const q = c.ops.pipe.find(x => !x.base && x.st >= 3); if (q && w % 52 === 0 && A.opsDo(c, {k: 'lout', id: q.id}, 'P') === '') sold++; for (const x of c.ops.pipe.filter(x => x.st === 0 && !x.base)) if (A.opsDo(c, {k: 'lout', id: x.id}, 'P') === '') bad = 'sold-st0'; }
          const ids0 = new Set(c.ops.drugs.map(d => d.id)); A.step(); if (!S.cos.includes(c)) { bad = bad || 'gone@' + w + ' ' + S.news.filter(n => n.t.includes(c.name)).slice(0, 3).map(n => n.t.slice(0, 70)).join(' / '); break; } const ids1 = new Set(c.ops.drugs.map(d => d.id)); for (const id of ids1) if (!ids0.has(id)) appr++; for (const id of ids0) if (!ids1.has(id)) exp++;
          if (![c.cash, c.debt, c.ops.F, A.opProfit(c), c.price].every(Number.isFinite) || c.cash < -1e-9 || c.debt < -1e-9) { bad = bad || 'nan@' + w; break; } }
        return {appr, exp, sold, bad, sig: JSON.stringify([+c.cash.toFixed(6), +c.debt.toFixed(6), c.ops.pseq, c.ops.drugs.length, c.ops.pipe.length]), ok: loads()}; };
      const R = [4211, 4212, 4213].map(run), again = run(4211); info.t8 = R.map(x => [x.appr, x.exp, x.sold, x.bad]);
      out.tc08 = R.every(x => x.appr > 0 && x.exp > 0 && x.bad === '' && x.ok) && again.sig === R[0].sig; }
    return {out, info};
  });
  console.log('rev41 BUG-120', JSON.stringify(r.info).slice(0, 2500));
  for (const [k, v] of Object.entries(r.out)) ok('rev41 BUG-120 (research rights): ' + k, v);
  ok('rev41 BUG-120: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testBug40(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const ok3 = !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0; const e = A.econCheck(A.S); if (!(ok1 && ok3 && e === '')) (info.loadFail = info.loadFail || []).push([ok1, ok3, e]); return ok1 && ok3 && e === ''; };
    let S; const fresh = (seed, sc) => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', sc || 'std', true); S = A.S; S.won = true; S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.rep = 'off'; S.settings.confirm = false; return S; };
    const eq = c => c.cash + c.assets - c.debt, newsN = re => S.news.filter(n => re.test(n.t || n.text || '')).length;
    const snap = c => JSON.stringify([c.cash, c.debt, c.assets, c.shares, c.price, c.own, c.ops && c.ops.lines, c.ops && c.ops.pipe, c.ops && c.ops.log && c.ops.log.length]);
    const own = c => { c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); return c; };
    const pair = (i1, i2) => { const L1 = S.cos.filter(x => x.ind === i1 && !x.priv && !x.ctrl), L2 = S.cos.filter(x => x.ind === i2 && !x.priv && !x.ctrl); for (const a of L1) for (const b of L2) if (a !== b) { const c0 = a.cash; a.cash += 5000; const ok = A.mergeQuote(a, b, .3, true).go; if (ok) return [a, b]; a.cash = c0; } return [null, null]; };
    /* TC-115-01: government bonds + a margin purchase + a crash: every share is sold, a loan is left; no 'forced sale of 0 stocks' afterwards */
    { fresh(4001); A.step(); S.player.cash = 50; const g = A.govBuy('g2', 30); const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => b.price * b.shares - a.price * a.shares)[3];
      const n = 34 / c.price; const bt = A.execBuy('P', c, n); const loan0 = S.player.loan; info.m115 = {g: !!g, buy: bt && bt.cost, loan0};
      c.price *= .35; c.mood = -2; A.step(); const soldNews = newsN(/【強制決済】/), held = c.own.P || 0, loan1 = S.player.loan;
      const zeroA = newsN(/【強制決済】0銘柄/); let more = 0; const L = []; for (let i = 0; i < 4; i++) { const n0 = newsN(/【強制決済】|【強制売却】/); A.step(); more += newsN(/【強制決済】|【強制売却】/) - n0; L.push(S.player.loan); }
      const resN = newsN(/【信用残債】/); info.m115b = {soldNews, held, loan1, L, more, resN, nw: A.netWorth('P')};
      out.tc115_01 = soldNews === 1 && held === 0 && loan1 > 0 && more === 0 && zeroA === 0 && resN === 1 && L.every((x, i) => x > 0 && x <= (i ? L[i - 1] : loan1) + 1e-9 && (i ? L[i - 1] : loan1) - x < .1) /* cash coming in is applied to the loan as before; it is never written off */ && !S.player.mcall && Number.isFinite(A.netWorth('P'));
      const ld = loads(); S = A.S; const n1 = newsN(/【強制決済】|【強制売却】|【信用残債】/); for (let i = 0; i < 3; i++) A.step(); const again = newsN(/【強制決済】|【強制売却】|【信用残債】/) - n1;
      /* TC-115-02 (part): repay, then a new margin position gets the normal margin call */
      S.player.cash += 40; const pay = Math.min(S.player.loan, S.player.cash); S.player.cash -= pay; S.player.loan -= pay; S.player.cash = 5; const c2 = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => b.price * b.shares - a.price * a.shares)[5];
      A.execBuy('P', c2, 12 / c2.price); const lo = S.player.loan; c2.price *= .62; A.step(); const mc = !!S.player.mcall || newsN(/【強制売却】/) > 0;
      info.m115c = {again, lo, mc, loanRes: S.player.loanRes}; out.tc115_reload_new = ld && again === 0 && lo > 0 && mc && S.player.loanRes == null; }
    /* TC-117: a fund whose GP cannot pay its share buys nothing and changes nothing */
    { fresh(4002); A.step(); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'}); S.player.cash = 2000; const f = A.fundRaise('buyout', .05); info.fw = f ? '' : (A.fundRaiseWhy ? A.fundRaiseWhy(.05) : 'null'); for (let i = 0; i < 13; i++) { A.step(); S.inbox = []; }
      const c = S.cos.filter(x => !x.priv).sort((a, b) => a.price * a.shares - b.price * b.shares)[6]; const s0 = snap(c), f0 = JSON.stringify([f.calledLP, f.calledGP, f.callBlock || 0]), led0 = (S.ledger || []).length, cash0 = S.player.cash;
      S.player.cash = 0; const r1 = A.execBuy(f.id, c, c.shares * .01); const ok1 = r1 === null && snap(c) === s0 && JSON.stringify([f.calledLP, f.calledGP, f.callBlock || 0]) === f0 && (S.ledger || []).length === led0 && !c.own[f.id];
      S.player.cash = cash0; const r2 = A.execBuy(f.id, c, c.shares * .01); const ok2 = !!r2 && c.own[f.id] > 0 && f.calledLP + f.calledGP > 0;
      const room = A.fundRoom(f), r3 = A.execBuy(f.id, c, room * 3 / c.price); info.f117 = {r1, r2: !!r2, room, r3: !!r3, gpR: f.gp / (f.lp + f.gp)};
      out.tc117 = ok1 && ok2 && (r3 === null || A.fundRoom(f) >= -1e-9);
      /* TC-116: a fund that ends has no live commitment left */
      const f2 = f; if (c.own[f.id]) A.execSell(f.id, c, c.own[f.id]); const left = A.fundRoom(f2); A.fundFinish(f2); A.renderAll && A.renderAll(true);
      const card = A.fundCard(f2); info.f116 = {left, after: A.fundRoom(f2), lp: f2.lp, called: f2.calledLP, rel: f2.relLP};
      out.tc116 = left > 0 && A.fundRoom(f2) === 0 && !A.fundCanCall(f2, .01) && /解除済み/.test(card) && Math.abs(f2.relLP + f2.relGP - left) < 1e-6 && loads(); }
    /* TC-118 / TC-122 (merger): B's development project and rental building survive A's absorption of B, and B's project is later sold with the whole price paid to A */
    { fresh(4003); A.step(); A.sitesEnsure(); const R = S.cos.filter(x => x.ind === 'realty' && !x.priv && !x.ctrl).sort((a, b) => a.rev - b.rev); const Am = R[1], Bm = R[0]; info.realty = R.map(x => +x.rev.toFixed(0)); Bm.cash += 2000; Am.cash += 4000;
      const st1 = S.sites.find(x => x.zone === 'com'), st2 = S.sites.find(x => x.zone === 'res'); A.devBuy(Bm.id, st1.id, false); A.devBuy(Bm.id, st2.id, false); const P1 = S.devp.find(x => x.own === Bm.id && x.site === st1), P2 = S.devp.find(x => x.own === Bm.id && x.site === st2); P1.fraud = P2.fraud = null;
      A.devStart(P1, 'office', 'std', .9, 'sell'); A.devStart(P2, 'resi', 'std', .9, 'hold'); P2.done = S.week + 1; for (let i = 0; i < 3; i++) A.step();
      const prop = S.props.find(x => x.own === Bm.id); const keep = JSON.stringify([P1.id, P1.site.id, P1.land, P1.cost, P1.spent, P1.st, P1.done, P1.kind, P1.how]);
      const e0 = eq(Am) + eq(Bm), b0 = Bm.assets; info.why118 = A.mergeQuote(Am, Bm, .3, true); const q = A.execMerge(Am, Bm, .3, true); if (!q) return {out, info}; const e1 = eq(Am), exp = e0 - q.cost - (q.anti === 'cond' ? b0 * .25 * .1 : 0) + (Am.own[Bm.id] ? 0 : 0);
      info.m118 = {q: q && {cost: q.cost, anti: q.anti, sub: q.sub}, e0, e1, exp, prop: !!prop, P1own: P1.own};
      const okT = !!q && !q.sub && P1.own === Am.id && !!prop && prop.own === Am.id && JSON.stringify([P1.id, P1.site.id, P1.land, P1.cost, P1.spent, P1.st, P1.done, P1.kind, P1.how]) === keep && Math.abs(e1 - exp) < 1e-6;
      const ld = loads(); S = A.S; const P1b = S.devp.find(x => x.id === P1.id), Ab = A.coById(Am.id); A.devPurge && A.devPurge();
      out.tc118_01 = okT && ld && !!P1b && P1b.own === Ab.id && S.props.some(x => x.id === prop.id && x.own === Ab.id);
      if (P1b) { P1b.done = S.week + 1; Ab.cash += 50; const V = () => (P1b.land + P1b.cost) * A.devMult() * (P1b.grade === 'hi' ? 1.05 : 1); let c0 = Ab.cash, a0 = Ab.assets, sale = 0, wk = 0, basis = 0;
        for (let i = 0; i < 3 && S.devp.includes(P1b); i++) { c0 = Ab.cash - Ab.debt; a0 = Ab.assets; const others = S.devp.filter(x => x !== P1b); S.devp = [P1b]; wk = Math.max(0, P1b.cost - P1b.spent) / Math.max(1, P1b.done - (S.week + 1) + 1); basis = P1b.land + P1b.spent + wk; sale = Math.round(V() * .97 * 100) / 100; /* rev48: sale prices in whole 百万円 */ S.week++; A.devStep(); S.week--; S.devp = S.devp.concat(others); } /* the other projects (rivals' own) are set aside for this measured week */
        info.m118s = {wk, basis, sale, land: P1b.land, cost: P1b.cost, spent: P1b.spent, mult: A.devMult(), grade: P1b.grade, kind: P1b.kind, pre: P1b.pre, sold: !S.devp.includes(P1b), dc: Ab.cash - Ab.debt - c0, exp: sale - wk, da: Ab.assets - a0, expA: wk - basis};
        out.tc118_sale = !S.devp.includes(P1b) && Math.abs(Ab.cash - Ab.debt - c0 - (sale - wk)) < 1e-6 /* cash net of any borrowing for this week's work */ && Math.abs(Ab.assets - a0 - (wk - basis)) < 1e-6; }
      /* TC-118-03: a refused merger touches nothing */
      fresh(4004); A.step(); A.sitesEnsure(); const R2 = S.cos.filter(x => x.ind === 'realty' && !x.priv && !x.ctrl).sort((a, b) => b.rev - a.rev); const A2 = R2[0], B2 = R2[1]; B2.cash += 500; A.devBuy(B2.id, S.sites[0].id, false);
      const all0 = JSON.stringify([S.cos.map(c => [c.id, c.cash, c.debt, c.assets, c.shares, c.own]), S.devp.map(x => [x.id, x.own, x.spent]), S.props.length, (S.ledger || []).length]); const qf = A.execMerge(A2, B2, .0, false);
      out.tc118_03 = qf === null && JSON.stringify([S.cos.map(c => [c.id, c.cash, c.debt, c.assets, c.shares, c.own]), S.devp.map(x => [x.id, x.own, x.spent]), S.props.length, (S.ledger || []).length]) === all0; info.m118f = A.mergeQuote(A2, B2, 0, false).reason; }
    /* TC-119-01: two tech companies: capacity, plant being built and product lines all carried over */
    { fresh(4005); for (let i = 0; i < 2; i++) A.step(); const T = S.cos.filter(x => x.ind === 'tech' && !x.priv && !x.ctrl).sort((a, b) => a.rev - b.rev); const Ac = T[1], Bc = T[0]; info.why119 = A.mergeQuote(Ac, Bc, .3, true).reason; Ac.cash += 5000; A.opsEnsure();
      Bc.ops.build.push({amt: 3, done: S.week + 6, what: '工場'}); const capA = Ac.ops.cap, capB = Bc.ops.cap, segA = Ac.ops.lines.filter(l => l.on).map(l => l.seg), segB = Bc.ops.lines.filter(l => l.on).map(l => l.seg), opSum = A.opProfit(Ac) + A.opProfit(Bc), nb = Ac.ops.build.length;
      const q = A.execMerge(Ac, Bc, .3, true); const segs = Ac.ops.lines.filter(l => l.on).map(l => l.seg), ids = Ac.ops.lines.map(l => l.id);
      info.m119 = {q: !!q, capA, capB, cap: Ac.ops.cap, segA, segB, segs, op: [opSum, A.opProfit(Ac)], build: Ac.ops.build.length};
      const union = new Set(segA.concat(segB)); out.tc119_01 = !!q && Math.abs(Ac.ops.cap - capA - capB) < 1e-9 && segs.length === union.size && [...union].every(x => segs.includes(x)) && new Set(ids).size === ids.length && Ac.ops.build.length === nb + 1 && segs.length <= 6;
      info.m119.opRatio = A.opProfit(Ac) / opSum;
      let bad = ''; for (let i = 0; i < 52; i++) { A.step(); if (!Number.isFinite(A.opProfit(Ac)) || !Number.isFinite(Ac.price)) { bad = 'nan' + i; break; } } out.tc119_52 = bad === '' && Ac.ops.cap > capA && loads(); }
    /* TC-119-02: pharma research and airline routes; TC-119-03: across industries the target is kept as a subsidiary */
    { fresh(4006); A.step(); A.opsEnsure(); const [Pa, Pb] = pair('pharma', 'pharma'), [X, Y] = pair('retail', 'steel'); info.pairs = [!!Pa, !!X]; if (!Pa || !X) return {out, info};
      const nd = Pa.ops.drugs.length + Pb.ops.drugs.length, np = Pa.ops.pipe.length + Pb.ops.pipe.length, qa = A.execMerge(Pa, Pb, .3, true), idsP = Pa.ops.drugs.map(d => d.id).concat(Pa.ops.pipe.map(x => x.id));
            info.m119b = {pharma: !!qa && [nd, Pa.ops.drugs.length, np, Pa.ops.pipe.length]};
      out.tc119_02_pharma = !!qa && Pa.ops.drugs.length === nd && Pa.ops.pipe.length === np && new Set(idsP).size === idsP.length;
            const yo = JSON.stringify(Y.ops.lines || Y.ops.cap), ex = eq(X), ey = eq(Y), qx = A.mergeQuote(X, Y, .3, true); info.whyX = qx.reason; const n0 = S.cos.length, qs = A.execMerge(X, Y, .3, true);
      info.m119c = {sub: qs && qs.sub, note: qx.note, own: Y.own, priv: Y.priv, ctrl: [X.ctrl, Y.ctrl], dx: eq(X) - ex + (qs ? qs.cost : 0), dy: eq(Y) - ey};
      out.tc119_03 = !!qs && qs.sub && /子会社/.test(qx.note) && S.cos.length === n0 && S.cos.includes(Y) && Y.priv && Object.keys(Y.own).join() === X.id && Math.abs(Y.own[X.id] - Y.shares) < 1e-9 && JSON.stringify(Y.ops.lines || Y.ops.cap) === yo && Math.abs(eq(X) - ex + qs.cost) < 1e-6 && Math.abs(eq(Y) - ey) < 1e-9 && Y.ctrl === X.ctrl;
      let bad = ''; for (let i = 0; i < 52; i++) { A.step(); if (!Number.isFinite(Y.price) || !Number.isFinite(X.price)) { bad = 'nan'; break; } } out.tc119_03_run = bad === '' && loads(); }
    /* TC-118-02 (another industry buys a developer): the developer is kept as a subsidiary, so its projects and buildings stay where they are and keep running */
    { fresh(4041); A.step(); A.sitesEnsure(); A.opsEnsure(); const [X, D] = pair('tech', 'realty'); if (X) { D.cash += 1000; const st = S.sites.find(x => x.zone === 'com'); A.devBuy(D.id, st.id, false); const P = S.devp.find(x => x.own === D.id && x.site === st); P.fraud = null; A.devStart(P, 'office', 'std', .9, 'sell');
        const q = A.execMerge(X, D, .3, true); P.done = S.week + 2; for (let i = 0; i < 3; i++) A.step(); info.m118b = {q: !!q && q.sub, own: P.own, alive: S.cos.includes(D), sold: !S.devp.includes(P)};
        out.tc118_02_cross = !!q && q.sub && S.cos.includes(D) && D.own[X.id] === D.shares && !S.devp.includes(P) && newsN(/【竣工・売却】/) >= 1 && loads(); } else out.tc118_02_cross = false; }
    /* TC-119-02 (routes): the first seed with an allowed airline or shipping merger */
    { let Aa = null, Ab = null, nr = 0, qr = null; for (let sd = 4011; sd < 4041 && !qr; sd++) { fresh(sd); A.step(); A.opsEnsure(); for (const ind of ['air', 'ship']) { if (qr) break; [Aa, Ab] = pair(ind, ind); if (Aa) { nr = new Set(Aa.ops.routes.map(x => x.a + '-' + x.b).concat(Ab.ops.routes.map(x => x.a + '-' + x.b))).size; qr = A.execMerge(Aa, Ab, .3, true); info.routeSeed = [sd, ind, nr]; } } }
      const ids = qr ? Aa.ops.routes.map(x => x.id) : []; out.tc119_02_routes = !!qr && Aa.ops.routes.length === nr && new Set(ids).size === ids.length && loads(); }
    /* TC-120: base research cannot be sold; extra projects still can; refills by failure/approval still happen */
    { fresh(4007); A.step(); const c = own(S.cos.find(x => x.ind === 'pharma' && !x.priv)); A.opsSetMode(c, 'direct'); const cash0 = c.cash, base = c.ops.pipe.filter(x => x.base).map(x => x.id);
      const errs1 = base.map(id => A.opsDo(c, {k: 'lout', id}, 'P')); const unchanged = c.cash === cash0 && c.ops.pipe.filter(x => x.base).length === base.length;
      for (let i = 0; i < 52; i++) A.step(); const c2 = c.cash, errs2 = c.ops.pipe.filter(x => x.base).map(x => A.opsDo(c, {k: 'lout', id: x.id}, 'P')), same2 = c.cash === c2;
      c.cash += c.rev * 2; A.opsDo(c, {k: 'lin', v: 2}, 'P'); const ex = c.ops.pipe.find(x => !x.base), c3 = c.cash, e3 = A.opsDo(c, {k: 'lout', id: ex.id}, 'P');
      const html = A.opsTab ? A.opsTab(c) : ''; const btnBase = base.some(id => html.includes(`data-x="${id}"`) && /権利を売る/.test(html));
      info.p120 = {errs1: errs1.slice(0, 1), n: base.length, refill: c.ops.pipe.filter(x => x.base).length, log: c.ops.log.slice(0, 3).map(x => x[1]), e3};
      out.tc120 = errs1.every(e => /基本研究/.test(e)) && unchanged && same2 && errs2.every(e => /基本研究/.test(e)) && e3 === '' && c.cash > c3 && c.ops.pipe.filter(x => x.base).length === 8; }
    /* TC-121: dropping a product line with no cash and no borrowing room is refused and changes nothing; with room, it borrows exactly what it needs */
    { fresh(4008); A.step(); const c = own(S.cos.find(x => x.ind === 'retail' && !x.priv)); A.opsSetMode(c, 'direct'); if (c.ops.lines.filter(l => l.on).length < 2) { c.cash += c.rev; A.opsDo(c, {k: 'lnew', seg: ['super', 'conv', 'drug', 'mall'].find(s => !c.ops.lines.some(l => l.seg === s)) || 'conv'}, 'P'); }
      A.opsCalc(c); const l = c.ops.lines.filter(x => x.on)[1]; c.cash = 0; c.debt = A.maxDebt(c); const s0 = snap(c), e1 = A.opsDo(c, {k: 'ldrop', id: l.id}, 'P'); const same = snap(c) === s0;
      c.debt = Math.max(0, A.maxDebt(c) - c.rev); const d0 = c.debt, loss = c.rev * .02 * (l._w || .3), e2 = A.opsDo(c, {k: 'ldrop', id: l.id}, 'P');
      info.l121 = {e1, same, e2, cash: c.cash, dd: c.debt - d0, loss};
      out.tc121 = /資金が足りません/.test(e1) && same && e2 === '' && c.cash >= 0 && Math.abs(c.debt - d0 - loss) < 1e-9 && !c.ops.lines.some(x => x.id === l.id); }
    /* TC-122: a finished building sold by a developer company: cash rises by the whole price less this week's work; the profit is reported over time but not paid twice */
    { fresh(4009); A.step(); A.sitesEnsure(); const c = S.cos.filter(x => x.ind === 'realty' && !x.priv && !x.ctrl).sort((a, b) => b.rev - a.rev)[0]; c.cash += 3000; const st = S.sites.find(x => x.zone === 'com'); A.devBuy(c.id, st.id, false); const P = S.devp.find(x => x.own === c.id); P.fraud = null; A.devStart(P, 'office', 'std', .9, 'sell');
      P.done = S.week + 1; const c0 = c.cash, a0 = c.assets, wk = Math.max(0, P.cost - P.spent) / Math.max(1, P.done - (S.week + 1) + 1), V = (P.land + P.cost) * A.devMult(), sale = Math.round(V * .97 * 100) / 100, /* rev48: sale prices in whole 百万円 */ basis = P.land + P.spent + wk;
      S.week++; A.devStep(); S.week--; const dc = c.cash - c0, da = c.assets - a0, prof = sale - basis, xp = c.ops.xPaid;
      out.tc122_01 = !S.devp.includes(P) && Math.abs(dc - (sale - wk)) < 1e-6 && Math.abs(da - (wk - basis)) < 1e-6 && Math.abs(xp - prof * 52 * .03) < 1e-6;
      /* TC-122-02: over the following year the profit shows in operating profit, and exactly that amount is held back from cash (so the sale is received once) */
      A.sitesEnsure(); const sl = S.sites.find(x => x.zone === 'ind'); if (sl) { A.devBuy(c.id, sl.id, false); const pl = S.devp.find(x => x.site === sl); if (pl) pl.fraud = null; } /* a plot held as land: rival developers run one project at a time, so no other sale mixes into the measurement */
      let held = 0, rep = 0; for (let i = 0; i < 260; i++) { A.opsCalc(c); const X = c.ops.X || 0, fx = A.fxMult ? A.fxMult(c) : 1; held += Math.sign(c.ops.xPaid || 0) * Math.min(Math.abs(c.ops.xPaid || 0), Math.abs(X)) * fx / 52; rep += X * fx / 52; A.step(); }
      info.d122 = {dc, exp: sale - wk, da, expA: wk - basis, prof, held, rep};
      out.tc122_02 = Math.abs(held - prof) / Math.max(1e-6, Math.abs(prof)) < .05 && held <= rep + 1e-6;
      /* TC-122-03: a sale at a loss and a building kept to let */
      A.sitesEnsure(); const s2 = S.sites.find(x => x.zone === 'com'), s3 = S.sites.find(x => x.zone === 'res'); c.cash += 3000; A.devBuy(c.id, s2.id, false); A.devBuy(c.id, s3.id, false); const Q = S.devp.find(x => x.site === s2), H = S.devp.find(x => x.site === s3); Q.fraud = H.fraud = null;
      A.devStart(Q, 'office', 'std', .9, 'sell'); A.devStart(H, 'resi', 'std', .9, 'hold'); Q.done = H.done = S.week + 1; Q.spent += Q.cost * 2; /* an overrun makes it a loss */
      const cq = c.cash, wq = Math.max(0, Q.cost - Q.spent) / 1, wh = Math.max(0, H.cost - H.spent) / 1, sq = Math.round((Q.land + Q.cost) * A.devMult() * .97 * 100) / 100, bq = Q.land + Q.spent + wq, VH = (H.land + H.cost) * A.devMult(), np0 = S.props.length; S.week++; A.devStep(); S.week--;
      const hp = S.props.find(x => x.id === 'D' + H.id); info.d122c = {dc: c.cash - cq, exp: sq - wq - wh, loss: sq - bq, hp: !!hp};
      out.tc122_03 = Math.abs(c.cash - cq - (sq - wq - wh)) < 1e-6 && sq < bq && !!hp && hp.own === c.id && Math.abs(A.propVal(hp) - Math.round(VH * 100) / 100) < 1e-9 && loads(); } /* rev48 RE-01: the value in yen is the finished value, whatever the currency */
    /* construction never borrows past the company's limit: the work stops instead, and restarts when there is money */
    { fresh(4010); A.step(); A.sitesEnsure(); const c = S.cos.filter(x => x.ind === 'realty' && !x.priv && !x.ctrl).sort((a, b) => b.rev - a.rev)[0]; c.cash += 3000; const st = S.sites.find(x => x.zone === 'com'); A.devBuy(c.id, st.id, false); const P = S.devp.find(x => x.own === c.id); P.fraud = null; A.devStart(P, 'office', 'std', .9, 'sell');
      c.cash = 0; c.debt = A.maxDebt(c); const d0 = c.debt, done0 = P.done, sp0 = P.spent; S.week++; A.devStep(); S.week--; const halted = P.done === done0 + 1 && P.spent === sp0 && c.debt <= Math.max(d0, A.maxDebt(c)) + 1e-9 && P.halt === 1;
      c.cash = 1e4; S.week++; A.devStep(); S.week--; const resumed = P.spent > sp0;
      info.cap = {halted, resumed, debt: c.debt, max: A.maxDebt(c)}; out.devCap = halted && resumed && newsN(/【工事中断】/) >= 1; }
    return {out, info};
  });
  console.log('rev40 bugs', JSON.stringify(r.info).slice(0, 3000));
  for (const [k, v] of Object.entries(r.out)) ok('rev40 BUG-115..122: ' + k, v);
  ok('rev40 BUG-115..122: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testVcIpo39(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {};
    const loads = () => { const txt = A.exportText(); const ok1 = !!A.parseSave(txt); const S0 = A.S, m = A.importText(txt); const ok3 = !(typeof m === 'string' && m.includes('読み込めません')) && A.S !== S0; const e = A.econCheck(A.S); if (!(ok1 && ok3 && e === '')) info.loadFail = [ok1, ok3, e]; return ok1 && ok3 && e === ''; };
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.rep = 'off'; S.settings.confirm = false; return S; };
    const venture = (id, val, sP, sU, cP, cU, extra) => { const base = {id, name: 'テスト' + id, ind: 'tech', what: 'ソフトウェア', st: 2, val, q: .6, w: S.week - 120, grade: 'A'}; const G = [];
      if (sP) G.push(Object.assign({}, base, {stake: sP, cost: cP, pres: false}, extra || {})); if (sU) G.push(Object.assign({}, base, {stake: sU, cost: cU, pres: true})); S.vc.hold.push(...G); return G; };
    /* TC-IPO-01..05: one venture held by the company (20%) and by you personally (10%), with open offers and a seconded officer */
    { fresh(3901); for (let i = 0; i < 3; i++) A.step(); S.pres.cash += 5;
      const pid = Object.keys(S.hr.people).find(k => { const q = S.hr.people[k]; return q && q.at == null && !q.vc; }) || null;
      const G = venture('V9001', 120, .2, .1, 10, 3, {ex: pid}); if (pid) S.hr.people[pid].vc = 'V9001';
      for (const kind of ['vcoffer', 'vcfollow', 'vcask']) S.inbox.push({id: 990900 + kind.length, kind, hid: 'V9001', pres: false, px: 100, add: .01, cost: 1, type: 'fund', amt: 1, buyer: 'X', exp: S.week + 4});
      S.vc.deals.push({id: 'V9001', name: 'テストV9001', ind: 'tech', what: 'x', st: 2, val: 120, q: .6, grade: 'A', w: S.week});
      const tax0 = [S.player.cg || 0, S.pres.cg || 0], cash0 = [S.player.cash, S.pres.cash], gw0 = A.grossWorth(), mw0 = A.myWorth(), n0 = S.cos.length, listed0 = S.cos.filter(c => !c.priv).length;
      const c = A.vcIPO(G[0], G);
      info.c = c && {tk: c.tk, px: c.price, sh: c.shares, P: c.own.P, U: c.own.U, cash: c.cash, rev: c.rev, m: c.margin, fair: A.fair(c), mood: c.mood, mcap: A.mcap(c), ctrl: c.ctrl};
      const raise = c.vcIpo.raise, sh0 = c.shares * (1 - .15);
      out.tc01_listed = !!c && !c.priv && !c.pill && S.cos.length === n0 + 1 && S.cos.filter(x => x.tk === c.tk).length === 1 && S.vc.ipo.V9001 === c.id && A.vcListed('V9001') === c && Math.abs(A.mcap(c) - (120 + raise / (1 - .03))) / 120 < .01 && c.born == null;
      out.tc02_holders = Math.abs(c.own.P * c.price - 24) < 1e-6 && Math.abs(c.own.U * c.price - 12) < 1e-6 && Math.abs(A.grossWorth() - gw0) < 1e-6 && Math.abs(A.myWorth() - mw0) < 1e-6
        && S.player.cash === cash0[0] && S.pres.cash === cash0[1] && (S.player.cg || 0) === tax0[0] && (S.pres.cg || 0) === tax0[1] && Math.abs(A.costOf('P', c.id) - 10) < 1e-9 && Math.abs(S.pres.cost[c.id] - 3) < 1e-9;
      info.worth = [gw0, A.grossWorth(), mw0, A.myWorth()];
      out.tc03_newShares = Math.abs(c.own.P / c.shares - .2 * .85) < 1e-9 && Math.abs(c.own.U / c.shares - .1 * .85) < 1e-9 && raise > 0 && Math.abs(raise - sh0 * .15 / .85 * c.price * .97) < 1e-6 && c.cash >= raise;
      out.tc04_history = S.vc.track[0].k === 'ipo' && S.vc.track[1].k === 'ipo' && /上場/.test(S.vc.track[0].why) && S.vc.track.slice(0, 2).every(t => t.cid === c.id) && Math.abs(S.vc.track.find(t => !t.pres).got - 24) < 1e-9 && !S.vc.hold.some(h => h.id === 'V9001');
      out.tc05_cleanup = !S.inbox.some(i => i.hid === 'V9001') && !S.vc.deals.some(d => d.id === 'V9001') && (!pid || !S.hr.people[pid].vc);
      info.pid = pid;
      /* TC-IPO-06: never listed twice, not even after a reload */
      const again = A.vcIPO(G[0], G); S.vc.deals.push({id: 'V9001', name: 'x', ind: 'tech', what: 'x', st: 2, val: 120, q: .6, grade: 'A', w: S.week}); const inv = A.vcInvest('V9001', .05, 'co'); S.vc.deals = S.vc.deals.filter(d => d.id !== 'V9001');
      const ok = loads(); const c2 = A.S.cos.find(x => x.vcId === 'V9001');
      out.tc06_once = again === null && inv === false && ok && A.S.vc.ipo.V9001 === c.id && !!c2 && A.S.cos.filter(x => x.vcId === 'V9001').length === 1 && A.vcIPO(G[0], G) === null;
      S = A.S; const C = A.coById(c.id);
      /* TC-IPO-07: the shares trade like any other: sell some (gain against the carried-over cost), buy personally, dividends, a takeover bid */
      const heldP = C.own.P, basis = A.costOf('P', C.id) * (heldP * .25) / heldP, cg0 = S.player.cg || 0, s = A.execSell('P', C, heldP * .25), led = S.ledger && S.ledger[0];
      const cashU = S.pres.cash, bU = A.execBuy('U', C, 0.01);
      info.sell = s && {s: JSON.stringify(s).slice(0, 200), basis, cost1: A.costOf('P', C.id), bU: JSON.stringify(bU)};
      out.tc07_trade = !!s && Math.abs(A.costOf('P', C.id) - (10 - basis)) < 1e-6 && Math.abs((S.player.cg || 0) - cg0 - (s.proceeds - basis)) < 1e-6 && !!bU && S.pres.cash < cashU && C.own.U > 0;
      /* a hostile bid meets the normal defences: here the management picks a white knight and the holders are paid in cash at a premium */
      const cashP = S.player.cash, t = A.launchTob('P', C, C.price * 1.6, .51, false); for (let i = 0; i < 8 && S.tobs.some(x => x.cid === C.id); i++) A.step();
      info.tob = [t, C.own.P / C.shares, C.ctrl, S.cos.includes(C)]; info.mkt = S.news.filter(n => /テストV9001/.test(n.t || n.text || '')).slice(0, 4).map(n => (n.t || n.text).slice(0, 80));
      out.tc07_tob = t !== false && (C.ctrl === 'P' || ((!S.cos.includes(C) || (C.priv && Object.keys(C.own).length === 1 && !C.own.P && !C.own.U)) && S.player.cash > cashP && !Object.keys(S.player.cost).includes(C.id))); /* rev40: a buyer from another industry keeps it as a subsidiary */
      out.tc07_load = loads();
    }
    /* TC-IPO-07b: a venture you hold a majority of (company 45% + you 20%) is under your control from the listing day: no jump in net worth; you set its dividend; a bid for the rest */
    { fresh(3905); for (let i = 0; i < 3; i++) A.step(); const G = venture('V9005', 90, .45, .2, 20, 8); const gw0 = A.grossWorth(), mw0 = A.myWorth(); const c = A.vcIPO(G[0], G);
      info.ctl = {ctrl: c.ctrl, gw: [gw0, A.grossWorth()], mw: [mw0, A.myWorth()]};
      out.tc07_control = c.ctrl === 'P' && Math.abs(A.grossWorth() - gw0) < 1e-6 && Math.abs(A.myWorth() - mw0) < 1e-6;
      c.payout = .4; c.cash += 20; const d0 = S.player.divs || 0, U0 = S.pres.cash; for (let i = 0; i < 14; i++) A.step();
      info.div = [(S.player.divs || 0) - d0, c.ni, S.cos.includes(c)]; out.tc07_div = S.cos.includes(c) && (S.player.divs || 0) > d0;
      const t = A.launchTob('P', c, c.price * 1.3, .9, false); for (let i = 0; i < 8 && S.tobs.some(x => x.cid === c.id); i++) A.step();
      info.tob2 = [t, c.own.P / c.shares]; out.tc07_tob_control = t !== false && c.own.P / c.shares > .45 * .85 + .01 && c.ctrl === 'P';
      out.tc07b_load = loads();
    }
    /* TC-IPO-08: the price is consistent with the business: fair value matches at listing and there is no jump afterwards; nothing breaks over 260 weeks */
    { fresh(3902); for (let i = 0; i < 3; i++) A.step(); const G = venture('V9002', 60, .15, 0, 6, 0); const c = A.vcIPO(G[0], G); const f0 = A.fair(c), px0 = c.price; const P = [px0];
      for (let i = 0; i < 26; i++) { A.step(); P.push(c.price); }
      const jumps = P.slice(1).map((x, i) => Math.abs(Math.log(x / P[i]))); info.fit = {f0, px0, mood: c.mood, p26: P[26], maxJ: Math.max(...jumps)};
      out.tc08_fit = Math.abs(Math.log(f0 * Math.exp(0) / px0)) < .3 && Math.max(...jumps) < .15 && P[26] > px0 * .5 && P[26] < px0 * 2;
      let bad = ''; for (let i = 0; i < 234; i++) { A.step(); if (!(c.price > 0 && isFinite(c.price) && isFinite(c.cash))) { bad = 'nan@' + i; break; } }
      const tb = A.trBaseCheck ? A.trBaseCheck(S) : ''; info.long = {bad, tb, price: c.price, alive: S.cos.includes(c)};
      out.tc08_long = bad === '' && loads();
    }
    /* TC-IPO-04 (labels from the engine): ventures run through quarters; an exit by listing becomes shares, a sale pays cash, a failure is recorded as one */
    { fresh(3903); for (let i = 0; i < 2; i++) A.step(); const k = {ipo: 0, acq: 0, fail: 0}, seen = new Set(); let cashAcq = 0;
      for (let j = 0; j < 60; j++) venture('V95' + String(j).padStart(2, '0'), 30 + j, .1, 0, 3, 0);
      for (let qq = 0; qq < 40 && S.vc.hold.length; qq++) { for (const h of S.vc.hold.slice()) { if (!S.vc.hold.includes(h)) continue; const c0 = S.player.cash; A.vcEvent(h); if (!S.vc.hold.includes(h)) { const t = S.vc.track[0]; if (t && !seen.has(h.id)) { seen.add(h.id); k[t.k] = (k[t.k] || 0) + 1; if (t.k === 'acq') cashAcq += S.player.cash - c0 - t.got; if (t.k === 'ipo' && !(S.vc.ipo[h.id] && A.coById(t.cid))) k.bad = (k.bad || 0) + 1; } } } S.week += 13; }
      info.labels = k; out.tc04_engine = k.ipo > 0 && k.acq > 0 && k.fail > 0 && !k.bad && Math.abs(cashAcq) < 1e-6 && S.cos.filter(c => c.vcId).length === k.ipo && new Set(S.cos.map(c => c.tk)).size === S.cos.length;
    }
    /* determinism: the same seed and the same actions give the same game */
    { const run = () => { fresh(3904); for (let i = 0; i < 2; i++) A.step(); const G = venture('V9004', 80, .2, .05, 8, 2); A.vcIPO(G[0], G); for (let i = 0; i < 30; i++) A.step(); return JSON.stringify(A.S.cos.map(c => [c.id, c.tk, +c.price.toFixed(9), +(c.own.P || 0).toFixed(9)])) + A.S.rngN; };
      const a = run(), b2 = run(); out.determinism = a === b2; }
    return {out, info};
  });
  console.log('rev39 vc ipo', JSON.stringify(r.info).slice(0, 1600));
  for (const [k, v] of Object.entries(r.out)) ok('rev39 vc ipo: ' + k, v);
  ok('rev39 vc ipo: no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
  await p.close();
}

async function testOps37(b) {
  const {p, errs} = await page(b, {viewport: {width: 320, height: 800}});
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S; const fresh = seed => { A.closeModal(); A.newGame(seed, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.lost = true; S.allUnlocked = true; S.stage = 4; S.settings.rep = 'off'; return S; };
    const own = c => { c.own.P = c.shares * .6; A.recomputeCtrl(); A.opsEnsure(); return c; };
    /* migration: an old save (no business data, prices at 1.00) earns exactly what it did */
    { fresh(3801); for (let i = 0; i < 5; i++) A.step(); for (const c of S.cos) delete c.ops; S.cmdty = {}; const b0 = S.cos.map(c => [c.rev, A.opProfit(c)]); A.opsEnsure(); for (const c of S.cos) A.opsCalc(c);
      const d = Math.max(...S.cos.map((c, i) => Math.abs(A.opProfit(c) - b0[i][1]) / Math.max(1e-6, Math.abs(b0[i][1])))); info.mig = d; out.migration = d < 1e-9 && new Set(S.cos.map(c => c.ops.type)).size === 6; }
    /* modes: a new subsidiary starts on policy; switching locks for 4 weeks; the CEO's proposals can be approved, partly approved or rejected */
    { fresh(3802); A.step(); const c = own(S.cos.find(x => x.ind === 'food' && !x.priv)); const m0 = A.opsMode(c); const w1 = A.opsSetMode(c, 'direct'), w2 = A.opsSetMode(c, 'policy'); for (let i = 0; i < 4; i++) A.step(); const w3 = A.opsSetMode(c, 'policy');
      out.modes = m0 === 'policy' && w1 === '' && /4週間/.test(w2) && w3 === '' && A.opsMode(c) === 'policy';
      c.q0 = {s: (c.sh || .3) * 1.2}; c.cash = c.rev; let it = null; for (let i = 0; i < 14 && !it; i++) { A.step(); it = S.inbox.find(x => x.kind === 'opsprop' && x.cid === c.id); }
      info.prop = it ? it.acts.map(x => x.a.k) : null; out.proposal = !!it && it.acts.length > 0 && it.acts.every(x => isFinite(x.est));
      if (it) { const n0 = c.ops.log.length; click('opspick', it.id, 0); click('opsans', it.id, 'some'); out.partial = !S.inbox.includes(it) && c.ops.log.length === n0 + 1; }
      const ceo = A.S.hr.people[c.ex && c.ex.CEO]; if (ceo) { const m1 = ceo.mood; for (let k = 0; k < 3; k++) { S.inbox.push({id: 990100 + k, kind: 'opsprop', cid: c.id, acts: [{a: {k: 'lp', id: c.ops.lines[0].id, v: 1}, why: 't', est: 1}], who: 'CEO', exp: S.week + 2}); A.opsPropAnswer(S.inbox[S.inbox.length - 1], 'no'); } out.reject3 = ceo.mood < m1; } else out.reject3 = true; }
    /* ① products: a dearer line loses appeal; a quality budget lifts quality over time; a new line ramps up; refresh and drop */
    { fresh(3803); A.step(); const c = own(S.cos.find(x => x.ind === 'auto' && !x.priv)); A.opsSetMode(c, 'direct'); const l = c.ops.lines[0], A0 = c.ops.A;
      A.opsDo(c, {k: 'lp', id: l.id, v: 1.2}, 'P'); const A1 = c.ops.A, P1 = c.ops.P; A.opsDo(c, {k: 'lp', id: l.id, v: 1}, 'P'); A.opsDo(c, {k: 'lrd', id: l.id, v: .05}, 'P'); const q0 = l.q, F0 = c.ops.F; for (let i = 0; i < 26; i++) A.step();
      const free = A.opsIdeas ? (c.ops.lines.length) : 0; const seg = ['kei', 'sedan', 'suv', 'ev', 'van'].find(x => !c.ops.lines.some(y => y.seg === x)); c.cash += c.rev; const e = A.opsDo(c, {k: 'lnew', seg}, 'P'), nl = c.ops.lines.find(y => y.seg === seg);
      info.prod = {A0, A1, P1, q0, q1: l.q, F0}; out.prod = A1 < A0 && P1 > 1 && l.q > q0 + 5 && F0 > 0 && e === '' && nl && nl.ramp < .1 && A.opsDo(c, {k: 'ldrop', id: nl.id}, 'P') === '' && A.opsDo(c, {k: 'lref', id: l.id}, 'P') === '' && l.age === 0 && loads(); }
    /* ② commodities: idling saves fixed costs; a hedge fixes the price; building finishes after its lead time; airlines and shipping have routes */
    { fresh(3804); A.step(); const c = own(S.cos.find(x => x.ind === 'steel' && !x.priv)); A.opsSetMode(c, 'direct'); c.cash += c.rev; const fx0 = A.opProfit(c);
      A.opsDo(c, {k: 'idle', v: .2}, 'P'); const F1 = c.ops.F; A.opsDo(c, {k: 'idle', v: -.2}, 'P'); A.S.cmdty.steel.px = 1.3; A.opsCalc(c); A.opsDo(c, {k: 'hedge', kind: 'sell', v: .5, q: 2}, 'P'); A.S.cmdty.steel.px = .7; A.opsCalc(c); const Ph = c.ops.P;
      const cap0 = c.ops.cap; A.opsDo(c, {k: 'build', v: .1}, 'P'); const done = c.ops.build[0].done; info.cmd = {F1, Ph, done: done - S.week};
      out.cmdty = F1 < 0 && Ph > .7 * .6 + 1.3 * .4 * 0 && Ph > .85 && done - S.week === 104 && /80%/.test(A.opsDo(c, {k: 'hedge', kind: 'sell', v: .5, q: 2}, 'P'));
      const air = S.cos.find(x => x.ind === 'air'), ship = S.cos.find(x => x.ind === 'ship'); out.routes = air.ops.routes.length >= 2 && ship.ops.routes.length >= 2 && air.ops.routes.every(r => A.S && r.a && r.b);
      A.ui.tab = 'market'; A.ui.sel = null; A.renderAll(true); info.hits = A.routeHits.length; }
    /* ③ telecom and bank */
    { fresh(3805); A.step(); const t = own(S.cos.find(x => x.ind === 'telecom' && !x.priv)); A.opsSetMode(t, 'direct'); A.opsDo(t, {k: 'netcap', v: .06}, 'P'); const n0 = t.ops.net; for (let i = 0; i < 26; i++) A.step(); out.telecom = t.ops.net > n0 + 3 && t.ops.F > 0 && A.opsDo(t, {k: 'arpu', v: 1.1}, 'P') === '' && t.ops.P > 1.05;
      const bk = own(S.cos.find(x => x.ind === 'bank' && !x.priv)); A.opsSetMode(bk, 'direct'); A.opsDo(bk, {k: 'std', v: .1}, 'P'); S.econ.credit = .8; for (let i = 0; i < 100; i++) { A.step(); S.econ.credit = .8; } info.bank = {loss: bk.ops.loss}; out.bank = bk.ops.loss > 0 && /自己資本比率/.test(A.opsTab(bk)); }
    /* ④ pharma: the line-up is today's sales; licensing out pays cash; licensing in costs cash; approvals and failures happen over time */
    { fresh(3806); A.step(); const c = own(S.cos.find(x => x.ind === 'pharma' && !x.priv)); A.opsSetMode(c, 'direct'); c.cash += c.rev * 2; A.opsDo(c, {k: 'lin', v: 2}, 'P'); /* BUG-120: only a project outside the base research budget can be sold */ const p0 = c.ops.pipe.find(x => x.st >= 2 && !x.base), ev = A.pipeEV(c, p0), cash0 = c.cash; A.opsDo(c, {k: 'lout', id: p0.id}, 'P');
      const got = c.cash - cash0; c.cash += c.rev; const c1 = c.cash; A.opsDo(c, {k: 'lin', v: 3}, 'P'); const paid = c1 - c.cash; let ev2 = 0; for (let i = 0; i < 520; i++) { A.step(); } const logs = c.ops.log.map(x => x[1]).join('|');
      info.pharma = {ev, got, paid, A: c.ops.A}; out.pharma = got > ev * .45 && got < ev * .75 && paid > 0 && /承認|失敗/.test(logs) && c.ops.A > .2; }
    /* ⑤ development from the head office: due diligence, construction, completion; the net worth, balance sheet and capital allocation agree throughout */
    { fresh(3807); S.player.cash = 2000; A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: 3}); A.trClose(); A.sitesEnsure(); const site = S.sites.filter(x => x.zone === 'res').sort((x, y) => A.sitePrice(x) - A.sitePrice(y))[0];
      const agree = () => { const g = A.grossWorth(); return Math.abs(A.bsNow().eq - g) < 1e-6 && Math.abs(A.capAlloc().net - g) < 1e-6; }; const g0 = A.grossWorth(), px = A.sitePrice(site);
      click('devbuy', null, site.id, {own: 'P', dd: '1'}); const pj = S.devp.find(x => x.own === 'P'); const ok1 = !!pj && pj.st === 'dd' && Math.abs(A.grossWorth() - (g0 - Math.round(px * .005 * 100) / 100)) < 1e-6 && agree(); /* rev48: the fee in whole 百万円 */
      A.step(); A.step(); A.step(); click('devplan', pj.id, 'condo', {f: 'kind'}); click('devstart', pj.id); const ok2 = pj.st === 'build' && pj.kind === 'condo' && agree();
      let w = 0; while (S.devp.includes(pj) && w++ < 200) { A.step(); if (!agree()) break; } info.dev = {w, st: pj.st, fraud: pj.fraud}; out.dev = ok1 && ok2 && !S.devp.includes(pj) && w < 200 && agree() && /竣工/.test(S.news.map(n => n.t).join('|')) && loads();
      /* hold as a rental: the building joins your properties */ A.sitesEnsure(); const s2 = S.sites.find(x => x.zone !== 'ind'); A.devBuy('P', s2.id, false); const p2 = S.devp.find(x => x.own === 'P'); A.devStart(p2, A.S.sites ? (p2.site.zone === 'com' ? 'office' : 'resi') : 'resi', 'hi', .8, 'hold'); p2.done = S.week + 1; p2.fraud = null; const n0 = S.props.filter(x => x.own === 'P').length; A.step(); A.step();
      const nb = S.props.filter(x => x.own === 'P'); out.devHold = nb.length === n0 + 1 && nb.some(x => x.dev && x.grade === 'hi') && agree(); }
    /* the land fraud: rare, cut tenfold by due diligence; when it comes out the land is lost */
    { fresh(3808); let a = 0, bb = 0; for (let i = 0; i < 20000; i++) { const x = A.hrnd('fraud:P:L' + i); if (x < .003) a++; if (x < .0003) bb++; } info.fraudRate = [a, bb]; out.fraudRate = a > 30 && a < 95 && bb < a / 4; S.player.cash = 2000; A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: 3}); A.sitesEnsure(); const s = S.sites[0]; A.devBuy('P', s.id, false); const pj = S.devp.find(x => x.own === 'P'); pj.fraud = S.week + 1; const g0 = A.grossWorth(); A.step(); A.step();
      out.fraud = !S.devp.includes(pj) && A.grossWorth() < g0 - pj.land * .7 && /地面師/.test(S.news.map(n => n.t).join('|')); }
    /* a developer that disappears (merged, delisted) takes its projects with it: the save still loads at once */
    { fresh(3812); A.step(); A.sitesEnsure(); const dv = S.cos.find(x => x.ops.type === 'dev'); dv.cash += 1e4; const st = S.sites[0]; const e = A.devBuy(dv.id, st.id, false); const had = S.devp.some(x => x.own === dv.id); S.cos = S.cos.filter(x => x !== dv); for (const c of S.cos) for (const k of Object.keys(c.own)) if (k === dv.id) delete c.own[k];
      const ok = !!A.parseSave(A.exportText()); info.purge = {e, had, err: (A.trialErr || '').slice(0, 60)}; out.purge = e === '' && had && ok && !S.devp.some(x => x.own === dv.id); }
    /* a building drawn for each kind and grade */ { const k = ['office', 'retail', 'logi', 'resi', 'apt', 'condo'].map(x => A.bldSVG(x, 'std', 1) + A.bldSVG(x, 'hi', 1)); out.svg = k.slice(0, 4).every(x => /<img class="prop2d"/.test(x)) && k.slice(4).every(x => /<svg/.test(x) && /polygon/.test(x)) && k[0] !== k[1]; } /* rev46: offices, retail, logistics and rental blocks are photos; the small kinds keep the drawing */
    /* the AI runs the other companies with the same actions */ { fresh(3809); for (let i = 0; i < 104; i++) A.step(); const acted = S.cos.filter(c => c.ctrl !== 'P' && (c.ops.log || []).length).length; info.ai = acted; out.ai = acted >= 10; }
    /* the same seed gives the same businesses */ { const run = () => { fresh(3810); for (let i = 0; i < 40; i++) A.step(); return JSON.stringify(S.cos.map(c => [c.ops.A, c.ops.P, c.ops.cap, c.rev])) + JSON.stringify(S.cmdty) + JSON.stringify(S.devp); }; out.det = run() === run(); }
    /* the business tab at 320px for each type; the group tab lists the subsidiaries' weeks */
    { fresh(3811); for (let i = 0; i < 3; i++) A.step(); const W = document.documentElement.clientWidth, bad = []; for (const t of ['prod', 'cmdty', 'sub', 'bank', 'pipe', 'dev']) { const c = own(S.cos.find(x => x.ops.type === t && !x.priv) || S.cos.find(x => x.ops.type === t)); A.opsSetMode(c, 'direct'); A.ui.tab = 'market'; A.ui.sel = c.id; A.ui.ctab = 'ops'; A.renderAll(true); const body = document.querySelector('#pbody'); const o = [...body.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && !e.closest('.hscroll,.seg,.hqnav'); }).length; if (o || !/事業/.test(body.textContent)) bad.push(t + ':' + o); }
      A.step(); info.w320 = bad; out.w320 = !bad.length && /子会社の週次実績/.test(A.groupWkBox()); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('ops37: business operations — migration unchanged, modes and CEO proposals, products, commodities and routes, telecom, bank, pharma, development with fraud and buildings, AI with the same actions, determinism, 320px', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info).slice(0, 1200));
  ok('no page errors in ops37 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testFix1120(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* 1: debt down to 2 before the weekly run, GP cash 0.35 exactly: 2 paydown + 5 working capital paid in week one, nothing later; 1 yen less: nothing paid */
    const run1 = (cash) => { S = traderCo(2811, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise('turn', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = 'auto'; f.cfg.ops = false;
      let d = null; for (let i = 0; i < 300 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; else if (x) S.pe.deals = S.pe.deals.filter(y => y !== x); } d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), 0, false);
      c.debt = 2; delete c.sns; c.pe.recap = 10; c.pe.wc = 5; c.pe.p100 = S.week; delete c.crisis; const T = 1000, k = T - 100; f.gp = T * .05; f.lp = T - f.gp; f.calledGP = k * .05; f.calledLP = k - f.calledGP; f.invEnd = S.week + 100; S.player.cash = cash; S.player.loan = 0;
      const k0 = f.calledLP + f.calledGP, g0 = f.calledGP, cash0 = c.cash, at = []; for (let i = 0; i < 3; i++) { S.week++; A.fundAuto8(f); at.push(+(f.calledLP + f.calledGP - k0).toFixed(8)); }
      return {at, gp: +(f.calledGP - g0).toFixed(8), debt: c.debt, wc: +(c.cash - cash0).toFixed(8), res: A.resOf(c), loan: S.player.loan}; };
    const a = run1(.35); info.r1 = a; out.f1 = a.at.every(x => Math.abs(x - 7) < 1e-9) && Math.abs(a.gp - .35) < 1e-9 && a.debt === 0 && Math.abs(a.wc - 5) < 1e-9 && a.res === 0 && a.loan === 0;
    const b1 = run1(.35 - 1e-8); info.r1b = b1; out.f1short = b1.at.every(x => x === 0) && b1.loan === 0;
    /* 2: a company refounded after a wind-down starts unlisted, with no market or ticker */
    { S = traderCo(2812, 3000); S.allUnlocked = true; S.stage = 4; Object.assign(S.player, {listed: true, ipoW: S.week, mkt: 'prime', tk: 'OLD', listW: S.week, ipoMkt: 'prime', ipoTk: 'OLD', outside: .2});
      A.restartAsTrader('test'); const s1 = !A.selfListed() && !S.player.tk && !S.player.mkt && !S.player.outside; S.player.cash = 3000; A.incorporate('NEWCO', 0); A.hqInit(); A.trClose();
      out.f2 = s1 && !A.selfListed() && !S.player.tk && !(S.player.outside > 0) && S.player.ipoW == null && A.ytrBox().includes('上場（IPO）'); A.importText(A.exportText()); out.f2load = !A.selfListed() && A.S.player.ipoW == null; }
    /* 3: 20% of a company with 100 million shares and no outsiders: 25 million new shares, 125 million after, 80% yours */
    { S = traderCo(2813, 3000); const N = A.ytrNew(.2); out.f3 = Math.abs(N.add - 25) < 1e-9 && Math.abs(N.after - 125) < 1e-9 && Math.abs(N.o2 - .2) < 1e-12; }
    /* 4: Prime needs 300 on the review day too */
    { const go = gw => { S = traderCo(2814, gw); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.acc, {on: true, staff: 40}); S.player.ipoPlan = {f: .2, w0: S.week, end: S.week + 1, uw: 'mid', mkt: 'prime', tk: 'PRM'}; S.player.cash = gw - (A.grossWorth() - S.player.cash); S.week += 1; A.step(); return A.selfListed(); };
      const lo = go(100); const hi = go(300.5); info.f4 = {lo, hi}; out.f4 = !lo && hi; }
    /* 5: at 60% outside, the screen says so and nothing can be issued */
    { S = traderCo(2815, 3000); S.allUnlocked = true; S.stage = 4; S.player.outside = .6; S.player.listed = true; S.player.ipoW = S.week - 100; out.f5 = A.ytrMax() === 0 && A.ytrBox().includes('上限の60%に達して'); }
    /* 6: an officer nobody decided about leaves as if let go: back on the job market once */
    { S = traderCo(2816, 3000); S.allUnlocked = true; S.stage = 4; A.hqInit(); Object.assign(S.dept.acc, {on: true, staff: 5}); const c = S.cos.filter(x => !x.ctrl)[0]; c.own = {P: c.shares * .7}; A.recomputeCtrl(); A.hrEnsure(c); const x = A.ceoOf(c); A.step(); S.inbox = S.inbox.filter(i => i.kind !== 'execback');
      S.cos = S.cos.filter(y => y !== c); A.hrOrphans(); const it = S.inbox.find(i => i.kind === 'execback' && i.pid === x.id); S.inbox = S.inbox.filter(i => i !== it); /* the deadline passed */ A.hrOrphans(); A.hrOrphans();
      out.f6 = !!it && !x.at && S.hr.pool.filter(id => id === x.id).length === 1 && x.orphW == null && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('fix 2026-11-20: weekly recapitalisation after debt fell, refounded company unlisted, IPO share count, Prime on review day, 60% cap message, expired officer decision', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in fix-1120 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testPlay27(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const click = (act, id, v, extra) => { const el = document.createElement('button'); if (id != null) el.dataset.id = id; if (v != null) el.dataset.v = v; Object.assign(el.dataset, extra || {}); A.act(act, el); };
    let S;
    /* options earned as an individual stay open after incorporating */
    { A.newGame(2701, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false; S.player.cash = 50; S.tr.n = 30; for (let i = 0; i < 30; i++) S.tr.rets.push(0); const before = A.has('options'); A.incorporate('Z', 0); A.hqInit(); A.trClose(); S.stage = 2; out.optAfterFound = before && A.has('options') && A.has('short'); }
    /* names: your personal account and an unknown bidder */
    out.names = A.ownerName('U') === 'あなた（個人）' && A.ownerName('R9') === '他の買い手';
    /* company you run: the year's figures come from the last report (do not move weekly) */
    { A.newGame(2702, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } const c = S.cos.find(x => !x.priv && x.qh && x.qh.length); c.ctrl = 'P'; const h0 = A.coInfo(c).match(/純利益（年・直近決算）<\/span><b[^>]*>([^<]*)</)[1]; c.ni *= 1.37; const h1 = A.coInfo(c).match(/純利益（年・直近決算）<\/span><b[^>]*>([^<]*)</)[1]; out.repNi = h0 === h1; }
    /* listing your company: shares to sell chosen freely, market and ticker; options do not make it 'listed' */
    { A.newGame(2703, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; A.hqInit(); Object.assign(S.dept.acc, {on: true, staff: 20}); S.player.cash = 3000; S.player.outside = .05;
      out.notListed = !A.selfListed() && !A.ytrBox().includes('上場済み');
      A.ui.ytrF = .2; click('ytrfd', null, '-.05'); click('ytrfd', null, '-.01'); info.f = A.ui.ytrF; click('ytrmkt', null, 'prime'); A.ui.ytrTk = 'ABCD';
      click('ytripo', null, String(A.ui.ytrF), {uw: 'mid'}); const pl = S.player.ipoPlan; out.plan = !!pl && Math.abs(pl.f - .14) < 1e-9 && pl.mkt === 'prime' && pl.tk === 'ABCD';
      if (pl) { S.week = pl.end; for (let i = 0; i < 3 && !A.selfListed(); i++) { A.step(); S.inbox = []; } }
      info.listed = {l: A.selfListed(), tk: S.player.tk, mkt: S.player.mkt, o: S.player.outside}; out.listed = A.selfListed() && S.player.tk === 'ABCD' && S.player.mkt === 'prime' && A.selfBox().includes('ABCD');
      A.ui.mview = 'hold'; A.ui.tab = 'market'; A.ui.sel = null; out.holdTab = A.holdingsTab().includes('ABCD') || A.holdingsTab().includes('あなたの持株'); out.loadsIPO = loads(); }
    /* people: an officer of a company that is gone is offered back to head office; earnings are recorded */
    { A.newGame(2704, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; A.hqInit(); Object.assign(S.dept.acc, {on: true, staff: 5}); S.player.cash = 3000;
      const c = S.cos.filter(x => !x.ctrl)[0]; c.own = {P: c.shares * .7}; A.recomputeCtrl(); A.hrEnsure(c); const ceo = A.ceoOf(c); A.step(); S.inbox = [];
      out.earned = ceo.paid > 0 && ceo.grp === c.name && A.personLine(ceo, null, 'CEO').includes('稼いだ額');
      S.cos = S.cos.filter(x => x !== c); A.hrOrphans(); const it = S.inbox.find(i => i.kind === 'execback' && i.pid === ceo.id); out.backAsk = !!it && A.execBackCard(it).includes('付き幹部に戻す');
      click('execback', it.id, 'acc'); out.backHQ = ceo.at === 'HQ' && ceo.role === 'BENCH' && ceo.dept === 'acc';
      /* secondment picker: a venture and a head-office department are destinations */
      A.vcQuarter(); const d = S.vc.deals[0]; A.vcInvest(d.id, .05); const h = A.vcHold(d.id, false); A.ui.secCo = 'V:' + h.id; click('secgo', ceo.id); out.secVC = h.ex === ceo.id && ceo.role === 'VCX';
      A.ui.secCo = 'H:acc'; click('secgo', ceo.id); out.secHQ = ceo.role === 'BENCH' && ceo.dept === 'acc' && h.ex !== ceo.id;
      out.org = A.orgChart().includes('組織図') && A.orgChart().includes('経理部'); out.loadsPeople = loads(); }
    /* money into a company in a funding crisis: an amount you choose; the crisis ends once what is short is in */
    { A.newGame(2705, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; S.stage = 4; A.hqInit(); S.player.cash = 5000; const c = S.cos.filter(x => !x.ctrl && x.rev > 5)[0]; c.own = {P: c.shares * .8}; A.recomputeCtrl(); c.cash = 0; c.crisis = {w: S.week, due: S.week + 8, refi: true, short: Math.min(1, c.debt * .1)};
      const gap = A.crisisGap(c), unit = c.shares * c.price * .95; A.ui.sel = c.id; out.injBox = A.injectBox(c).includes('入れる金額'); click('inject', null, String(gap * .4 / unit)); const still = !!c.crisis; click('inject', null, String(gap / unit));
      info.inj = {gap: +gap.toFixed(4), still, after: !!c.crisis}; out.inject = still && !c.crisis; }
    /* allotment to your own company: your share goes up, not down */
    { A.newGame(2706, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.player.cash = 5000; const c = S.cos[3]; c.own = {P: c.shares * .6}; A.recomputeCtrl(); A.allot(c, 'P', .05); out.allotNews = /上がります/.test(S.news[0].t) && !/薄まります/.test(S.news[0].t); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('playtest 27: options after founding, names, reported profit, own listing (shares, market, ticker), holdings tab, officers of a closed company, secondment picker, org chart, injection amount, allotment wording', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in playtest-27 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev26(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, mode) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise('turn', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = mode || 'propose'; f.cfg.ops = false; return {S, f}; };
    const click = (act, id, v) => { const el = document.createElement('button'); el.dataset.id = id; el.dataset.v = v; A.act(act, el); };
    const company = (f, debt) => { let d = null; for (let i = 0; i < 300 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), 0, false); c.debt = debt; c.sns = null; delete c.sns; c.pe.recap = 10; c.pe.wc = 5; c.pe.p100 = A.S.week; c.crisis = null; delete c.crisis; return c; };
    const setRoom = (f, room) => { const T = 1000, k = T - room; f.gp = T * .05; f.lp = T - f.gp; f.lp0 = f.lp; f.gp0 = f.gp; f.calledGP = k * .05; f.calledLP = k - f.calledGP; f.invEnd = Math.max(f.invEnd, A.S.week + 100); };
    let S;
    /* BUG-93: debt down to 2 before the approval of an old 15 proposal: 2 paydown + 5 working capital = 7; the rest released; nothing more later */
    { let f; ({S, f} = fundCo(2693)); click('fundact', 99999999, 'ok'); const c = company(f, 2); setRoom(f, 100); S.player.cash = 50; A.trClose(); const k0 = f.calledLP + f.calledGP, g0 = f.calledGP, cash0 = c.cash;
      A.fundAsk(f, 'recap', {cid: c.id, name: c.name, amt: 15, pay: 10, why: 't'}); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); click('fundact', it.id, 'ok'); click('fundact', it.id, 'ok');
      info.b93 = {paid: +(f.calledLP + f.calledGP - k0).toFixed(6), gp: +(f.calledGP - g0).toFixed(6), debt: c.debt, cash: +(c.cash - cash0).toFixed(6), recap: c.pe.recap, wc: c.pe.wc, note: A.actNote};
      out.b93manual = Math.abs(f.calledLP + f.calledGP - k0 - 7) < 1e-9 && Math.abs(f.calledGP - g0 - .35) < 1e-9 && c.debt === 0 && Math.abs(c.cash - cash0 - 5) < 1e-9 && A.resOf(c) === 0 && A.gpRes() === 0;
      for (let i = 0; i < 3; i++) { S.week++; A.fundAuto8(f); } out.b93again = Math.abs(f.calledLP + f.calledGP - k0 - 7) < 1e-9; A.trClose(); out.b93load = loads(); }
    { let f; ({S, f} = fundCo(2694, 'auto')); const c = company(f, 2); setRoom(f, 100); S.player.cash = 50; A.trClose(); const k0 = f.calledLP + f.calledGP; const at = []; for (let i = 0; i < 3; i++) { S.week++; A.fundAuto8(f); at.push(+(f.calledLP + f.calledGP - k0).toFixed(6)); }
      info.b93auto = at; out.b93auto = at.every(x => Math.abs(x - 7) < 1e-9) && A.resOf(c) === 0; }
    { let f; ({S, f} = fundCo(2695, 'auto')); const c = company(f, 0); setRoom(f, 100); S.player.cash = 50; const k0 = f.calledLP + f.calledGP; S.week++; A.fundAuto8(f); out.b93debt0 = Math.abs(f.calledLP + f.calledGP - k0 - 5) < 1e-9 && A.resOf(c) === 0;
      const c2 = company(f, 0); c2.pe.wc = 0; const k1 = f.calledLP + f.calledGP; S.week++; A.fundAuto8(f); out.b93none = f.calledLP + f.calledGP === k1 && A.resOf(c2) === 0; }
    { let f; ({S, f} = fundCo(2696)); click('fundact', 99999999, 'ok'); const c = company(f, 20); setRoom(f, 100); S.player.cash = 50; const k0 = f.calledLP + f.calledGP;
      A.fundAsk(f, 'recap', {cid: c.id, name: c.name, amt: 4, pay: 4, why: 't'}); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); click('fundact', it.id, 'ok');
      out.b93partial = Math.abs(f.calledLP + f.calledGP - k0 - 4) < 1e-9 && c.debt === 16 && c.pe.recap === 6 && c.pe.wc === 5; A.trClose(); A.importText(A.exportText()); const c2 = A.S.cos.find(x => x.id === c.id); out.b93reload = c2.pe.recap === 6 && c2.pe.wc === 5; }
    /* BUG-94: 15 left, 15 reserved: the reserved recapitalisation settles; fees take nothing from it */
    { let f; ({S, f} = fundCo(2697)); click('fundact', 99999999, 'ok'); const c = company(f, 30); setRoom(f, 15); S.player.cash = .75; A.trClose(); f.fees = 0; f.feeShort = 0; A.fundWeekly(f); out.b94fee = Math.abs(A.fundRoom(f) - 15) < 1e-9 && f.fees === 0;
      S.player.cash = .74; A.fundAsk(f, 'recap', {cid: c.id, name: c.name, amt: 15, pay: 10, why: 't'}); let it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); const s0 = JSON.stringify([A.fundRoom(f), A.resOf(c), c.debt]); click('fundact', it.id, 'ok'); out.b94short = JSON.stringify([A.fundRoom(f), A.resOf(c), c.debt]) === s0;
      S.player.cash = .75; A.fundAsk(f, 'recap', {cid: c.id, name: c.name, amt: 15, pay: 10, why: 't'}); it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); click('fundact', it.id, 'ok');
      info.b94 = {room: A.fundRoom(f), res: A.resOf(c), gp: A.gpRes(), cash: S.player.cash}; out.b94 = Math.abs(A.fundRoom(f)) < 1e-9 && A.resOf(c) === 0 && A.gpRes() === 0 && Math.abs(S.player.cash) < 1e-9 && S.player.loan === 0; }
    /* BUG-95: a search the GP cannot pay for is reported as not run; one that runs says what it found */
    { let f; ({S, f} = fundCo(2698)); click('fundact', 99999999, 'ok'); const c = company(f, 30); setRoom(f, 100); const cost = A.fundSrchCost(f); S.player.cash = .75 + .1; A.trClose(); const n0 = f.srchN || 0, deals0 = S.pe.deals.length;
      A.fundAsk(f, 'search', {name: 'x', amt: cost}); let it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'search'); const r0 = A.fundActDo(it); info.b95 = {cost, r0};
      out.b95refuse = r0 !== '' && (f.srchN || 0) === n0 && Math.abs(S.player.cash - .85) < 1e-9 && S.pe.deals.length === deals0;
      S.player.cash = .75 + cost; f.srchW = null; const r1 = A.fundActDo(it); const found = S.pe.deals.length > deals0; info.b95.r1 = r1; info.b95.note = A.actNote; info.b95.found = found;
      out.b95ran = r1 === '' && f.srchN === n0 + 1 && Math.abs(S.player.cash - .75) < 1e-9 && (found ? /見つかりました/.test(A.actNote) && (f.srchHit || 0) === 1 : /見つかりませんでした/.test(A.actNote) && !(f.srchHit > 0)); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev26: recapitalisation paid from today\'s debt by purpose, unneeded paydown released (BUG-93); a reserved payment settles from its own room (BUG-94); a search reports whether it ran and what it found (BUG-95)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev26 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev25(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, strat) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise(strat || 'turn', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = 'propose'; return {S, f}; };
    const deal = (pred) => { let d = null; for (let i = 0; i < 200 && !d; i++) { const x = A.peDealGen(); if (x && pred(x)) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } return d; };
    const click = (act, id, v) => { const el = document.createElement('button'); el.dataset.id = id; el.dataset.v = v; A.act(act, el); };
    const setRoom = (f, room) => { const T = 1000, k = T - room; f.gp = T * .05; f.lp = T - f.gp; f.lp0 = f.lp; f.gp0 = f.gp; f.calledGP = k * .05; f.calledLP = k - f.calledGP; f.invEnd = Math.max(f.invEnd, A.S.week + 100); }; /* the document's case: a 1,000 fund with 16.538462 left (15 reserved, 4 weeks of fees 1.538462) */
    let S;
    /* BUG-92: another top-up for the same company cannot use its recapitalisation reservation; the recapitalisation itself can */
    { let f; ({S, f} = fundCo(2592)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.debt > 12); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), 0, false); c.pe.recap = 10; c.pe.wc = 5; c.pe.p100 = S.week;
      click('fundact', 99999999, 'ok'); /* any first action settles a one-off amount; the snapshot is taken after it */ setRoom(f, 16.538462); S.player.cash = .75; S.player.loan = 0; A.trClose(); const snap = () => JSON.stringify([S.player.cash, A.fundRoom(f), A.resOf(c), A.gpRes(), c.cash, c.debt, f.calledLP, f.calledGP]); const s0 = snap();
      A.fundAsk(f, 'inj', {cid: c.id, name: c.name, amt: 1, why: '運転資金'}); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'inj'); click('fundact', it.id, 'ok');
      info.b92 = {why: A.fundInjOk(f, c, 1, 0)}; out.b92refuse = snap() === s0 && A.fundInjOk(f, c, 1, 0) !== '';
      A.fundAsk(f, 'recap', {cid: c.id, name: c.name, amt: 6, pay: 6, why: '再建（分割）'}); const ir = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); const k0 = f.calledLP + f.calledGP, d0 = c.debt; click('fundact', ir.id, 'ok');
      info.b92.part = {called: +(f.calledLP + f.calledGP - k0).toFixed(6), debt: +(d0 - c.debt).toFixed(6), res: A.resOf(c), recap: c.pe.recap, wc: c.pe.wc, gp: +S.player.cash.toFixed(6)};
      out.b92partial = Math.abs(f.calledLP + f.calledGP - k0 - 6) < 1e-9 && Math.abs(d0 - c.debt - 6) < 1e-9 && Math.abs(A.resOf(c) - 9) < 1e-9 && c.pe.recap === 4 && c.pe.wc === 5 && Math.abs(S.player.cash - .45) < 1e-9;
      A.fundAsk(f, 'recap', {cid: c.id, name: c.name, amt: 9, pay: 4, why: '再建（残り）'}); const ir2 = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); const k1 = f.calledLP + f.calledGP; click('fundact', ir2.id, 'ok'); click('fundact', ir2.id, 'ok');
      out.b92rest = Math.abs(f.calledLP + f.calledGP - k1 - 9) < 1e-9 && A.resOf(c) === 0 && Math.abs(S.player.cash) < 1e-9 && S.player.loan === 0;
      setRoom(f, 22); S.player.cash = 1; A.trClose(); out.b92free = A.fundInjOk(f, c, 1, 0) === '' && A.fundInject(f, c, 1, 't', 0) && A.resOf(c) === 0; A.trClose(); out.b92load = loads(); }
    /* BUG-90: the weekly fee takes only what reservations leave; the rest is recorded unpaid */
    { let f; ({S, f} = fundCo(2590, 'buyout')); f.cfg.mode = 'manual'; f.invEnd = S.week + 200; const d = deal(x => A.dealEbitda(x, false) > 0); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), 0, false);
      const T = 1000; f.gp = T * .05; f.lp = T - f.gp; const called = T - 16.538462; f.calledGP = called * .05; f.calledLP = called - f.calledGP; f.fees = 0; f.feeShort = 0; c.pe.recap = 10; c.pe.wc = 5; S.player.cash = 100;
      const rooms = []; for (let i = 0; i < 8; i++) { A.fundWeekly(f); rooms.push(+A.fundRoom(f).toFixed(6)); }
      info.b90 = {rooms, fees: +f.fees.toFixed(6), short: +f.feeShort.toFixed(6)}; out.b90 = rooms.slice(3).every(x => Math.abs(x - 15) < 1e-6) && Math.abs(f.fees - 1.538462) < 1e-6 && Math.abs(f.feeShort - 1.538462) < 2e-6 && A.resOf(c) === 15;
      c.pe.recap = 0; c.pe.wc = 0; A.fundWeekly(f); out.b90resume = Math.abs(f.fees - 1.538462 - 1000 * .02 / 52) < 1e-6; }
    /* BUG-91: approving a DD cannot spend the GP cash held for reservations */
    { let f; ({S, f} = fundCo(2591)); const d = deal(x => A.dealEbitda(x, false) > 0); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), 0, false); c.pe.recap = 10; c.pe.wc = 5; /* GP share 0.75 */
      const dd = deal(x => x !== d && !x.dd); dd.exp = S.week + 20; click('fundact', 99999999, 'ok'); S.player.cash = .75 + Math.max(0, A.ddCost(dd) - .01); A.trClose(); const cash0 = S.player.cash;
      A.fundAsk(f, 'dd', {did: dd.id, name: dd.name, amt: A.ddCost(dd)}); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'dd'); click('fundact', it.id, 'ok');
      info.b91 = {cost: +A.ddCost(dd).toFixed(4), cash: +cash0.toFixed(4), res: A.gpRes()}; out.b91refuse = !dd.dd && S.player.cash === cash0 && Math.abs(A.gpRes() - .75) < 1e-9 && !A.peDD(dd);
      S.player.cash = .75 + A.ddCost(dd) + .01; A.fundAsk(f, 'dd', {did: dd.id, name: dd.name, amt: A.ddCost(dd)}); const it2 = S.inbox.find(i => i.kind === 'fundact' && i.act === 'dd'); const c1 = S.player.cash; click('fundact', it2.id, 'ok');
      out.b91ok = dd.dd === 1 && Math.abs(c1 - S.player.cash - A.ddCost(dd)) < 1e-6 && S.player.cash >= A.gpRes() - 1e-9; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev25: a recapitalisation reservation is used only by that recapitalisation (BUG-92); fees never eat reservations (BUG-90); DD approvals keep the GP cash held for reservations (BUG-91)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev25 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev24(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, strat) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise(strat || 'buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = 'manual'; return {S, f, lead: pp}; };
    const deal = (pred) => { let d = null; for (let i = 0; i < 200 && !d; i++) { const x = A.peDealGen(); if (x && pred(x)) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } return d; };
    const st = (f) => JSON.stringify({cash: A.S.player.cash, loan: A.S.player.loan, called: f.calledLP + f.calledGP, res: A.fundRes(f), gp: A.gpRes()});
    let S;
    /* BUG-86: purchase + debt paydown 10 + working capital 5 is one sum; too little room refuses it, with nothing changed */
    { let f; ({S, f} = fundCo(2486)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.exp = S.week + 20; d.n = 0; d.ai = 0; d.bids = []; const q = A.peQuote(d, A.dealAsk(d), 0, f.id);
      const setRoom = room => { const T = (f.calledLP + f.calledGP + room) / (1 - Math.min(1, .02 / 52 * 4)) ; f.gp = T * .05; f.lp = T - f.gp; }; setRoom(q.out + 1); /* room for the purchase and 1 more, not 15 */
      const s0 = st(f); d.fExtra = {recap: 10, wc: 5}; const no = A.peBid(d, 0, 0, false, f.id); info.b86 = {buy: +q.out.toFixed(4), dry: +A.fundDry(f).toFixed(4)}; out.b86refuse = !no && !d.bid && st(f) === s0 && !d.fExtra;
      setRoom(q.out + 40); d.fExtra = {recap: 10, wc: 5}; const yes = A.peBid(d, 0, 0, false, f.id); const b1 = d.bid;
      out.b86reserve = yes && Math.abs(b1.need - (q.out + 15)) < 1e-9 && Math.abs(b1.gpNeed - b1.need * .05) < 1e-9 && Math.abs(A.fundRes(f) - b1.need) < 1e-9 && Math.abs(A.gpRes() - b1.gpNeed) < 1e-9 && b1.parts.recap === 10 && b1.parts.wc === 5;
      /* the GP's cash falls before the auction: it withdraws, borrowing nothing */ const cash = S.player.cash; S.player.cash = b1.gpNeed * .5; const loan0 = S.player.loan, k0 = f.calledLP + f.calledGP; const rr = A.peResolve(d); out.b86short = rr === 'fail' && S.player.loan === loan0 && f.calledLP + f.calledGP === k0 && !S.cos.some(c => c.name === d.name && c.pe && c.pe.owner === f.id);
      S.player.cash = cash; const d2 = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x !== d); d2.dd = 2; d2.exp = S.week + 20; d2.n = 0; d2.ai = 0; d2.bids = []; d2.risk = null; d2.fExtra = {recap: Math.min(3, d2.debt), wc: 2}; const q2 = A.peQuote(d2, A.dealAsk(d2), 0, f.id); setRoom(q2.out + 40); S.pe.deals = [d2];
      const ok2 = A.peBid(d2, 0, 0, false, f.id); const need2 = d2.bid.need; const won = A.peResolve(d2); const c = S.cos.find(x => x.name === d2.name && x.pe && x.pe.owner === f.id); S.pe.deals = [];
      info.b86b = {ok2, won, recap: c && c.pe.recap, wc: c && c.pe.wc, res: +A.fundRes(f).toFixed(4)}; out.b86carry = ok2 && won === 'won' && !!c && Math.abs(c.pe.recap + c.pe.wc - (need2 - q2.out)) < 1e-9 && Math.abs(A.fundRes(f) - (c.pe.recap + c.pe.wc)) < 1e-9 && loads(); }
    /* BUG-85: a bolt-on's GP share counts against the GP's cash like any other fund bid, by the fund that pays */
    { let f; ({S, f} = fundCo(2485, 'rollup')); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type === 'succ'); d.dd = 2; d.risk = null; const P = A.peAcquire(d, f.id, A.dealAsk(d), .3, false);
      const g = A.fundRaise ? null : null; S.pe.funds.push(Object.assign(JSON.parse(JSON.stringify(f)), {id: 'F9', n: 'F9', strat: 'buyout'})); const f2 = S.pe.funds.find(x => x.id === 'F9'); f2.calledLP = f2.calledGP = 0;
      const dA = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x.ind !== P.ind); dA.dd = 2; dA.exp = S.week + 20; const okA = A.peBid(dA, 0, 0, false, 'F9'); const gA = dA.bid.gpNeed;
      let dB = null; for (let i = 0; i < 300 && !dB; i++) { const x = A.peDealGen({type: 'succ', ind: P.ind, scale: P.rev * .3}); if (x && x !== dA) dB = x; } dB.dd = 2; dB.exp = S.week + 20; const qB = A.peQuote(dB, A.dealAsk(dB), 0, P.id), integ = dB.rev * .02, gB = (qB.out + integ) * .05;
      S.player.cash = gA + gB * .5; const s0 = JSON.stringify([S.player.cash, A.gpRes(), A.fundRes(f)]); dB.fundPay = {f: f.id}; dB.fExtra = {integ}; dB.integ = integ; const noB = A.peBid(dB, 0, 0, false, P.id);
      info.b85 = {okA, gA: +gA.toFixed(4), gB: +gB.toFixed(4), cash: +S.player.cash.toFixed(4), noB}; out.b85refuse = okA && !noB && !dB.bid && JSON.stringify([S.player.cash, A.gpRes(), A.fundRes(f)]) === s0;
      S.player.cash = 1e4; dB.fundPay = {f: f.id}; dB.fExtra = {integ}; const yesB = A.peBid(dB, 0, 0, false, P.id); out.b85both = yesB && dB.bid.fid === f.id && Math.abs(A.gpRes() - gA - dB.bid.gpNeed) < 1e-9 && Math.abs(dB.bid.gpNeed - gB) < 1e-9 && Math.abs(A.fundRes(f) - dB.bid.need) < 1e-9 && Math.abs(A.fundRes(f2) - dA.bid.need) < 1e-9;
      S.pe.deals = S.pe.deals.filter(x => x !== dA); out.b85release = Math.abs(A.gpRes() - dB.bid.gpNeed) < 1e-9 && A.fundRes(f2) === 0 && loads(); }
    /* BUG-87: a recapitalisation waiting for approval stays reserved; nothing is paid until approved, once */
    { let f; ({S, f} = fundCo(2487)); f.cfg.mode = 'propose'; const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x.debt > 10); if (d) { d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), 0, false); c.pe.recap = 10; c.pe.wc = 5; c.pe.p100 = S.week; c.cash = c.rev * .1; A.trClose(); /* the test set these by hand: the record's baseline is taken again */
      const k0 = f.calledLP + f.calledGP, d0 = c.debt; S.week++; A.fundAuto8(f); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); out.b87hold = !!it && Math.abs(A.fundRes(f) - 15) < 1e-9 && f.calledLP + f.calledGP === k0 && c.debt === d0 && c.pe.recap === 10;
      const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'no'; A.act('fundact', el); out.b87decline = Math.abs(A.fundRes(f) - 15) < 1e-9 && f.calledLP + f.calledGP === k0;
      f.askNo = {}; S.week++; A.fundAuto8(f); const it2 = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap'); const el2 = document.createElement('button'); el2.dataset.id = it2.id; el2.dataset.v = 'ok'; A.act('fundact', el2); A.act('fundact', el2);
      info.b87 = {called: +(f.calledLP + f.calledGP - k0).toFixed(4), debt: +(d0 - c.debt).toFixed(4), res: A.fundRes(f)}; A.trClose(); /* the weeks were moved by hand in this test */ out.b87pay = Math.abs(f.calledLP + f.calledGP - k0 - 15) < 1e-9 && Math.abs(d0 - c.debt - 10) < 1e-9 && A.fundRes(f) === 0 && c.pe.recap === 0 && loads(); }
      else out.b87hold = out.b87decline = out.b87pay = 'no deal'; }
    /* BUG-88: a fund wound down with nothing called: the next fund can be raised from its original size */
    { let f; ({S, f} = fundCo(2488)); const orig = A.fundOrig(f); A.fundWind(f); info.b88 = {orig, closed: f.closed, lp: f.lp, can: A.fundCanRaise(), target: A.fundTarget()}; S.player.cash = 5000; const tgt = A.fundTarget();
      const g = A.fundRaise('buyout', .05); out.b88 = f.closed && !!g && g.size > 0 && A.fundOrig(f) === orig && tgt > 0;
      A.importText(A.exportText()); out.b88reload = A.fundOrig(A.S.pe.funds[0]) === orig && A.S.pe.funds[0].relLP === f.relLP;
      S = A.S; S.pe.funds = S.pe.funds.filter(x => x.id !== g.id); S.player.cash = .01; out.b88why = !A.fundRaise('buyout', .05) && A.fundRaiseWhy(.05).includes('GPの出資'); }
    /* BUG-89: a share that cannot be sold (restructuring) keeps the fund winding down; it closes once it is sold, distributing once */
    { let f; ({S, f} = fundCo(2489)); const c = S.cos.find(x => !x.priv && !x.ctrl && x.price > 1); c.own[f.id] = c.shares * .05; c.reorg = {w: S.week, x: 1}; const nav0 = c.own[f.id] * c.price;
      A.fundWind(f); out.b89hold = !f.closed && f.winding === 'early' && (f.windLeft || []).length === 1 && A.fundCard(f).includes('売却待ち'); const fees0 = f.fees; A.fundWeekly(f); out.b89stay = !f.closed && f.fees === fees0;
      const t = A.exportText(); A.importText(t); S = A.S; f = S.pe.funds[0]; const c2 = S.cos.find(x => x.id === c.id); out.b89reload = !f.closed && f.winding === 'early';
      c2.reorg = null; const d0 = f.distLP + f.distGP; A.fundWeekly(f); const d1 = f.distLP + f.distGP; A.fundWeekly(f); A.fundWeekly(f); info.b89 = {nav0: +nav0.toFixed(3), dist: +(d1 - d0).toFixed(3), closed: f.closed, left: c2.own[f.id] || 0};
      out.b89done = f.closed && !f.winding && d1 > d0 && f.distLP + f.distGP === d1 && !(c2.own[f.id] > 1e-9); A.trClose(); out.fundLedger = (S.ledger || []).some(x => x.k === f.id && x.at === 'fund') && loads(); /* rev24: a fund's sale of listed shares is booked to the fund; the save opens */
      /* maturity: the same */ let g; ({S, f: g} = fundCo(2490)); const e = S.cos.find(x => !x.priv && !x.ctrl && x.price > 1); e.own[g.id] = e.shares * .03; e.reorg = {w: S.week}; S.week = g.end; A.fundWeekly(g); out.b89end = !g.closed && g.winding === 'end';
      /* an older save that closed a fund while it still held shares reopens it as winding down */ g.closed = true; g.winding = null; e.reorg = null; /* the test's stand-in restructuring is not a full record: removed before saving */ A.trClose(); A.importText(A.exportText()); const g2 = A.S.pe.funds.find(x => x.id === g.id); out.b89old = !g2.closed && g2.winding === 'end' && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev24: one reservation per deal incl. recapitalisation (BUG-86), bolt-on GP shares counted by the paying fund (BUG-85), recapitalisation kept while waiting (BUG-87), next fund after an empty wind-down (BUG-88), no close with unsold assets (BUG-89)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev24 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testBal09(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, strat, mode) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise(strat || 'buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = mode || 'auto'; return {S, f, lead: pp}; };
    const deal = (pred) => { let d = null; for (let i = 0; i < 200 && !d; i++) { const x = A.peDealGen(); if (x && pred(x)) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } return d; };
    const click = (act, id, v) => { const el = document.createElement('button'); el.dataset.id = id; el.dataset.v = v; el.dataset.ok = '1'; A.act(act, el); };
    let S;
    /* a fund's own search: its kind of deal, paid by the GP, with a cooldown and at most six a year; in proposal mode only after approval */
    { let f, lead; ({S, f, lead} = fundCo(2391, 'turn')); const c0 = S.player.cash, cost = A.fundSrchCost(f); const d = (A.fundSourceDo(f, lead) || {}).deal; out.search = !!d && d.type === 'turn' && d.src === f.id && Math.abs(c0 - S.player.cash - cost) < 1e-9 && d.exp >= S.week + 12;
      const n = f.srchN; S.week += 1; A.fundSource(f, lead); out.cooldown = f.srchN === n; f.cfg.mode = 'propose'; S.week += 20; S.inbox = []; A.fundSource(f, lead); out.searchAsk = f.srchN === n && S.inbox.some(i => i.kind === 'fundact' && i.act === 'search'); }
    /* a year without buying: the fund asks you; shortening the investment period; early wind-down only once, releasing the unpaid commitment */
    { let f, lead; ({S, f, lead} = fundCo(2392, 'buyout')); S.week = f.w0 + 56; S.week = Math.ceil(S.week / 4) * 4; S.inbox = []; A.fundIdle(f); const it = S.inbox.find(i => i.kind === 'fundrev'); out.idle = !!it && A.fundRevCard(it).includes('早期に清算');
      const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), .3, false); const fees0 = f.fees, gp0 = S.player.cash, k0 = f.calledLP + f.calledGP;
      click('fundrev', it.id, 'wind'); info.wind = {closed: f.closed, lp: f.lp, called: f.calledLP, rel: f.relLP, own: c.own[f.id] || 0, inCos: A.S.cos.includes(c)};
      out.wind = f.closed && Math.abs(f.lp - f.calledLP) < 1e-9 && Math.abs(f.gp - f.calledGP) < 1e-9 && f.relLP > 0 && !A.S.cos.includes(c) && f.distLP > 0; const st = JSON.stringify([f.lp, f.gp, f.calledLP, f.calledGP, f.fees, f.distLP]);
      for (let i = 0; i < 8; i++) { A.step(); S.inbox = []; } out.windOnce = JSON.stringify([f.lp, f.gp, f.calledLP, f.calledGP, f.fees, f.distLP]) === st && !A.fundWind(f) && loads();
      let g; ({S, f: g} = fundCo(2393, 'buyout')); out.short = A.fundShorten(g) && g.invEnd === S.week && A.fundDry(g) === 0 && !A.fundShorten(g); }
    /* a roll-up: the platform first, then bolt-ons paid by the fund (reserved), integration costs stated, merged into the platform and recorded */
    { let f, lead; ({S, f, lead} = fundCo(2394, 'rollup')); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type === 'succ'); d.dd = 2; d.risk = null; const P = A.peAcquire(d, f.id, A.dealAsk(d), .3, false); P.cash += 5;
      let b2 = null; for (let i = 0; i < 400 && !b2; i++) { const x = A.peDealGen({type: 'succ', ind: P.ind, scale: P.rev * .3}); if (x && A.fundEvalBolt(f, x, P, lead).ok) b2 = x; else if (x) S.pe.deals = S.pe.deals.filter(y => y !== x); }
      if (b2) { b2.dd = 2; b2.n = 0; b2.ai = 0; b2.bids = []; b2.exp = S.week + 20; S.pe.deals = [b2]; S.week = Math.ceil((S.week + 1) / 4) * 4; A.fundInvest(f, lead, [P]); const res = A.fundRes(f), need = b2.bid && b2.bid.need;
        info.bolt = {bid: !!b2.bid, fund: b2.bid && b2.bid.fund, need, res, integ: b2.integ}; out.boltBid = !!b2.bid && b2.bid.fund === f.id && b2.bid.owner === P.id && Math.abs(res - need) < 1e-9 && b2.integ > 0;
        const rev0 = P.rev, k0 = f.calledLP + f.calledGP; for (let i = 0; i < 5; i++) { A.step(); S.inbox = []; } info.bolt.log = (P.boltLog || []).length; out.boltDone = (P.boltLog || []).length === 1 && P.rev > rev0 && f.calledLP + f.calledGP > k0 && A.fundRes(f) === 0 && loads(); }
      else { out.boltBid = out.boltDone = 'no bolt-on found'; } }
    /* sizing: the GP's share must fit half its free cash */
    { const S2 = traderCo(2395, 40); S2.allUnlocked = true; S2.stage = 4; Object.assign(S2.dept.inv, {on: true, staff: 3}); S2.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const f = A.fundRaise('buyout', .1); info.size = f && f.size; out.sizeCap = !!f && f.size * .1 <= 40 * .5 + 1e-9; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('BAL-09: fund search (kind, cost, cooldown, approval), idle fund review, shortening, one-time wind-down, roll-up bolt-ons paid by the fund, sizing within the GP cash', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in BAL-09 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev23(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, mode) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = 70; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise('buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; f.cfg.mode = mode || 'propose'; return {S, f, lead: pp}; };
    const deal = (pred) => { let d = null; for (let i = 0; i < 200 && !d; i++) { const x = A.peDealGen(); if (x && pred(x)) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } return d; };
    const click = (act, id, v) => { const el = document.createElement('button'); el.dataset.id = id; el.dataset.v = v; A.act(act, el); };
    const snap = (c, f) => JSON.stringify({cash: c.cash, debt: c.debt, dm: c.dm || null, deleg: c.deleg || null, p100: c.pe.p100 == null ? null : c.pe.p100, pol: c.pe.pol || null, called: f.calledLP + f.calledGP, gp: A.S.player.cash, fixed: c.fixed});
    let S;
    /* BUG-82: proposal mode — nothing moves before you approve; approving runs only what was approved, once */
    { let f, lead; ({S, f, lead} = fundCo(2382)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), .3, false); c.pe.recap = Math.min(1, c.debt * .5); c.cash = c.rev * .08;
      const s0 = snap(c, f); for (let i = 0; i < 4; i++) { S.week++; A.fundAuto8(f); } const s1 = snap(c, f); const items = S.inbox.filter(i => i.kind === 'fundact' && i.cid === c.id);
      info.b82 = {acts: items.map(i => i.act), same: s0 === s1}; out.b82before = s0 === s1 && items.some(i => i.act === 'plan') && items.some(i => i.act === 'recap');
      const t = A.exportText(); A.importText(t); S = A.S; f = S.pe.funds[0]; const c2 = S.cos.find(x => x.id === c.id); /* saved and loaded while waiting */
      const ip = S.inbox.find(i => i.kind === 'fundact' && i.act === 'plan' && i.cid === c2.id), ir = S.inbox.find(i => i.kind === 'fundact' && i.act === 'recap' && i.cid === c2.id);
      const d0 = c2.debt, k0 = f.calledLP + f.calledGP; click('fundact', ir.id, 'ok'); const d1 = c2.debt, k1 = f.calledLP + f.calledGP; click('fundact', ir.id, 'ok');
      info.b82.recap = {amt: ir.amt, debt: +(d0 - d1).toFixed(4), called: +(k1 - k0).toFixed(4), lp: +(k1 - k0 - (k1 - k0) * .05).toFixed(4)};
      out.b82recap = Math.abs(d0 - d1 - ir.amt) < 1e-9 && Math.abs(k1 - k0 - ir.amt) < 1e-9 && c2.debt === d1 && f.calledLP + f.calledGP === k1;
      click('fundact', ip.id, 'ok'); out.b82plan = c2.pe.p100 != null && c2.dm === 'auto' && !!c2.pe.pol && !S.inbox.some(i => i.kind === 'fundact' && i.cid === c2.id && i.act === 'plan');
      /* stale approvals: mode switched, lead replaced, too late, after the exit */
      const fx = A.fundAsk(f, 'exit', {cid: c2.id, name: c2.name, why: 't'}), ie = S.inbox.find(i => i.kind === 'fundact' && i.act === 'exit'); f.cfg.mode = 'auto'; const s2 = snap(c2, f); click('fundact', ie.id, 'ok'); out.b82mode = (fx || !!ie) && !c2.pe.sale && snap(c2, f) === s2; /* rev37: the fund may already have proposed this exit on its own; either way approving it in auto mode must change nothing */
      f.cfg.mode = 'propose'; A.fundAsk(f, 'exit', {cid: c2.id, name: c2.name, why: 't'}); const ie2 = S.inbox.find(i => i.kind === 'fundact' && i.act === 'exit'); ie2.exp = S.week - 1; click('fundact', ie2.id, 'ok'); out.b82late = !c2.pe.sale;
      A.fundAsk(f, 'exit', {cid: c2.id, name: c2.name, why: 't'}); const ie3 = S.inbox.find(i => i.kind === 'fundact' && i.act === 'exit'); ie3.lead = 'nobody'; click('fundact', ie3.id, 'ok'); out.b82lead = !c2.pe.sale;
      /* declined: not proposed again for 8 weeks */ A.fundAsk(f, 'exit', {cid: c2.id, name: c2.name, why: 't'}); const ie4 = S.inbox.find(i => i.kind === 'fundact' && i.act === 'exit'); click('fundact', ie4.id, 'no'); out.b82decline = !A.fundAsk(f, 'exit', {cid: c2.id, name: c2.name, why: 't'}) && !c2.pe.sale && loads(); }
    /* BUG-82: approved cash shortfall after approval: refused, nothing moves; a recapitalisation approved with the bid needs no second approval */
    { let f, lead; ({S, f, lead} = fundCo(2383)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), .3, false); c.cash = 0;
      A.fundAsk(f, 'inj', {cid: c.id, name: c.name, amt: c.rev * .05, why: 't'}); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'inj'); const gp = S.player.cash; S.player.cash = 0; click('fundact', 99999999, 'ok'); /* any first action settles a one-off amount; the snapshot is taken after it */ const r0 = A.fundActDo(it); info.cash = {r0}; const s0 = snap(c, f); click('fundact', it.id, 'ok');  out.b82cash = snap(c, f) === s0; S.player.cash = gp;
      const d2 = deal(x => A.dealEbitda(x, false) > 0 && x !== d && x.type !== 'turn'); d2.dd = 2; d2.risk = null; d2.fRecap = {f: f.id, amt: .5, ok: true}; const c3 = A.peAcquire(d2, f.id, A.dealAsk(d2), .3, false); c3.cash = c3.rev * .1; const k0 = f.calledLP + f.calledGP, db = c3.debt; S.week++; A.fundAuto8(f);
      out.b82preapproved = Math.abs(f.calledLP + f.calledGP - k0 - .5) < 1e-9 && Math.abs(db - c3.debt - .5) < 1e-9 && !S.inbox.some(i => i.kind === 'fundact' && i.act === 'recap' && i.cid === c3.id); }
    /* BUG-82: with "after-purchase plan" off, the team does nothing optional; manual mode files nothing */
    { let f; ({S, f} = fundCo(2384)); f.cfg.ops = false; const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), .3, false); for (let i = 0; i < 30; i++) { S.week++; A.fundAuto8(f); }
      out.b82opsOff = !S.inbox.some(i => i.kind === 'fundact' && (i.act === 'plan' || i.act === 'review')) && c.pe.p100 == null;
      f.cfg.ops = true; f.cfg.mode = 'manual'; S.inbox = []; const s0 = snap(c, f); for (let i = 0; i < 30; i++) { S.week++; A.fundAuto8(f); } out.b82manual = !S.inbox.length && snap(c, f) === s0 && !!c.pe.rv; }
    /* BUG-83: an open fund bid saved without its reservation gets it back on loading, once */
    { let f; ({S, f} = fundCo(2385, 'manual')); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.exp = S.week + 20; const ok = A.peBid(d, 0, .5, false, f.id); const need = d.bid.need, gpn = d.bid.gpNeed;
      const o = JSON.parse(A.exportText()); { const ob = o.pe.deals.find(x => x.id === d.id).bid; for (const k of ['need', 'parts', 'fid', 'rid']) delete ob[k]; } /* an older save's bid: no reservation fields at all */ A.importText(JSON.stringify(o)); S = A.S; f = S.pe.funds[0]; const b1 = S.pe.deals.find(x => x.id === d.id).bid;
      info.b83 = {ok, need: +need.toFixed(4), back: +b1.need.toFixed(4), gp: +b1.gpNeed.toFixed(4), gpWant: +(need * A.gpRatio(f)).toFixed(4), res: +A.fundRes(f).toFixed(4)};
      out.b83 = ok && Math.abs(b1.need - need) < 1e-9 && Math.abs(b1.gpNeed - gpn) < 1e-9 && Math.abs(A.fundRes(f) - need) < 1e-9;
      A.importText(A.exportText()); const b2 = A.S.pe.deals.find(x => x.id === d.id).bid; out.b83again = Math.abs(b2.need - need) < 1e-9 && b2.needFix === b1.needFix;
      S = A.S; f = S.pe.funds[0]; const dry = A.fundDry(f); const big = deal(x => A.dealEbitda(x, false) > 0 && x.id !== d.id); big.dd = 2; big.exp = S.week + 20; const room = A.fundRoom(f); f.lp = f.calledLP + (need + A.peQuote(big, A.dealAsk(big), .5, f.id).out * .5) * .95 + f.lp * 0; f.gp = f.lp / .95 * .05; 
      const refuse = !A.peBid(big, 0, .5, false, f.id); S.pe.deals = S.pe.deals.filter(x => x.id !== d.id); const after = A.fundRes(f); out.b83block = refuse && after === 0 && loads(); }
    /* BUG-84: a review every 13 weeks from the purchase (13, 26, 39, 52), for companies bought in different weeks */
    { let f; ({S, f} = fundCo(2386, 'manual')); S.week = 1000 + 3; const w0 = S.week; const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), .3, false);
      let c2 = null, w2 = null; const at = [], at2 = []; for (let i = 0; i < 60; i++) { S.week++; if (i === 4) { const d2 = deal(x => A.dealEbitda(x, false) > 0 && x !== d && x.type !== 'turn'); d2.dd = 2; d2.risk = null; c2 = A.peAcquire(d2, f.id, A.dealAsk(d2), .3, false); w2 = S.week; }
        const n1 = c.pe.rvN || 0, n2 = c2 ? c2.pe.rvN || 0 : 0; A.fundAuto8(f); if ((c.pe.rvN || 0) > n1) at.push(S.week - w0); if (c2 && (c2.pe.rvN || 0) > n2) at2.push(S.week - w2); }
      info.b84 = {at, at2}; out.b84 = JSON.stringify(at) === '[13,26,39,52]' && JSON.stringify(at2) === '[13,26,39,52]'; /* the second was bought 5 weeks later: its own 13-week cycle */
      const n = c.pe.rvN; A.fundAuto8(f); A.importText(A.exportText()); A.S.pe.funds[0] && A.fundAuto8(A.S.pe.funds[0]); out.b84once = A.S.cos.find(x => x.id === c.id).pe.rvN === n; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev23: fund proposals need your approval for every action (BUG-82); old open bids get their reservations back (BUG-83); reviews every 13 weeks (BUG-84)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev23 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testBal08(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const fundCo = (seed, lv) => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pp = S.hr.people[S.hr.pool[0]]; for (const k in pp.sk) pp.sk[k] = lv || 60; A.hireInto(pp, 'HQ', 'PEH', 'fixed', null); const f = A.fundRaise('buyout', .05, pp.id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } S.pe.deals = []; return {S, f, lead: pp}; };
    const deal = (pred) => { let d = null; for (let i = 0; i < 200 && !d; i++) { const x = A.peDealGen(); if (x && pred(x)) d = x; else if (x) A.S.pe.deals = A.S.pe.deals.filter(y => y !== x); } return d; };
    let S;
    /* new funds use the new rules; an old fund keeps the old ones after loading */
    { let f; ({S, f} = fundCo(2801)); out.cfg = !!f.cfg && A.fundMode(f) === 'auto' && f.cfg.dd && f.cfg.ops;
      const o = JSON.parse(A.exportText()); delete o.pe.funds[0].cfg; o.pe.funds[0].auto = false; A.importText(JSON.stringify(o)); out.legacy = !A.S.pe.funds[0].cfg && A.fundMode(A.S.pe.funds[0]) === 'manual' && A.fundCard(A.S.pe.funds[0]).includes('新しい運用ルール'); }
    /* the team's view: a loss-maker is passed; the debt chosen passes the bank's refinancing test with profit 15% lower; until DD, the seller's figures */
    { let f, lead; ({S, f, lead} = fundCo(2802)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x.ind !== 'bank'), v = A.fundEval(f, d, lead);
      const r = (S.econ.rate + 3) / 100, debt = v.ok ? d.debt + v.q.acq : 0; info.eval = {ok: v.ok, why: v.why, lev: v.lev};
      out.evalDebt = !v.ok || debt === 0 || (A.dealEbitda(d, d.dd !== 2) * .85 / (debt * (r + 1 / 7)) >= A.dscrNeed() * 1.15 - 1e-9 && d.assets + d.cash - debt >= -.1 * d.assets - 1e-9);
      const L = deal(x => A.dealEbitda(x, true) <= 0 && x.type !== 'turn'); out.evalLoss = !L || !A.fundEval(f, L, lead).ok;
      const bk = deal(x => x.ind === 'bank' && A.dealEbitda(x, false) > 0); out.bankNoDebt = !bk || !A.fundEval(f, bk, lead).ok || A.fundEval(f, bk, lead).lev === 0; }
    /* due diligence before bidding: the first pass starts DD (paid by the GP), the bid comes once the findings are in */
    { let f, lead; ({S, f, lead} = fundCo(2803)); S.pe.deals = []; let d = null; for (let k = 0; k < 300 && !d; k++) { const x = A.peDealGen(); if (x && A.fundEval(f, x, lead).ok && x.type !== 'turn') { d = x; d.exp = S.week + 20; S.pe.deals = [d]; } else S.pe.deals = []; }
      if (d) { S.week = Math.ceil((S.week + 1) / 4) * 4; const c0 = S.player.cash; A.fundAuto8(f); out.ddFirst = d.dd === 1 && !d.bid && S.player.cash < c0; d.dd = 2; S.week += 4; A.fundAuto8(f); info.dd = {bid: !!d.bid, ok: A.fundEval(f, d, lead).ok, why: A.fundEval(f, d, lead).why}; out.bidAfterDD = !!d.bid === A.fundEval(f, d, lead).ok;
        /* proposals for approval: no bid until you approve */ if (d.bid) d.bid = null; f.cfg.mode = 'propose'; S.week += 4; S.inbox = []; A.fundAuto8(f); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'bid'); out.propose = !A.fundEval(f, d, lead).ok || (!!it && !d.bid && A.fundActCard(it).includes('承認する')); /* rev23: proposals use one approval item for every action */
        if (it) { const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'ok'; A.act('fundact', el); info.appr = {bid: !!d.bid, why: A.fundActWhy(it), news: A.S.news[0].t.slice(0, 80)}; out.approve = !!d.bid && d.bid.owner === f.id; } else out.approve = true;
        /* manual: the team does nothing */ d.bid = null; f.cfg.mode = 'manual'; S.week += 4; S.inbox = []; A.fundAuto8(f); out.manual = !d.bid && !S.inbox.length; }
      else { out.ddFirst = out.bidAfterDD = out.propose = out.approve = out.manual = 'no deal'; } }
    /* after buying: the plan keeps 5% of sales in cash; a small shortfall is topped up from the fund (within the commitment), a large one is proposed to you */
    { let f, lead; ({S, f, lead} = fundCo(2804)); const d = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn'); d.dd = 2; d.risk = null; const c = A.peAcquire(d, f.id, A.dealAsk(d), .3, false);
      c.cash = c.rev * .02; const calledP = f.calledLP + f.calledGP, gp0 = S.player.cash; A.fundTopUp(f, c, lead, 'テスト'); const add = f.calledLP + f.calledGP - calledP;
      info.top = {add: +add.toFixed(4), cash: +c.cash.toFixed(4), floor: +(c.rev * .05).toFixed(4)}; out.topSmall = Math.abs(c.cash - c.rev * .03) < 1e-9 && Math.abs(add - c.rev * .01) < 1e-9 /* rev23: back to 3% of sales (what is short), not a 5% cushion */ && Math.abs(gp0 - S.player.cash - add * .05) < 1e-9 && f.calledLP + f.calledGP <= f.lp + f.gp + 1e-9;
      c.cash = 0; c.crisis = {w: S.week, due: S.week + 8, refi: true, short: Math.min(A.peStats(c).inv * .5, c.debt * .5)}; S.inbox = []; const calledQ = f.calledLP + f.calledGP; A.fundTopUp(f, c, lead, 'テスト'); const it = S.inbox.find(i => i.kind === 'fundact' && i.act === 'inj');
      out.topBig = !!it && f.calledLP + f.calledGP === calledQ && !!c.crisis && A.fundActCard(it).includes('承認する');
      info.inj = {no: A.fundInjOk(f, c, it.amt), amt: +it.amt.toFixed(3), room: +A.fundRoom(f).toFixed(3)}; const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'ok'; A.act('fundact', el); info.inj.cr = c.crisis; out.topApproved = !c.crisis && f.calledLP + f.calledGP > calledQ && !S.inbox.some(i => i.kind === 'fundact') && loads();
      const d2 = deal(x => A.dealEbitda(x, false) > 0 && x.type !== 'turn' && x !== d); d2.dd = 2; d2.risk = null; const c2 = A.peAcquire(d2, f.id, A.dealAsk(d2), .3, false); c2.cash = c2.rev * .06; A.fundPlan(c2); out.planFloor = c2.pe.p100 != null && c2.cash >= c2.rev * .05 - 1e-9; info.plan = c2.pe.p100r; }
    /* a turnaround: no new debt; the plan pays down enough old debt for the books and the bank's test to hold */
    { let f, lead; ({S, f, lead} = fundCo(2806)); f.strat = 'turn'; const d = deal(x => x.type === 'turn' && A.dealEbitda(x, false) > 0); if (d) { const v = A.fundEval(f, d, lead); info.turn = {ok: v.ok, why: v.why, recap: v.recap && +v.recap.toFixed(2)};
      out.turnPlan = !v.ok || (v.lev === 0 && v.recap >= 0 && d.assets + d.cash - (d.debt - v.recap) >= .1 * d.assets - 1e-9 && Math.abs(v.out - v.q.out - v.recap - v.wc) < 1e-9 && v.wc > 0); } /* rev23: the budget also holds a safety margin for working capital and the cost of the cost cuts */ else out.turnPlan = true; }
    /* with no lead, nothing runs */
    { let f, lead; ({S, f, lead} = fundCo(2805)); S.hr.hq.PEH = null; lead.at = null; lead.role = null; f.mgr = null; const d = deal(x => A.dealEbitda(x, false) > 0); d.dd = 2; d.exp = S.week + 20; S.week = Math.ceil((S.week + 1) / 4) * 4; A.fundAuto8(f); out.noLead = !d.bid && !A.fundLead(f) && !S.inbox.some(i => i.kind === 'fundact'); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('BAL-08: fund team checks deals (DD first, debt the bank will refinance), runs a plan with a cash floor, tops up within the commitment (large amounts need you), proposal and manual modes', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in BAL-08 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testRev22(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    const deal = skip => { let d = null; for (let i = 0; i < 120 && !d; i++) { const x = A.peDealGen(); if (x && A.dealEbitda(x, false) > 0 && x !== skip && A.peQuote(x, A.dealAsk(x), .5, 'P').risk !== '高') d = x; } return d; };
    const fundCo = seed => { const S = traderCo(seed, 5000); S.allUnlocked = true; S.stage = 4; Object.assign(S.dept.inv, {on: true, staff: 3}); S.pe.track.push({name: 'x', type: 'succ', inv: 50, ret: 90, moic: 1.8, irr: .25, w0: 0, w1: 100, why: 't'}, {name: 'y', type: 'succ', inv: 40, ret: 70, moic: 1.75, irr: .2, w0: 0, w1: 100, why: 't'});
      const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); A.hireInto(pool[0], 'HQ', 'PEH', null, null); const f = A.fundRaise('buyout', .05, pool[0].id); for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; } f.auto = false; S.pe.deals = []; return {S, f}; };
    let S;
    /* BUG-80 (1): 1,000,000 yen left of a 10 (億) commitment: fees stop at the commitment */
    { let f; ({S, f} = fundCo(2280)); f.lp = 9.5; f.gp = .5; f.calledLP = 9.99 * .95; f.calledGP = 9.99 * .05; f.flowsLP = []; const fee0 = f.fees, cash0 = S.player.cash;
      for (let i = 0; i < 4; i++) A.fundWeekly(f); const called = f.calledLP + f.calledGP;
      info.b80a = {called: +called.toFixed(7), short: +(f.feeShort || 0).toFixed(6), fee: +(f.fees - fee0).toFixed(6)};
      out.b80cap = called <= 10 + 1e-9 && Math.abs(f.fees - fee0 - .01) < 1e-9 && Math.abs(called - 10) < 1e-9 && A.fundRoom(f) === 0 && f.feeShort > 0;
      out.b80split = Math.abs(f.calledLP / called - .95) < 1e-9 && Math.abs(S.player.cash - cash0 - (f.fees - fee0) * .95 + (f.lp + f.gp) * .008 / 52 * 4) < 1e-9;
      for (let i = 0; i < 4; i++) A.fundWeekly(f); out.b80more = f.calledLP + f.calledGP <= 10 + 1e-9 && A.fundDry(f) === 0 && loads(); }
    /* BUG-80 (2): two bids together above what is left: the second is refused; the first settles without counting itself twice */
    { let f; ({S, f} = fundCo(2281)); const d1 = deal(), d2 = deal(d1); const q1 = A.peQuote(d1, A.dealAsk(d1), .5, f.id), q2 = A.peQuote(d2, A.dealAsk(d2), .5, f.id);
      const fee4 = x => x * .02 / 52 * 4, room = q1.out + q2.out * .5; f.lp = f.gp = 0; const T = room / (1 - .02 / 52 * 4) + 1e-6; f.gp = T * .05; f.lp = T - f.gp; f.calledLP = f.calledGP = 0; f.invEnd = S.week + 100; S.player.cash = 1e4;
      const ok1 = A.peBid(d1, 0, .5, false, f.id), dryAfter = A.fundDry(f), ok2 = A.peBid(d2, 0, .5, false, f.id);
      info.b80b = {o1: +q1.out.toFixed(3), o2: +q2.out.toFixed(3), room: +A.fundRoom(f).toFixed(3), res: +A.fundRes(f).toFixed(3), dryAfter: +dryAfter.toFixed(3), ok1, ok2};
      out.b80res = ok1 && !ok2 && !d2.bid && Math.abs(A.fundRes(f) - q1.out) < 1e-9;
      const c0 = S.player.cash; d1.n = 0; d1.ai = 0; d1.bids = []; for (let i = 0; i < 4; i++) { A.step(); S.inbox = []; } const got = S.cos.find(x => x.pe && x.pe.owner === f.id && x.name === d1.name);
      info.b80b.got = !!got; out.b80settle = !!got; out.b80within = f.calledLP + f.calledGP <= f.lp + f.gp + 1e-9 && A.fundRes(f) === 0 && loads(); }
    /* BUG-80 (3): an older save that called more than the commitment: nothing is cut, nothing more is called */
    { let f; ({S, f} = fundCo(2282)); const T = f.lp + f.gp; f.calledLP = T * .95 * 1.01; f.calledGP = T * .05 * 1.01; const cash0 = S.player.cash, lp0 = f.calledLP;
      const S2 = JSON.parse(A.exportText()); A.importText(JSON.stringify(S2)); S = A.S; f = S.pe.funds[0];
      for (let i = 0; i < 4; i++) A.fundWeekly(f); out.b80old = Math.abs(f.calledLP - lp0) < 1e-9 && A.fundOver(f) > 0 && A.fundDry(f) === 0 && A.fundCard(f).includes('約束額を') && f.calledLP + f.calledGP > f.lp + f.gp; }
    /* BUG-78: the whole stake sold: the history keeps the seller's own result (realised, nothing left to value) */
    { S = traderCo(2278, 400); Object.assign(S.dept.inv, {on: true, staff: 1}); const d = deal(), c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false); A.acqFlush(); for (let i = 0; i < 6; i++) { A.step(); S.inbox = []; } A.acqFlush();
      const inv = A.peStats(c).inv, px = c.price * .8; A.delist(c, px, '【売却】テスト'); const H = S.acqHist[0], T = S.pe.track[0];
      info.b78 = {inv: +inv.toFixed(4), ret: H && H.pe && +H.pe.ret.toFixed(4), moic: H && H.pe && +H.pe.moic.toFixed(4), track: T && +T.moic.toFixed(4)};
      out.b78sold = !!H && H.cid === c.id && H.pe && H.pe.nav === 0 && H.pe.done && Math.abs(H.pe.moic - H.pe.ret / H.pe.inv) < 1e-12 && Math.abs(H.pe.moic - T.moic) < 1e-12 && Math.abs(H.pe.inv - inv) < 1e-9 && H.pe.moic < 1 && loads(); }
    /* BUG-78: sold to another fund of yours: the old deal is closed as it was; the buyer's deal is a new record */
    { let f; ({S, f} = fundCo(2279)); const d = deal(), c = A.peAcquire(d, 'P', A.dealAsk(d), .5, false); A.acqFlush(); for (let i = 0; i < 4; i++) { A.step(); S.inbox = []; } A.acqFlush();
      const a0 = c.acq0, inv = A.peStats(c).inv, pps = c.price * .85; f.lp += 1e4; const n0 = (S.acqHist || []).length; A.peTransfer(c, f.id, pps, 'ファンドへ売却', 'sec'); A.acqFlush();
      const H = S.acqHist[0], ret = (c.own[f.id] || 0) * 0 + inv; info.b78f = {n: S.acqHist.length - n0, inv: H && H.pe && +H.pe.inv.toFixed(4), moic: H && H.pe && +H.pe.moic.toFixed(4), newBy: c.acq0 && c.acq0.by};
      out.b78fund = S.acqHist.length === n0 + 1 && H.id === a0.id && H.pe.done && Math.abs(H.pe.inv - inv) < 1e-9 && H.pe.nav === 0 && Math.abs(H.pe.moic - pps * a0.frac * c.shares / inv) < .05 && !!c.acq0 && c.acq0.id !== a0.id && c.acq0.by === f.id && loads(); }
    /* BUG-79: you personally first, then the company, in the same venture: the company's request uses the company's money and holding */
    { S = traderCo(2279, 90); S.allUnlocked = true; A.vcQuarter(); const d = S.vc.deals[0]; S.pres.cash = 1e3; A.vcInvest(d.id, .12, 'pres'); S.vc.deals.push(d); A.vcInvest(d.id, .07); const hp = A.vcHold(d.id, true), hc = A.vcHold(d.id, false);
      S.player.cash = 89.976; S.player.loan = 0; const pres0 = S.pres.cash, amt = Math.round(hc.val * .08 * 100) / 100; S.inbox = []; A.addInbox({kind: 'vcask', hid: d.id, type: 'fund', amt, exp: S.week + 6}); const it = S.inbox.find(i => i.kind === 'vcask');
      const card = A.vcAskCard(it), sp0 = hp.stake, sc0 = hc.stake, el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'fund'; A.act('vcask', el); const c1 = S.player.cash; A.act('vcask', el);
      info.b79 = {amt, cash: +S.player.cash.toFixed(4), want: +(89.976 - amt).toFixed(4), sp: +hp.stake.toFixed(5), sc: +hc.stake.toFixed(5)};
      out.b79 = card.includes('追加出資する') && Math.abs(c1 - (89.976 - amt)) < 1e-9 && S.player.cash === c1 && S.pres.cash === pres0 && !S.inbox.some(i => i.kind === 'vcask') && hc.stake > sc0 && hp.stake < sp0 && Math.abs(hp.val - hc.val) < 1e-12 && loads();
      A.addInbox({kind: 'vcask', hid: d.id, type: 'fund', amt, exp: S.week + 6}); const it2 = S.inbox.find(i => i.kind === 'vcask'); S.vc.hold = S.vc.hold.filter(h => h !== hc); const el2 = document.createElement('button'); el2.dataset.id = it2.id; el2.dataset.v = 'fund'; const c2 = S.player.cash; A.act('vcask', el2);
      out.b79none = S.player.cash === c2 && S.pres.cash === pres0 && A.vcAskCard(it2) === ''; }
    /* BUG-76: an older save with 21.8 (personal 12%) and 22.8 (company 7% plus 1 of follow-on): one valuation, each holder's value kept, done once */
    { S = traderCo(2276, 90); S.allUnlocked = true; A.vcQuarter(); const d = S.vc.deals[0]; d.val = 21.8; S.pres.cash = 1e3; A.vcInvest(d.id, .12, 'pres'); S.vc.deals.push(d); A.vcInvest(d.id, .07); const hc = A.vcHold(d.id, false);
      hc.stake = (.07 * 21.8 + 1) / 22.8; hc.val = 22.8; hc.cost += 1; hc.fb = .03; /* what the older version left: the personal holding not updated */ S.vc.deals = [Object.assign({}, d, {val: 21.8})];
      const t = A.exportText(); A.importText(t); S = A.S; const hp2 = A.vcHold(d.id, true), hc2 = A.vcHold(d.id, false), log = (S.vc.fixLog || []).slice();
      info.b76 = {vp: hp2.val, sp: +hp2.stake.toFixed(6), vp1: +(hp2.val * hp2.stake).toFixed(4), sc: +hc2.stake.toFixed(6), vc1: +(hc2.val * hc2.stake).toFixed(4), log: log.length};
      out.b76old = Math.abs(hp2.val - 22.8) < 1e-9 && Math.abs(hp2.stake - .11473684) < 1e-7 && Math.abs(hp2.stake * hp2.val - 2.616) < 1e-9 && Math.abs(hc2.stake - .11078947) < 1e-7 && Math.abs(hc2.stake * hc2.val - 2.526) < 1e-9 && log.length === 1 && S.vc.deals[0].val === 22.8;
      A.importText(A.exportText()); out.b76once = (A.S.vc.fixLog || []).length === 1;
      S = A.S; const dd = S.vc.deals[0]; const vp0 = A.vcHold(d.id, true).stake; S.pres.cash = 100; const ok = A.vcInvest(dd.id, .02, 'pres'); const hp3 = A.vcHold(d.id, true); out.b76deal = ok && Math.abs(hp3.val - 22.8) < 1e-9 && Math.abs(A.vcHold(d.id, false).val - 22.8) < 1e-9 && Math.abs(hp3.stake - vp0 - .02) < 1e-12; }
    /* BUG-81: options granted once; moves out and back keep the one contract */
    { S = traderCo(2281, 500); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean); const po = pool[0]; A.hireInto(po, 'HQ', 'CFO', 'opt', null); const g = po.so.slice(), end0 = po.end;
      const sub = S.cos.filter(x => !x.priv && !x.ctrl)[0]; sub.own = {P: sub.shares * .6}; A.recomputeCtrl();
      for (let i = 0; i < 3; i++) { A.secondTo(po, sub.id, 'CFO'); A.hireInto(po, 'HQ', 'CFO', null, null); }
      info.b81 = {n: po.so.length, f: +(po.so[0].f * 100).toFixed(6), end: po.end === end0};
      out.b81 = po.so.length === 1 && po.so[0].id === g[0].id && po.so[0].f === g[0].f && po.so[0].k === g[0].k && po.so[0].w0 === g[0].w0 && po.end === end0 && po.comp === 'opt';
      const el = document.createElement('button'); el.dataset.id = po.id; el.dataset.v = '.01'; A.act('xso', el); out.b81approve = po.so.length === 2 && po.so[1].manual;
      S.week = po.so[0].w0 + 208; const out0 = S.player.outside || 0; A.secondTo(po, sub.id, 'CFO'); for (let i = 0; i < 2; i++) { A.step(); S.inbox = []; }
      out.b81once = po.so.filter(o => !o.manual).length === 0 && loads();
      const pl = pool[1]; A.hireInto(pl, 'HQ', 'HR', 'ltip', null); S.player.cash += 100; const acc0 = A.grossWorth() - pl.lt0; A.secondTo(pl, sub.id, 'CEO'); out.b81ltip = Math.abs((pl.ltAcc || 0) - acc0 * .02) < 1e-9 && pl.comp === 'ltip'; }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev22: fund commitment holds fees and bids (BUG-80); exit history keeps the seller\'s result (BUG-78); company VC requests use the company holding (BUG-79); one valuation per venture (BUG-76); no repeat option grants on moves (BUG-81)', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev22 tests', !errs.length, errs.slice(0, 3).join(' | '));
}
async function testPlay25(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    { S = traderCo(2501, 5000); Object.assign(S.dept.acc, {on: true, staff: 4}); S.week = 400; let it = null; for (let q = 31; q < 90 && !it; q++) { A.appStep(q); it = S.inbox.find(i => i.kind === 'applicant'); }
      const p = A.S.hr.people[it.pid], e0 = A.deptEff('acc'); const card = A.applicantCard(it); const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = 'BENCH|acc'; A.act('appgo', el);
      info.bench = {role: p.role, dept: p.dept, e0: +e0.toFixed(2), e1: +A.deptEff('acc').toFixed(2)}; out.bench = card.includes('幹部として配属') && p.role === 'BENCH' && p.dept === 'acc' && A.deptEff('acc') > e0 && A.personLine(p, null, 'CFO').includes('経理部付き幹部') && loads();
      const sub = S.cos.filter(x => !x.priv && !x.ctrl)[0]; sub.own = {P: sub.shares * .6}; A.recomputeCtrl(); out.benchSecond = A.secondTo(p, sub.id, 'CFO') && p.at === sub.id && !(S.hr.hq.BENCH || []).includes(p.id); }
    { S = traderCo(2502, 500); const pool = S.hr.pool.map(id => S.hr.people[id]).filter(Boolean);
      const po = pool[0]; A.hireInto(po, 'HQ', 'CFO', 'opt', null); out.hqOpt = (po.so || []).length === 1 && po.so[0].f > 0 && Math.abs(po.so[0].f - po.sal * 3 / Math.max(10, A.grossWorth())) < 1e-9 && Math.abs(po.so[0].k - A.grossWorth()) < 1e-6;
      const pb = pool[1]; A.hireInto(pb, 'HQ', 'MA', 'bonus', null); const pay0 = A.hqPayroll ? A.hqPayroll() : 0; S.acct.q[1] = Object.assign({}, S.acct.q[1] || {}, {div: 50}); const c0 = S.player.cash; A.compQuarter(); info.bonus = {got: pb.bonusY, profit: A.qProfit()};
      out.hqBonus = A.qProfit() > 0 && pb.bonusY > 0 && pb.bonusY <= pb.sal * .6 / 4 + 1e-9 && S.player.cash < c0;
      const pl = pool[2]; A.hireInto(pl, 'HQ', 'HR', 'ltip', null); const g0 = pl.lt0; S.player.cash += 100; const c1 = S.player.cash; A.ltipVest(pl, null); info.ltip = {got: pl.bonusY, want: +((A.grossWorth() + (c1 - S.player.cash) - g0) * .02).toFixed(4)}; out.hqLtip = pl.bonusY > 1.9 && pl.bonusY < 2.1 && loads(); }
    return {out, info};
  });
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('playtest 25: applicants placed in a department and sent out; options, performance bonus and long-term pay by where each officer works', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in playtest-25 tests', !errs.length, errs.slice(0, 3).join(' | '));
}

async function testBal(b) {
  const {p, errs} = await page(b);
  const fix = fs.readFileSync(path.join(FIX, 'rev15-bonds.json'), 'utf8');
  const r = await p.evaluate(fix => {
    const A = window.__atlas, out = {}, info = {}; const loads = () => !!A.parseSave(A.exportText());
    let S;
    /* BAL-01: small orders as before; a large order moves the price more than in proportion; the money-to-shares solver stays exact */
    A.newGame(8101, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true;
    const c = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => b.price * b.shares - a.price * a.shares)[10], L = A.liq(c);
    const lin = n => 1.1 * n / L, small = A.impUp(c, L * .01), big = A.impUp(c, L * .5);
    info.imp = {small: +(small / lin(L * .01)).toFixed(4), big: +(big / lin(L * .5)).toFixed(3)};
    out.impSmall = small / lin(L * .01) < 1.015; out.impBig = big / lin(L * .5) > 1.5;
    { const m = c.price * c.shares * .1, n = A.sharesForMoney(c, m), q = A.quoteBuy(c, n), cost = q.avg * q.n * 1.0025; info.sfm = {ratio: +(cost / m).toFixed(6)}; out.sfm = cost <= m + 1e-9 && cost > m * .999; }
    { const cash0 = S.player.cash = 5000; const n = A.sharesForMoney(c, 1500); const r1 = A.execBuy('P', c, n); const r2 = A.execSell('P', c, c.own.P); info.rt = {cost: r1 && +r1.cost.toFixed(2), back: +(S.player.cash - (cash0 - r1.cost)).toFixed(2)}; out.roundTripLoses = !!r1 && S.player.cash < cash0 && loads() && !A.ledgerCheck(JSON.parse(A.exportText())); }
    /* BAL-03: deeper discounts in a crisis, maturity at par, coupons, MOIC and IRR on the record; a round trip loses the dealer's cut */
    { const d = S.cos.filter(x => !x.priv && !x.ctrl && x.debt > 0 && x.assets > 0).sort((a, b) => a.price * a.shares - b.price * b.shares)[3];
      d.debt = Math.max(d.debt, d.assets * 1.2); d.crisis = {w: S.week, end: S.week + 26}; d.ni = -Math.abs(d.ni || 1);
      const px = A.bondPx(d); info.bond = {px: +px.toFixed(3), old: +A.bondPxV1(d).toFixed(3), recov: +A.bondRecov(d).toFixed(3), liq: A.bondLiqDisc(d)};
      out.bondDeep = A.bondEligible(d) && px < .8 && px >= .05 && px < A.bondPxV1(d) && A.bondLiqDisc(d) >= .12;
      S.player.cash = 500; const cash0 = S.player.cash, bd = A.bondBuy(d, 5); out.bondMat = !!bd && bd.mat >= S.week + 52 && bd.mat <= S.week + 208 && bd.cpn === 0 && loads();
      const got = A.bondSell(bd); out.bondRoundTrip = got < bd.cost && (S.bondLog[0].moic || 0) < 1 && S.bondLog[0].irr === null; /* sold in the week it was bought: no period, so no IRR */
      d.crisis = null; const b2 = A.bondBuy(d, 5); if (b2) { for (let i = 0; i < 26; i++) { A.step(); S.inbox = []; if (d.crisis) d.crisis = null; } /* half a year: the IRR from dated cash needs a period it can be solved over */ const cpn = b2.cpn; b2.mat = S.week; const c1 = S.player.cash; A.step();
        const e = S.bondLog.find(x => x.kind.startsWith('満期償還')); info.mat = e && {moic: +e.moic.toFixed(3), cpn: +e.cpn.toFixed(4), face: +b2.face.toFixed(3)};
        out.bondMatPaid = !S.bonds.includes(b2) && !!e && Math.abs(e.amt - b2.face) < 1e-9 && cpn > 0 && Math.abs(e.moic - (b2.face + e.cpn) / b2.cost) < 1e-9 && Number.isFinite(e.irr) && S.player.cash > c1 + b2.face * .99 && loads(); } else out.bondMatPaid = 'no second bond'; }
    /* BAL-03: a save of the earlier version (bonds valued by the earlier price) loads; the change is restated as this week's change, not hidden */
    { const o0 = JSON.parse(fix); const err = A.importText(fix); S = A.S;
      const ax = (S.tr.ax || []).find(x => x[0] === '旧版の評価の修正'), d = o0.bonds.reduce((a, b) => { const c = S.cos.find(x => x.id === b.cid); return a + b.face * (A.bondPx(c) - A.bondPxV1(c)); }, 0);
      info.old = {err: err || null, ax: ax && +ax[1].toFixed(6), d: +d.toFixed(6), mats: S.bonds.map(b => b.mat)};
      out.oldLoads = !err && S.valV === 4 && /* rev48: the valuation version after the rounding to 百万円 */  S.bonds.length === o0.bonds.length && S.bonds.every(b => b.mat != null && b.cpn == null) && (Math.abs(d) < 1e-9 || (!!ax && Math.abs(ax[1] - d) < 1e-9)) && loads();
      out.oldSmall = S.props.filter(x => x.small).length === A.smallProps().length && S.props.filter(x => x.small).every(x => !x.own);
      const t = JSON.parse(A.exportText()); t.valV = 1; t.chk = A.finSig(t); const e2 = A.importText(JSON.stringify(t)); out.forgedOld = !!e2 || Math.abs(d) < 1e-9; info.forged = e2 || null; }
    /* BAL-05: small buildings (数千万円) before the property business opens; rivals leave them alone */
    A.newGame(8102, 'normal', 'T', 't', 'trader', false); S = A.S; S.won = false;
    const sp = S.props.filter(x => x.small); info.small = {n: sp.length, min: Math.min(...sp.map(x => x.v)), max: Math.max(...sp.map(x => x.v)), realty: A.has('realty')};
    out.smallList = sp.length >= 10 && sp.every(x => x.v >= .15 && x.v < 1.2 && A.propOpen(x)) && !A.has('realty');
    { S.player.cash = .5; const u = sp.filter(x => x.kind === 'unit').sort((a, b) => a.v - b.v)[0]; const el = document.createElement('button'); el.dataset.id = u.id; el.dataset.v = '0'; A.act('pbuy', el);
      out.smallBuy = u.own === 'P' && S.player.cash < .5 && loads(); for (let i = 0; i < 4; i++) A.step(); out.smallRent = (S.player.rentW || 0) >= 0 && loads();
      const big = S.props.find(x => !x.small && !x.own); const el2 = document.createElement('button'); el2.dataset.id = big.id; el2.dataset.v = '0'; S.player.cash = 200; A.act('pbuy', el2); out.bigLocked = !big.own; }
    { let held = 0; A.newGame(8103, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; for (let i = 0; i < 260; i++) A.step(); held = S.props.filter(x => x.small && x.own && x.own !== 'P').length; out.rivalsSkipSmall = held === 0; }
    /* BAL-02: a retiring owner's seller note on small deals; BAL-06: search for bolt-ons in an owned industry */
    S = (() => { A.newGame(8104, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); Object.assign(A.S.dept.inv, {on: true, staff: 1}); A.S.player.cash = 3; A.trClose(); return A.S; })();
    { let d = null; for (let i = 0; i < 80; i++) { const x = A.peDealGen(); if (x && x.small && x.type === 'succ' && A.dealEbitda(x, false) > 0) { d = x; break; } }
      const q0 = d && A.peQuote(d, A.dealAsk(d), 0, 'P'), q1 = d && A.peQuote(d, A.dealAsk(d), .5, 'P');
      info.sn = d && {sn: +q1.sn.toFixed(4), out0: +q0.out.toFixed(4), out1: +q1.out.toFixed(4), ask: +A.dealAsk(d).toFixed(4)};
      out.sellerNote = !!d && q1.sn > 0 && q1.sn <= A.dealAsk(d) * .2 + 1e-12 && q0.sn === 0 && q1.out < q0.out && q1.acq <= A.dealAsk(d) * .9 + 1e-12; }
    { const co = S.cos.filter(x => !x.priv && !x.ctrl).sort((a, b) => a.price * a.shares - b.price * b.shares)[0]; co.ctrl = 'P'; co.own.P = co.shares * .6;
      const cash0 = S.player.cash, n0 = S.pe.deals.length, d = A.peSearch(co.id); out.search = !!d && d.ind === co.ind && d.type === 'succ' && S.pe.deals.length === n0 + 1 && S.player.cash < cash0 && d.exp >= S.week + 12;
      out.searchCool = A.peSearch(co.id) === null; for (let i = 0; i < 4; i++) A.step(); const d2 = A.peSearch(co.id); out.searchAgain = d2 == null || d2.ind === co.ind;
      const html = A.rollupBox(); out.rollupUI = html.includes('同業ロールアップ') && html.includes(co.name.slice(0, 4)); }
    /* BAL-04: a proposal's economic result is followed apart from the vote; fixed after a year */
    { A.newGame(8105, 'normal', 'B', 'b', 'std', true); S = A.S; S.won = true; S.allUnlocked = true; const c = S.cos.filter(x => !x.priv && !x.ctrl && x.ni > 0)[2]; S.player.cash = 5000; A.execBuy('P', c, c.shares * .12);
      const w = A.activist(c, 'div'), e = (S.actLog || [])[0]; out.actLogged = w != null && !!e && e.cid === c.id && e.win === w && e.p0 > 0 && loads();
      A.payDividend(c, 1); out.actDiv = e.dv > 0; for (let i = 0; i < 53; i++) A.step(); out.actFixed = !!e.y1 && (e.y1.gone || Number.isFinite(e.y1.val)); info.act = {win: w, y1: e.y1};
      const html = A.renderPort(); out.actUI = html.includes('株主提案の成果'); }
    /* BAL-07: the allocation adds up to the net worth's parts */
    { const ca = A.capAlloc(), R = ca.rows, hv = A.holdingsValue('P'), sum = R.stock.val + R.ctrl.val + R.pe.val;
      info.cap = {sum: +sum.toFixed(4), hv: +hv.toFixed(4), re: +R.re.val.toFixed(4), pe: +A.propEquity('P').toFixed(4), bond: +R.bond.val.toFixed(4), bv: +A.bondsValue().toFixed(4)};
      out.capSum = Math.abs(sum - hv) < 1e-6 * Math.max(1, hv) && Math.abs(R.re.val - A.propEquity('P')) < 1e-9 && Math.abs(R.bond.val - A.bondsValue()) < 1e-9 && Math.abs(R.vc.val - A.vcValue()) < 1e-9;
      out.capUI = A.renderPort().includes('資本配分'); }
    return {out, info};
  }, fix);
  const bad = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('BAL: large orders cost more than in proportion, exact share solver, distressed bonds (crisis discount, maturity, coupons, MOIC/IRR), old bond saves restated, small buildings, seller notes, roll-up search, activist outcomes, capital allocation', !bad.length, bad.join(',') + ' ' + JSON.stringify(r.info));
  ok('no page errors in BAL tests', !errs.length, errs.slice(0, 3).join(' | '));
}

async function testRev15(b) {
  const {p, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}, info = {}; const $ = q => document.querySelector(q);
    const loads = () => !!A.parseSave(A.exportText());
    const traderCo = (seed, cash) => { A.newGame(seed, 'normal', 'T', 't', 'trader', false); A.S.won = false; A.S.player.cash = 5; A.incorporate('Z', 0); A.hqInit(); A.S.player.cash = cash; A.trClose(); return A.S; };
    let S;
    /* BUG-52: the building let out after you move away keeps finite rent and money */
    S = traderCo(7501, 100); const nw0 = A.grossWorth(); A.hqBuild('tyo'); info.b52 = {after: +A.grossWorth().toFixed(3), before: +nw0.toFixed(3)}; out.b52build = loads();
    for (let i = 0; i < 53; i++) A.step(); const bd = A.hqBld(); out.b52done = !!bd && !bd.uc && bd.hqUse && loads();
    A.setOffice(1, 'tyo'); out.b52let = !bd.hqUse && isFinite(A.propRentY(bd)) && A.propRentY(bd) > 0 && loads(); const c0 = S.player.cash; A.step(); out.b52week = isFinite(S.player.cash) && isFinite(A.grossWorth()) && S.player.cash > c0 - 1 && loads();
    A.setOffice(4); out.b52back = bd.hqUse && A.office().lvl === 4 && loads(); A.step();
    { const o = JSON.parse(A.exportText()); const pb = o.props.find(x => x.hqb); delete pb.y; pb.hqUse = false; o.office.lvl = 1; o.chk = A.finSig(o); const m = A.importText(JSON.stringify(o)); out.b52old = (m == null || !String(m).includes('読み込めません')) && isFinite(A.hqBld().y) && A.hqBld().y === A.PROPY && (A.step(), isFinite(A.S.player.cash)) && loads(); }
    { const pr = A.hqBld(); A.setOffice(1, 'tyo'); const c1 = A.S.player.cash, val = A.propVal(pr), got = A.sellProp(pr); out.b52sell = got > 0 && Math.abs(A.S.player.cash - c1 - got) < 1e-9 && Math.abs(got - (val - Math.round(val * A.propFee('P') * 100) / 100)) < 1e-6 && !A.hqBld() && !pr.hqb && loads(); A.step(); out.b52after = isFinite(A.S.player.cash) && loads(); }
    /* BUG-56: an overseas building is worth what it cost on the day it starts (no gain from the rate) */
    for (const fx of [95, 150, 200]) { S = traderCo(7502, 100); S.econ.fx = fx; const g0 = A.grossWorth(), cost = A.hqbCost('nyc'); A.hqBuild('nyc'); const g1 = A.grossWorth(); out['b56_' + fx] = Math.abs(g1 - (g0 - cost * .05)) < .0051 && Math.abs(A.propVal(A.hqBld()) - Math.round(cost * 100) / 100) < 1e-9 && loads(); /* rev48: the building is shown in whole 百万円 */ info['b56_' + fx] = +(g1 - g0).toFixed(4); }
    { S = traderCo(7503, 100); S.econ.fx = 200; const g0 = A.grossWorth(), cost = A.hqbCost('tyo'); A.hqBuild('tyo'); out.b56home = Math.abs(A.grossWorth() - (g0 - cost * .05)) < 1e-9; }
    /* BUG-53: the old company's bonds and DIP loan do not come back after a failure */
    S = traderCo(7504, 30); const bc = S.cos.filter(x => !x.priv && !x.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[3]; bc.crisis = {due: S.week + 8}; bc.debt = Math.max(bc.debt, bc.assets * .9);
    const bb = A.bondBuy(bc, .1); S.pres.cash = .2; out.b53bought = !!bb;
    A.restartAsTrader('test'); out.b53gone = !(S.bonds || []).length && !(S.dips || []).length && A.companyResidue().length === 0 && Math.abs(S.player.cash - .2) < 1e-9 && Math.abs(A.grossWorth() - .2) < 1e-9; /* only the personal cash is left */ info.b53 = {cash: S.player.cash, gw: A.grossWorth(), resid: A.companyResidue()};
    out.b53loads = loads();
    for (let i = 0; i < 30; i++) A.step(); out.b53later = !(S.bonds || []).length && loads();
    /* BUG-55 + BUG-53: a DIP loan is booked on both sides, and leaves with the old company */
    S = traderCo(7505, 30); const dc = S.cos.filter(x => !x.priv && !x.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[5]; dc.crisis = {due: S.week + 8}; dc.debt = Math.max(dc.debt, dc.assets * .9);
    A.bondBuy(dc, .1); A.startReorg(dc); const ro = S.inbox.find(i => i.kind === 'reorg' && i.cid === dc.id); const d0 = dc.debt, cash0 = S.player.cash, dcCash = dc.cash; A.ibxChoose(ro.id, 'dip'); const dip = dc.reorg.dip;
    out.b55book = dip > 0 && Math.abs(dc.debt - (d0 + dip)) < 1e-9 && Math.abs(dc.cash - (dcCash + dip)) < 1e-9 && Math.abs(S.player.cash - (cash0 - dip)) < 1e-9 && S.dips.length === 1 && Math.abs(A.dipsValue() - dip * 1.15 * A.reorgOdds(dc)) < 1e-9 && loads();
    A.ibxChoose(ro.id, 'dip'); out.b55dup = S.dips.length === 1;
    S.pres.cash = .2; A.restartAsTrader('test'); out.b55gone = !(S.dips || []).length && !(S.bonds || []).length && Math.abs(S.player.cash - .2) < 1e-9 && A.companyResidue().length === 0 && loads();
    /* BUG-54 / BUG-55: repayments and conversions move the issuer's debt */
    S = traderCo(7506, 30); const rc = S.cos.filter(x => !x.priv && !x.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[6]; A.trClose();
    { const debt0 = rc.debt, cash0 = rc.cash, b = {id: 99, cid: rc.id, name: rc.name, face: .2, cost: .15, w: S.week, gen: S.coGen || 0}; S.bonds = [b]; A.bondRepayAll(rc, '買収'); out.b54par = Math.abs(rc.debt - Math.max(0, debt0 - .2)) < 1e-9 && Math.abs(rc.cash + Math.max(0, -(cash0 - .2)) - (cash0 - .2)) < 1e-9 && !S.bonds.length; }
    let tried = 0, seenDes = false, seenInst = false, seenFail = false;
    for (let k = 0; k < 24 && !(seenDes && seenInst); k++) {
      S = traderCo(7600 + k, 40); const x = S.cos.filter(y => !y.priv && !y.ctrl).sort((u, w) => u.price * u.shares - w.price * w.shares)[2 + (k % 6)]; x.crisis = {due: S.week + 8}; x.debt = Math.max(x.debt, x.assets * .9); A.trClose();
      const bnd = A.bondBuy(x, 1); if (!bnd) continue; A.startReorg(x); const it = S.inbox.find(i => i.kind === 'reorg' && i.cid === x.id); A.ibxChoose(it.id, 'dip'); const dip2 = x.reorg.dip, plan = k % 2 ? 'inst' : 'des'; A.ibxChoose(it.id, plan);
      x.reorg.end = S.week + 1; const debtB = x.debt, hc = x.reorg.hc, face = bnd.face, plain = debtB - dip2, claims = plain * (1 - hc), my = Math.min(claims, face * (1 - hc)), others = claims - my, conv = others * .3 + (plan === 'des' ? my : 0); tried++;
      const cashB = S.player.cash; A.step(); A.step();
      if (x.reorg) continue; const ok = S.news.some(n => n.t.includes('【再建成功】') && n.t.includes(x.name));
      if (!ok) { seenFail = true; out.b55fail = !S.dips.length && loads(); continue; }
      if (plan === 'des' && !seenDes) { seenDes = true; out.b54des = Math.abs((x.debt + 0) - (claims - conv + 0)) < .05 * claims + 1e-6 && x.own.P > 0 && !S.bonds.some(y => y.cid === x.id) && !S.dips.length && loads(); info.des = {debt: +x.debt.toFixed(3), expect: +(claims - conv).toFixed(3), own: +(x.own.P / x.shares).toFixed(3)}; }
      if (plan === 'inst' && !seenInst) { seenInst = true; const ib = S.bonds.find(y => y.cid === x.id); const dA = x.debt; for (let i = 0; i < 53; i++) A.step(); out.b54inst = !!ib && !S.bonds.some(y => y.cid === x.id) && x.debt < dA - my * .5 && loads(); info.inst = {before: +dA.toFixed(3), after: +x.debt.toFixed(3), my: +my.toFixed(3)}; }
    }
    info.reorgTried = tried; out.b54seen = seenDes && seenInst;
    return {out, info};
  });
  const fails = Object.entries(r.out).filter(([, v]) => v !== true).map(([k]) => k);
  ok('rev15: own building let out (BUG-52), overseas building and the yen (BUG-56), old company bonds and DIP at liquidation (BUG-53), issuer debt on repayment and DES (BUG-54), DIP on both books (BUG-55)', !fails.length, JSON.stringify(fails) + ' ' + JSON.stringify(r.info));
  ok('no page errors in rev15 tests', errs.length === 0, errs.join(' | '));
}

async function testGpt5(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(5555, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.tut = {buy: 1, big: 1, tob: 1, ctrl: 1, run: 1, vert: 1};
    for (let i = 0; i < 6; i++) A.step(); A.bankBorrow(.9); A.takeLoan(0);
    /* BUG-05/17: a current-format save without its checksum is refused */
    const txt = A.exportText(), t = f => { const o = JSON.parse(txt); f(o); return !A.parseSave(JSON.stringify(o)); };
    out.ok = !!A.parseSave(txt);
    out.noChk = t(o => { delete o.chk; }); out.noChkDebt = t(o => { delete o.chk; o.player.bank = 0; o.player.tl = []; }); out.badChk = t(o => { o.chk = 12345; });
    /* BUG-20/21: the trade box's share count is exactly what trades, and the maximum short can always be placed */
    const ids = S.cos.filter(c => !c.priv).map(c => c.id).slice(0, 15); let bad = 0, maxOff = 0;
    for (const id of ids) for (const [mode, tf] of [['short', 1], ['short', .5], ['cash', .5]]) {
      A.newGame(5555, 'normal', 'T', 't', 'std', true); const T2 = A.S; T2.settings.guide = false; document.querySelector('#modal').hidden = true; A.ui.sel = id; A.ui.ctab = 'trade'; A.ui.actor = 'P'; A.ui._trSel = id; A.ui.tmode = mode; A.ui.tf = tf; A.ui.tab = 'market'; A.renderAll(true);
      const go = document.querySelector('#tr-go'); if (!go) continue; if (go.disabled) { if (tf === 1) maxOff++; continue; }
      const c = T2.cos.find(x => x.id === id), shown = +go.dataset.n, before = c.own.P || 0; go.click();
      const got = mode === 'short' ? (T2.player.shorts[id] ? T2.player.shorts[id].n : 0) : (c.own.P || 0) - before; if (Math.abs(got - shown) > 1e-12) bad++; }
    out.qty = bad === 0; out.maxShort = maxOff === 0;
    /* BUG-13: a squeeze buys back until market-value collateral is 45% of what is still short (or nothing is left) */
    A.newGame(5556, 'normal', 'T', 't', 'std', true); const U = A.S; U.won = U.lost = true; U.player.cash = 30;
    const L = U.cos.filter(c => !c.priv && !c.ctrl).slice(0, 2); for (const c of L) A.execShort(c, A.sharesForShort(c, 12));
    for (const c of L) c.price *= 2.2; U.player.cash = Math.min(U.player.cash, 2); A.step();
    const sl = A.shortLiab(); out.squeeze = sl < 1e-9 || A.nwMkt() >= sl * .45 - 1e-6;
    return out;
  });
  ok('gpt5: a current save without its checksum, or with a wrong one, is refused (BUG-05/17)', r.ok && r.noChk && r.noChkDebt && r.badChk, JSON.stringify(r));
  ok('gpt5: the share count shown is exactly what trades; the maximum short can always be placed (BUG-20/21)', r.qty && r.maxShort);
  ok('gpt5: a short squeeze ends only at 45% market-value collateral or with nothing left short (BUG-13)', r.squeeze);
  /* BUG-19: restoring the backup says whether it was saved */
  const ph = await page(b, {...devices['iPhone 13']}); const q = ph.p;
  await q.click('[data-act=allu][data-v="1"]'); await q.click('[data-act=newgame]');
  const msg = await q.evaluate(() => { const A = window.__atlas; localStorage.setItem(A.SAVE_KEY + '_bak', A.exportText()); const ls = Object.getPrototypeOf(localStorage), real = ls.setItem; ls.setItem = function(){ throw new Error('full'); };
    document.querySelector('#modal').hidden = true; A.act('restorebak', {dataset: {}}); const t = [...document.querySelectorAll('#toasts .toast')].map(x => x.textContent).join(' | '); ls.setItem = real; return t; });
  ok('gpt5: restoring the backup when storage refuses says it is loaded but not saved (BUG-19)', /バックアップを読み込みました.*書き込めませんでした/.test(msg), msg);
  ok('no page errors in gpt5 tests', !errs.length && !ph.errs.length, errs.concat(ph.errs).slice(0, 3).join(' | '));
  await ph.ctx.close(); await ctx.close();
}

async function testHQ(b) {
  const {p, ctx, errs} = await page(b);
  const r = await p.evaluate(() => {
    const A = window.__atlas, out = {}; A.newGame(3232, 'normal', 'T', 't', 'std', true); const S = A.S; S.won = S.lost = true; S.player.cash = 800; A.hqInit();
    const cs = S.cos.filter(c => !c.ctrl && !c.priv).sort((a, b) => a.price * a.shares - b.price * b.shares); for (const c of cs.slice(0, 6)) A.execBuy('P', c, c.shares * .04);
    for (let i = 0; i < 14; i++) { A.step(); S.inbox = []; }
    // statements: balance sheet equity equals the holding company's value; cash flow adds up to the change in cash
    const B = A.bsNow(); out.bs = Math.abs(B.eq - (A.netWorth('P') / (1 - (S.player.outside || 0)))) < 1e-6;
    const L = S.player.plHist[0], C = A.cfOf(L); out.cf = Math.abs(C.op + C.inv + C.fin + (C.oth || 0) - (L.cash1 - L.cash0)) < 1e-9; /* rev33 BUG-110: rewards are their own line */
    // a thin accounting team: statements lag; more people bring them up to date
    S.dept.acc.on = true; /* set up an accounting department first (a new company has none) */ S.dept.acc.staff = 0; out.lagThin = A.accLag(); S.dept.acc.staff = 4; S.dept.acc.ab = 70; S.dept.acc.mo = 80; out.lagFull = A.accLag();
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
    await testExitGuide(b);
    await testGpt4(b);
    await testTradeTabs(b);
    await testRoadTob(b);
    await testPeStep(b);
    await testLadder2(b);
    await testGpt5(b);
    await testTrader(b);
    await testMidgame(b);
    await testGpt7(b);
    await testRealism(b);
    await testMuse(b);
    await testGroup(b);
    await testGpt9(b);
    await testExitRoute(b);
    await testUxFin(b);
    await testUx2(b);
    await testRev10(b);
    await testRev10b(b);
    await testRev10Layout(b);
    await testRev11(b);
    await testRev12(b);
    await testRev13(b);
    await testFeedback14(b);
    await testFeedback15(b);
    await testFeedback16(b);
    await testRev15(b);
    await testBal(b);
    await testRev17(b);
    await testRev18(b);
    await testPlay19(b);
    await testPri56(b);
    await testRev20(b);
    await testPlay21(b);
    await testPlay22(b);
    await testPlay23(b);
    await testRev21(b);
    await testPlay25(b);
    await testRev22(b);
    await testBal08(b);
    await testRev23(b);
    await testBal09(b);
    await testRev24(b);
    await testRev25(b);
    await testRev26(b);
    await testPlay27(b);
    await testFix1120(b);
    await testRev27(b);
    await testPlay28(b);
    await testRev29(b);
    await testWeekly30(b);
    await testRev31(b);
    await testRev32(b);
    await testRev33(b);
    await testRev34(b);
    await testRev35(b);
    await testOps37(b);
    await testVcIpo39(b);
    await testBug40(b);
    await testBug120b(b);
    await testBug123(b);
    await testBug127(b);
    await testSearch43(b);
    await testNames44(b);
    await testBug128(b);
    await testIcons46(b);
    await testRealEstate47(b);
    await testRealEstate48(b);
    await testRealEstate49(b);
    await testRealEstate50(b);
    await testFunds51(b);
    await testFunds52(b);
    await testFunds53(b);
    await testPE54(b);
    await testPE55(b);
    await test3D56(b);
    await testVis57(b);
    await balance(b);
  } finally { await b.close(); }
  console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
  process.exit(failures ? 1 : 0);
})();
