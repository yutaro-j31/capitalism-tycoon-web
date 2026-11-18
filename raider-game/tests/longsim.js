/* rev13 long simulation: 3 difficulties × 2 seeds × 2 strategies, 520 weeks each (6,240 weeks).
   'trade': an individual trader who buys and sells (and founds a company); 'acquire': a company that makes TOBs, buys PE deals and blocks, and sells at gains or losses.
   Checks every week (no exception, money/ownership consistent), and that the save loads right after every acquisition and sale and every half year.
   Usage: node tests/longsim.js [weeks] */
const {chromium} = require('playwright'); const path = require('path'); const WEEKS = +(process.argv[2] || 520);
(async () => { const b = await chromium.launch(); const rows = []; let failed = 0;
  for (const diff of ['easy', 'normal', 'hard']) for (const seed of [3101, 3102]) for (const strat of ['trade', 'acquire']) {
    const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
    const r = await p.evaluate(([diff, seed, strat, W]) => { const A = window.__atlas; const out = {ex: [], econ: [], loads: 0, refused: [], tob: 0, tobWon: 0, pe: 0, block: 0, sells: 0, lossSells: 0};
      A.newGame(seed, diff, 'L', 'l', strat === 'trade' ? 'trader' : 'std', strat !== 'trade'); A.S.won = A.S.lost = strat !== 'trade'; A.S.settings.confirm = false; A.S.settings.guide = false;
      const load = why => { out.loads++; if (!A.parseSave(A.exportText())) out.refused.push(`w${A.S.week} ${why}: ${A.trialErr.slice(0, 100)}`); };
      const listed = () => A.S.cos.filter(c => !c.priv && !c.ctrl);
      const buyAct = (c, money) => { A.ui.sel = c.id; A.ui.actor = 'P'; A.ui.tmode = 'cash'; A.ui.cashOnly = true; const n = A.roundSh(A.sharesForMoney(c, money)); if (n > 0) A.act('buy', {dataset: {n: String(n)}}); };
      const sell = (c, f) => { const h = c.own.P || 0; if (!(h > 0)) return; const r = A.execSell('P', c, A.roundSh(h * f) || h); if (r) { out.sells++; if ((A.S.ledger[0] || {}).pnl < 0) out.lossSells++; load('sale'); } };
      for (let w = 1; w <= W; w++) {
        const S = A.S; S.inbox = [];
        try {
          if (strat === 'trade') {
            if (w % 2 === 0 && S.player.cash > .005) { const L = listed().filter(c => A.repCheap(c)); const c = L[w % Math.max(1, L.length)]; if (c) buyAct(c, S.player.cash * .25); }
            if (w % 5 === 0) { const H = S.cos.filter(c => (c.own.P || 0) > 0 && !c.priv); if (H.length) sell(H[w % H.length], .5); }
            if (!S.founded && A.myWorth() > 1 && w > 100) { A.incorporate('L社', 0); load('founding'); }
          } else {
            if (w % 13 === 3) { const L = listed().filter(c => !A.S.tobs.some(t => t.cid === c.id)).sort((u, v) => u.price * u.shares - v.price * v.shares); const c = L[(w / 13 | 0) % Math.max(1, Math.min(12, L.length))];
              if (c && c.price * c.shares * .25 < S.player.cash) { if (A.launchTob('P', c, c.price * (1.3 + (w % 3) * .3), w % 2 ? .2 : .51, false)) { out.tob++; c._t = true; } } }
            for (const c of S.cos) if (c._t && !A.S.tobs.some(t => t.cid === c.id)) { delete c._t; if ((c.own.P || 0) > 0) { out.tobWon++; load('TOB completed'); } }
            if (w % 26 === 7) { const H = S.cos.filter(c => (c.own.P || 0) > 0 && !c.priv && c.ctrl !== 'P'); if (H.length) sell(H[w % H.length], 1); const K = S.cos.filter(c => c.ctrl === 'P' && !c.priv); if (K.length && w % 52 === 7) sell(K[0], .3); }
            if (w % 39 === 5) { const d = (S.pe.deals || []).find(x => !x.bid && A.dealEbitda(x, false) > 0 && A.dealAsk(x) < S.player.cash * .3); if (d) { A.peBid(d, .1, 0, false, 'P', 0); out.pe++; } }
            if (w % 52 === 20) { const c = listed().find(x => Object.keys(x.own).some(k => /^R/.test(k) && x.own[k] > 0)); const rv = c && Object.keys(c.own).find(k => /^R/.test(k) && c.own[k] > 0); if (rv) { A.transferShares(rv, 'P', c, Math.min(c.own[rv], c.shares * .02), c.price * 1.1); out.block++; load('block trade'); } }
          }
          A.step();
        } catch (e) { out.ex.push(`w${w}: ${e.message}`); if (out.ex.length > 3) break; }
        const e = A.econCheck(A.S); if (e) { out.econ.push(`w${w}: ${e}`); if (out.econ.length > 3) break; }
        if (w % 26 === 0) load('half year');
      }
      const st = A.trStats(); return Object.assign(out, {weeks: A.S.week, nw: +A.myWorth().toFixed(2), sig: A.finSig(A.stamp()), ledger: (A.S.ledger || []).length + (A.S.ldrop || 0), founded: !!A.S.founded, rw: st ? st.weeks : 0}); }, [diff, seed, strat, WEEKS]);
    const bad = r.ex.length + r.econ.length + r.refused.length + errs.length; if (bad) failed++;
    rows.push(`${diff.padEnd(6)} ${seed} ${strat.padEnd(7)} weeks ${r.weeks} · loads ${r.loads} (refused ${r.refused.length}) · exceptions ${r.ex.length} · econ ${r.econ.length} · page errors ${errs.length} · trades ${r.ledger} (sells ${r.sells}, at a loss ${r.lossSells}) · TOB ${r.tob}/${r.tobWon} won · PE bids ${r.pe} · blocks ${r.block} · net worth ${r.nw} · sig ${r.sig}`
      + (bad ? '\n    ' + [...r.ex, ...r.econ, ...r.refused, ...errs].slice(0, 4).join('\n    ') : ''));
    console.log(rows[rows.length - 1]); await p.close();
  }
  console.log(failed ? `${failed} case(s) with problems` : 'all cases clean'); await b.close(); process.exit(failed ? 1 : 0); })();
