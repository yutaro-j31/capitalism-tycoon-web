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
    const t = {}; for (const k in c.own) { const b = k[0] === 'C' ? (S.cos.find(x => x.id === k) || {}).ctrl : k; if (b) t[b] = (t[b] || 0) + c.own[k]; }
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
  return bad;
};

async function page(browser, opt) {
  const ctx = await browser.newContext(opt || {viewport: {width: 1366, height: 900}});
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
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
        out.marginOrder.n++; if (!(m[2] > m[1] && m[1] > m[0])) out.marginOrder.bad++;
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
  // Not every company: with heavy fixed costs, a higher price can lower the margin because lost volume spreads fixed costs thinner (operating leverage).
  ok('price mechanism: operating margin high > standard > low for most companies (≥85%)', r.marginOrder.n > 0 && r.marginOrder.bad <= r.marginOrder.n * .15, `${r.marginOrder.n - r.marginOrder.bad}/${r.marginOrder.n}`);
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
    A.hire(c, 0); c.deleg = 'cash';
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
    await balance(b);
  } finally { await b.close(); }
  console.log(failures ? `\n${failures} test(s) failed` : '\nall tests passed');
  process.exit(failures ? 1 : 0);
})();
