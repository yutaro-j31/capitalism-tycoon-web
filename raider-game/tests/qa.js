/* Independent QA pass (save/backup matrix, cash-only buying on every stock, immediate saves, random-tap fuzzing
   with economic invariants, and save/load determinism). Usage: node raider-game/tests/qa.js [fuzzTaps=600] */
const {chromium, devices} = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html');
const TAPS = +(process.argv[2] || 600);
let fails = 0; const ok = (name, cond, info) => { if (!cond) fails++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

(async () => {
  const b = await chromium.launch();

  /* ---------- A. main / backup matrix (real page reloads) ---------- */
  {
    const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(300);
    const KEY = await p.evaluate(() => window.__atlas.SAVE_KEY);
    const good = await p.evaluate(() => { const A = window.__atlas; A.newGame(777, 'normal', 'QA', 'q', 'std', true); for (let i = 0; i < 30; i++) A.step(); return JSON.stringify(A.S); });
    const good2 = await p.evaluate(() => { const A = window.__atlas; for (let i = 0; i < 10; i++) A.step(); return JSON.stringify(A.S); });
    const broken = (() => { const o = JSON.parse(good); o.cos[0].own = {P: o.cos[0].shares * 2}; return JSON.stringify(o); })(); /* parses, but owns twice the shares that exist */
    const set = async (m, k) => p.evaluate(([KEY, m, k]) => { localStorage.clear(); if (m != null) localStorage.setItem(KEY, m); if (k != null) localStorage.setItem(KEY + '_bak', k); }, [KEY, m, k]);
    const state = async () => p.evaluate(KEY => { const A = window.__atlas, w = s => { try { return JSON.parse(localStorage.getItem(s)).week; } catch (e) { return localStorage.getItem(s) == null ? null : 'bad'; } };
      return {week: A.S.week, main: w(KEY), bak: w(KEY + '_bak'), broken: localStorage.getItem(KEY + '_broken') != null, cont: !!document.querySelector('[data-act=continue]')}; }, KEY);
    const boot = async () => { await p.reload(); await p.waitForTimeout(500); return state(); };
    const W = JSON.parse(good).week, W2 = JSON.parse(good2).week;
    await set(good2, good); let s = await boot(); ok('backup 1: main ok + backup ok → main loads, becomes the backup', s.week === W2 && s.main === W2 && s.bak === W2 && s.cont, JSON.stringify(s));
    await set(broken, good); s = await boot(); ok('backup 2: main broken + backup ok → backup loads, backup kept, main rewritten, continue shown (BUG-16)', s.week === W && s.bak === W && s.main === W && s.broken && s.cont, JSON.stringify(s));
    s = await boot(); ok('backup 2b: reloading after a restore still loads the game', s.week === W && s.bak === W && s.main === W, JSON.stringify(s));
    await set(good2, broken); s = await boot(); ok('backup 3: main ok + backup broken → main loads and replaces the bad backup', s.week === W2 && s.bak === W2, JSON.stringify(s));
    await set(broken, broken); s = await boot(); ok('backup 4: both broken → new game, broken data kept aside, nothing good lost', s.week < 5 && s.broken && !s.cont, JSON.stringify(s));
    await set(null, good); s = await boot(); ok('backup 5: main missing + backup ok → backup loads', s.week === W && s.bak === W, JSON.stringify(s));
    await set(broken, good); await p.evaluate(() => { const ls = Object.getPrototypeOf(localStorage), real = ls.setItem; ls.setItem = function(k, v){ if (/_bak$/.test(k) || !/_broken$/.test(k)) throw new Error('full'); return real.call(this, k, v); }; });
    await p.evaluate(() => { const A = window.__atlas; A.loadSave(); }); const bakAfter = await p.evaluate(KEY => JSON.parse(localStorage.getItem(KEY + '_bak')).week, KEY);
    ok('backup 6: a restore while storage refuses writes leaves the backup intact', bakAfter === W, String(bakAfter));
    await p.reload(); await p.waitForTimeout(300);
    ok('no page errors in the backup matrix', !errs.length, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }

  /* ---------- B. cash-only buying on every listed stock (BUG-18) ---------- */
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const A = window.__atlas, out = {n: 0, bad: [], maxOver: 0};
      for (const frac of [1, .5, .01]) for (const loan0 of [0, 3]) {
        A.newGame(4242, 'normal', 'QA', 'q', 'std', true); const ids = A.S.cos.filter(c => !c.priv).map(c => c.id);
        for (const id of ids) { A.newGame(4242, 'normal', 'QA', 'q', 'std', true); const S = A.S; S.player.loan = loan0; S.player.cash = 30.123456; const c = S.cos.find(x => x.id === id);
          A.ui.sel = id; A.ui.actor = 'P'; A.ui.cashOnly = true; A.ui.amt = Math.floor(S.player.cash * frac * 100) / 100;
          const L0 = S.player.loan; A.act('buy', {dataset: {}}); out.n++;
          if (S.player.loan > L0 + 1e-12 || S.player.cash < -1e-12) { out.bad.push(c.name); out.maxOver = Math.max(out.maxOver, S.player.loan - L0, -S.player.cash); } }
      }
      A.ui.cashOnly = false; return out; });
    ok(`cash-only: ${r.n} purchases (every stock × 100%/50%/1% × with/without margin debt) never borrow`, !r.bad.length, r.bad.length ? `${r.bad.length} borrowed, max ${r.maxOver}` : '');
    await ctx.close();
  }

  /* ---------- C. every bank action is on disk the moment it returns (BUG-02) ---------- */
  {
    const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(300);
    await p.click('[data-act=allu][data-v="1"]'); await p.click('[data-act=newgame]');
    await p.evaluate(() => { const A = window.__atlas, S = A.S; S.settings.guide = false; S.player.cash = 60; const c = S.cos.find(x => !x.priv && !x.ctrl); A.execBuy('P', c, A.sharesForMoney(c, 30)); A.renderAll(true); });
    const same = () => p.evaluate(() => { const A = window.__atlas, o = JSON.parse(localStorage.getItem(A.SAVE_KEY)); return Math.abs(o.player.cash - A.S.player.cash) < 1e-9 && Math.abs((o.player.bank || 0) - (A.S.player.bank || 0)) < 1e-9 && (o.player.tl || []).length === (A.S.player.tl || []).length; });
    await p.click('[data-act=tab][data-v=bank]');
    const res = {};
    for (const sel of ['[data-act=loantake]', '[data-act=bankb]', '[data-act=bankr]', '[data-act=loanoff]']) {
      if (sel === '[data-act=bankb]') await p.click('[data-act=banktab][data-v=line]'); if (sel === '[data-act=loanoff]') await p.click('[data-act=banktab][data-v=loan]');
      const el = await p.$(sel); if (!el) { res[sel] = 'missing'; continue; }
      const before = await p.evaluate(() => window.__atlas.S.player.cash); await el.click(); const after = await p.evaluate(() => window.__atlas.S.player.cash);
      res[sel] = after !== before ? await same() : 'no-op';
    }
    ok('immediate save: loan, credit line draw/repay and loan payoff are on disk at once', Object.values(res).every(v => v === true), JSON.stringify(res));
    await ctx.close();
  }

  /* ---------- D. random tapping: invariants hold, nothing throws, the save always matches ---------- */
  for (const seed of [11, 22, 33, 44, 55]) {
    const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(URL); await p.waitForTimeout(300); await p.click('[data-act=allu][data-v="1"]'); await p.click('[data-act=newgame]');
    await p.evaluate(() => { window.__atlas.S.settings.guide = false; window.__atlas.S.player.cash = 300; });
    const r = await p.evaluate(([seed, taps]) => {
      const A = window.__atlas; let x = seed >>> 0; const rnd = () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; /* test-only LCG: never touches the game's RNG */
      const SKIP = new Set(['restart', 'newgame', 'importsave', 'restorebak', 'savemgr', 'unsaved', 'exportsave', 'copysave', 'dlsave', 'reset', 'wipe']);
      const out = {taps: 0, acts: {}, inv: [], weeks: 0};
      for (let i = 0; i < taps; i++) {
        const els = [...document.querySelectorAll('[data-act]')].filter(e => !e.disabled && !SKIP.has(e.dataset.act) && e.offsetParent !== null);
        if (!els.length) { A.act('close', {dataset: {}}); continue; }
        const MONEY = /^(buy|sell|short|cover|amt|amtd|tender|tob|raise|bid|pebid|pe|vc|bank|loan|prop|div|bulk|ipo|list|merge|restr|issue|spin|liq|opt|call|put|lux|buyout|accept|decline|ok|yes|no|inbox|vote|hire|fire|sal|train|exp|hq|set|pay|special|cashonly|sellfd|xs|bs|ceo)/;
        const wts = els.map(e => MONEY.test(e.dataset.act) ? 6 : 1), tot = wts.reduce((a, b) => a + b, 0); let pick = rnd() * tot, el = els[0]; for (let j = 0; j < els.length; j++) { pick -= wts[j]; if (pick <= 0) { el = els[j]; break; } }
        out.acts[el.dataset.act] = (out.acts[el.dataset.act] || 0) + 1;
        try { el.click(); } catch (e) { out.inv.push('throw ' + el.dataset.act + ': ' + e.message); }
        out.taps++;
        if (i % 7 === 0) { A.step(); out.weeks++; }
        if (i % 25 === 0 && !document.querySelector('#modal').hidden && rnd() < .5) A.act('close', {dataset: {}});
        const S = A.S, e = A.econCheck(S), nw = A.netWorth('P');
        if (e) out.inv.push(`tap ${i} (${el.dataset.act}): ${e}`);
        if (!isFinite(nw)) out.inv.push(`tap ${i} (${el.dataset.act}): net worth ${nw}`);
        if (out.inv.length > 3) break;
      }
      let disk = null; try { disk = JSON.parse(localStorage.getItem(A.SAVE_KEY)); } catch (e) { /* */ }
      out.saved = !!disk && disk.week === A.S.week; out.lost = !!A.S.lost; out.nw = Math.round(A.netWorth('P'));
      out.top = Object.entries(out.acts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => k + ':' + v).join(' ');
      return out;
    }, [seed, TAPS]);
    ok(`fuzz seed ${seed}: ${r.taps} random taps over ${r.weeks} weeks keep money/ownership consistent`, !r.inv.length, r.inv.slice(0, 3).join(' | ') || `net worth ${r.nw}, ${r.top}`);
    ok(`fuzz seed ${seed}: no page errors and the save on disk matches the game`, !errs.length && r.saved, errs.slice(0, 2).join(' | '));
    await ctx.close();
  }

  /* ---------- E. save → load → continue gives the same economy as never stopping ---------- */
  {
    const ctx = await b.newContext(); const p = await ctx.newPage(); await p.goto(URL); await p.waitForTimeout(300);
    const r = await p.evaluate(() => { const A = window.__atlas; A.newGame(2468, 'normal', 'QA', 'q', 'std', true); for (let i = 0; i < 52; i++) { A.step(); A.S.inbox = []; }
      const mid = JSON.stringify(A.S); for (let i = 0; i < 52; i++) { A.step(); A.S.inbox = []; }
      const fp = () => JSON.stringify({rs: A.S.rs, week: A.S.week, idx: A.S.idx, px: A.S.cos.map(c => [c.id, +c.price.toFixed(9), c.shares, JSON.stringify(c.own)]), p: [A.S.player.cash, A.S.player.loan], r: A.S.rivals.map(x => x.cash)});
      const a = fp(), err = A.importText(mid); for (let i = 0; i < 52; i++) { A.step(); A.S.inbox = []; } const bb = fp(); return {same: a === bb, err}; });
    ok('determinism: loading the week-52 save and playing on matches the uninterrupted run at week 104', r.same && !r.err, r.err || '');
    await ctx.close();
  }

  await b.close();
  console.log(fails ? `${fails} check(s) failed` : 'all QA checks passed');
  process.exit(fails ? 1 : 0);
})();
