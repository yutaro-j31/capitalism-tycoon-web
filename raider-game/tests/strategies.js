/* Strategy benchmark: simple scripted strategies over N years and several seeds, using only player-visible signals.
   Usage: node raider-game/tests/strategies.js [years=10] [seeds=3] [difficulty=normal] [strategies=value,pe,...]   Prints median final net worth, goal hits and max drawdown. */
const {chromium} = require('playwright');
const path = require('path');
const YEARS = +(process.argv[2] || 10), NS = +(process.argv[3] || 3), DIFF = process.argv[4] || 'normal', ONLY = process.argv[5] ? process.argv[5].split(',') : null;
const SEEDS = [12345, 54321, 98765, 24680, 13579, 11111, 22222, 33333, 44444, 55555].slice(0, NS);
const STRATS = ['value', 'vc', 'pe', 'tob', 'dividend', 'cash', 'analyst', 'pe2', 'tob2', 'tob3', 'tob4', 'tob5'];
const RUN = ONLY || STRATS;

function run(args) {
  const [strat, seed, weeks, diff] = args, A = window.__atlas;
  A.newGame(seed, diff, 'B', 'b', 'std', true); const S = A.S; S.won = true; S.settings.p_year = false; if (/^pe/.test(strat)) { A.hqInit(); Object.assign(S.dept.inv, {on: true, staff: Math.max(1, S.dept.inv.staff)}); } /* PE needs an investment department */
  const est = c => (A.estFair ? A.estFair(c) : A.fair(c));
  let peak = 0, mdd = 0, hit = null; const tr = []; let nC = 0;
  const sellAll = () => { for (const c of S.cos) if (!c.priv && (c.own.P || 0) > 0 && c.ctrl !== 'P') A.execSell('P', c, c.own.P); };
  for (let w = 0; w < weeks; w++) {
    if (w % 13 === 0) {
      if (strat === 'value') { sellAll(); const L = S.cos.filter(c => !c.priv && !c.ctrl && c.ni > 0 && est(c) / c.price > 1.12).sort((a, b) => est(b) / b.price - est(a) / a.price).slice(0, 5); const m = Math.max(0, S.player.cash) * .95 / Math.max(1, L.length); for (const c of L) A.execBuy('P', c, A.sharesForMoney(c, m)); }
      if (strat === 'dividend') { sellAll(); const L = S.cos.filter(c => !c.priv && !c.ctrl && c.ni > 0).sort((a, b) => b.ni * b.payout / (b.price * b.shares) - a.ni * a.payout / (a.price * a.shares)).slice(0, 5); const m = Math.max(0, S.player.cash) * .95 / Math.max(1, L.length); for (const c of L) A.execBuy('P', c, A.sharesForMoney(c, m)); }
      if (strat === 'vc') { A.hqInit(); if (S.dept && S.dept.inv && !S.dept.inv.on) { S.dept.inv.on = true; } for (const d of S.vc.deals.slice()) if (S.player.cash > d.val * .05 * 1.2) A.vcInvest(d.id, .05); }
      if (strat === 'pe') { const pend = (S.pe.deals || []).some(d => (d.bids || []).some(x => x.k === 'P')) || S.cos.filter(x => x.pe && !x.pe.closed && x.pe.owner === 'P').length >= 3; const d = (S.pe.deals || []).filter(d => !(d.bids || []).some(b => b.k === 'P')).sort((a, b) => A.dealAsk(a) - A.dealAsk(b))[0]; if (!pend && d && A.dealAsk(d) * .6 < S.player.cash * .5) A.peBid(d, 0, .5, false, 'P');
        for (const c of S.cos.filter(x => x.pe && !x.pe.closed && x.pe.owner === 'P')) { c.dm = 'auto'; c.deleg = c.deleg || 'bal'; c.lim = c.lim || {ad: .02, rt: 'BBB'}; }
        for (const c of S.cos.filter(x => x.priv && x.pe && !x.pe.closed && x.pe.owner === 'P' && !x.pe.sale)) if (A.peStats(c).moic > 1.6 || S.week - c.pe.w0 > 208) A.peExitStart(c); }
      if (strat === 'tob') { const L = S.cos.filter(c => !c.priv && !c.ctrl && !A.activeTob(c) && c.ind !== 'air' && c.ind !== 'telecom').sort((a, b) => a.price * a.shares - b.price * b.shares);
        for (const c of L.slice(0, 6)) { const np = A.tobNeedPrice('P', c, .51); if (!np) continue; const q = A.tenderQuote('P', c, np, .51); if (q && q.cost < Math.max(0, S.player.cash) * .9) { A.launchTob('P', c, np, .51); break; } }
        for (const c of S.cos.filter(x => x.ctrl === 'P')) { c.dm = 'auto'; c.deleg = c.deleg || 'bal'; c.lim = c.lim || {ad: .02, rt: 'BBB'}; if (S.player.loan > 0 && c.cash > c.rev * .08) { const a = Math.min(c.cash - c.rev * .05, S.player.loan / Math.max(1e-9, c.own.P / c.shares)); if (a > 0 && A.specialDividend) A.specialDividend(c, a); } } }
    }
    /* competent players: analyst (visible estimate, cash only), pe2 (keeps capital working, DD on risky deals), tob2 (cheap targets, minimum condition, LBO, recycles cash) */
    if (strat === 'analyst' && w % 13 === 0) {
      for (const c of S.cos) if (!c.priv && (c.own.P || 0) > 0 && c.ctrl !== 'P' && c.price > A.fairEst(c) * .97) A.execSell('P', c, c.own.P);
      const L = S.cos.filter(c => !c.priv && !c.ctrl && c.ni > 0 && A.fairEst(c) / c.price > 1.15 && !(c.own.P > 0)).sort((a, b) => A.fairEst(b) / b.price - A.fairEst(a) / a.price).slice(0, 4);
      const m = Math.max(0, S.player.cash) * .9 / Math.max(1, L.length); for (const c of L) A.execBuy('P', c, A.sharesForMoney(c, m), m);
    }
    if (strat === 'pe2' && w % 2 === 0) {
      const mine = () => S.cos.filter(x => x.pe && !x.pe.closed && x.pe.owner === 'P');
      for (const c of mine()) { c.dm = 'auto'; c.deleg = c.deleg || 'bal'; c.lim = c.lim || {ad: .02, rt: 'BBB'}; }
      for (const d of (S.pe.deals || []).slice()) {
        if ((d.bids || []).some(b => b.k === 'P') || d.bid && d.bid.k === 'P') continue;
        if (d.type === 'turn' && d.dd !== 2) { if (!d.dd && A.ddCost && A.ddCost(d) < S.player.cash * .05) A.peDD(d); continue; }
        if (d.dd === 2 && d.mTrue < .03) continue;
        const ask = A.dealAsk(d); if (ask * .55 < Math.max(0, S.player.cash) * .6) A.peBid(d, 0, .5, false, 'P');
      }
      for (const c of S.cos.filter(x => x.priv && x.pe && !x.pe.closed && x.pe.owner === 'P' && !x.pe.sale)) if (A.peStats(c).moic > 2 || S.week - c.pe.w0 > 156) A.peExitStart(c);
    }
    if (strat === 'tob5' && w % 4 === 0) /* tob3 plus exits: sell an improved subsidiary to a strategic buyer, then buy the next one */
      for (const c of S.cos.filter(x => x.ctrl === 'P' && !x.bsale && !S.inbox.some(i => i.kind === 'bsale' && i.cid === x.id))) { const held = S.week - (c._w0 == null ? (c._w0 = S.week) : c._w0), gain = c.own.P * c.price / Math.max(1e-9, A.costOf('P', c.id)); if ((held > 104 && gain > 1.5) || held > 208) c.bsale = {end: S.week + 4}; }
    if ((strat === 'tob2' || strat === 'tob3' || strat === 'tob5') && w % 4 === 0) {
      const subs = S.cos.filter(x => x.ctrl === 'P');
      for (const c of subs) { c.dm = 'auto'; c.deleg = c.deleg || 'bal'; c.lim = c.lim || {ad: .02, rt: 'BBB'}; if (c.cash > c.rev * .1 && A.specialDividend) A.specialDividend(c, c.cash - c.rev * .06); }
      if (!S.tobs.some(x => x.boss === 'P')) {
        const L = S.cos.filter(c => !c.priv && !c.ctrl && !A.activeTob(c) && c.ind !== 'air' && c.ind !== 'telecom' && c.ni > 0).sort((a, b) => A.fairEst(b) / b.price - A.fairEst(a) / a.price).slice(0, 12);
        for (const c of L) { const np = A.tobNeedPrice('P', c, .51); if (!np || np > A.fairEst(c) * 1.1) continue; const q = A.tenderQuote('P', c, np, .51); if (!q) continue;
          const lbo = strat === 'tob2' && A.lboOK && A.lboOK(c, q.cost) && q.cost * .35 < S.player.cash * .9; const need = q.cost * (lbo ? .35 : 1);
          if (need < Math.max(0, S.player.cash) * .9 && A.launchTob('P', c, lbo ? A.tobNeedPrice('P', c, 1) || np : np, lbo ? 1 : .51, lbo)) { const t = A.activeTob(c); if (t && !lbo) t.minc = .51; break; } }
      }
    }
    if (strat === 'tob4' && w % 4 === 0) { /* toehold then tender: buy a cheap company on the market, then bid for control */
      for (const c of S.cos.filter(x => x.ctrl === 'P')) { c.dm = 'auto'; c.deleg = c.deleg || 'bal'; c.lim = c.lim || {ad: .02, rt: 'BBB'}; if (c.cash > c.rev * .1) A.specialDividend(c, c.cash - c.rev * .06); }
      { const pay = Math.min(Math.max(0, S.player.cash - 1), S.player.loan); S.player.cash -= pay; S.player.loan -= pay; } /* dividends repay the margin loan */
      const room = () => A.buyingPower() * .6 - S.player.loan * .5; /* keeps well clear of a margin call */
      if (!S.tobs.some(x => x.boss === 'P')) {
        let tgt = S.cos.find(c => c.id === S._tgt && !c.priv && !c.ctrl);
        if (!tgt) { const nw = A.netWorth('P'); tgt = S.cos.filter(c => !c.priv && !c.ctrl && !A.activeTob(c) && c.ind !== 'air' && c.ind !== 'telecom' && c.ni > 0 && c.price * c.shares * .55 < nw * 1.6).sort((a, b) => A.fairEst(b) / b.price - A.fairEst(a) / a.price)[0]; S._tgt = tgt && tgt.id; }
        if (tgt) { const have = (tgt.own.P || 0) / tgt.shares;
          if (have < .25 && tgt.price < A.fairEst(tgt) * 1.05) { const m = Math.min(Math.max(0, S.player.cash) * .95, (.25 - have) * tgt.shares * tgt.price * 1.05); if (m > .5) A.execBuy('P', tgt, A.sharesForMoney(tgt, m), m); }
          else if (have < .25) {}
          else { const np = A.tobNeedPrice('P', tgt, .51); const q = np && A.tenderQuote('P', tgt, np, .51);
            /* bid through whichever group company can fund it: the parent (cash or margin) or a subsidiary (its cash and borrowing room) */
            const buyer = q && np < A.fairEst(tgt) * 1.25 ? (q.cost < Math.max(Math.max(0, S.player.cash) * .95, room()) ? 'P' : (S.cos.filter(x => x.ctrl === 'P' && x !== tgt).sort((a, b) => A.fundsOf(b.id) - A.fundsOf(a.id))[0] || {}).id) : null;
            if (buyer && (buyer === 'P' || A.fundsOf(buyer) * .8 > q.cost) && A.launchTob(buyer, tgt, np, .51)) { const tt = A.activeTob(tgt); if (tt) tt.minc = .51; } } }
      }
    }
    A.step();
    for (const it of S.inbox.slice()) if (it.kind === 'prop' && S.inbox.includes(it)) { const el = document.createElement('button'); el.dataset.id = it.id; el.dataset.v = '1'; A.act('hprop', el); } /* cost cutting on autopilot waits for approval (since priority 5): the bot approves like a player would */
    for (const it of S.inbox.slice()) if (it.kind === 'crisis') { const c = S.cos.find(x => x.id === it.cid); if (c && c.crisis && !(String(it.rec || '').includes('親会社') && A.resolveCrisis(c, 'parent'))) A.resolveCrisis(c, 'refi'); } /* follows the officers' recommendation */ /* since rev20 a crisis waits for the player even on autopilot: the bot answers it like a player would */
    for (const it of S.inbox.slice()) { if (it.kind === 'bsale' && it.bids && it.bids.length) A.bsaleExec(it, 0); if (it.kind === 'peexit' && it.bids && it.bids.length) { const c = S.cos.find(x => x.id === it.cid); if (c) A.peSell(c, it.bids[it.bids.length - 1]); } if (it.kind === 'vcoffer') { const h = S.vc.hold.find(x => x.id === it.hid); if (h) { S.player.cash += it.px * h.stake; S.vc.hold = S.vc.hold.filter(x => x !== h); } } }
    S.inbox = [];
    const nw = A.netWorth('P'); { const ctl = S.cos.filter(c => c.ctrl === 'P'); if (ctl.length !== nC) { tr.push(`w${w} ctrl ${nC}->${ctl.length} ${ctl.map(c => c.name.slice(0, 8)).join(',')} nw ${nw.toFixed(0)} cash ${S.player.cash.toFixed(0)}`); nC = ctl.length; } if (w % 52 === 51) tr.push(`y${(w + 1) / 52} nw ${nw.toFixed(0)} cash ${S.player.cash.toFixed(0)} loan ${S.player.loan.toFixed(0)} tgt ${S._tgt || ''} ${S._tgt ? (() => { const c = S.cos.find(x => x.id === S._tgt); return c ? `${c.name.slice(0, 8)} own ${((c.own.P || 0) / c.shares).toFixed(2)} px/est ${(c.price / A.fairEst(c)).toFixed(2)} need ${((A.tobNeedPrice('P', c, .51) || 0) / A.fairEst(c)).toFixed(2)}` : 'gone'; })() : ''}`); } peak = Math.max(peak, nw); if (peak > 0) mdd = Math.max(mdd, 1 - nw / peak); if (hit == null && nw >= 1000) hit = S.week / 52;
    if (S.lost) break;
  }
  return {nw: A.netWorth('P'), mdd, hit, lost: !!S.lost, tr};
}

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('#modal').hidden = true; });
  const out = {};
  for (const s of RUN) {
    const rs = []; for (const seed of SEEDS) rs.push(await p.evaluate(run, [s, seed, YEARS * 52, DIFF]));
    const nws = rs.map(r => r.nw).sort((a, b) => a - b);
    out[s] = {median: Math.round(nws[Math.floor(nws.length / 2)]), min: Math.round(nws[0]), max: Math.round(nws[nws.length - 1]), goal: rs.filter(r => r.hit != null).length + '/' + rs.length, mdd: Math.round(Math.max(...rs.map(r => r.mdd)) * 100) + '%', lost: rs.filter(r => r.lost).length};
    console.log(s.padEnd(9), JSON.stringify(out[s])); if (process.env.TRACE) for (const r of rs) console.log('  --\n  ' + r.tr.join('\n  '));
  }
  await b.close();
})();
