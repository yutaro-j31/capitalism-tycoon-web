/* Strategy benchmark: simple scripted strategies over N years and several seeds, using only player-visible signals.
   Usage: node raider-game/tests/strategies.js [years=10] [seeds=3]   Prints median final net worth, goal hits and max drawdown. */
const {chromium} = require('playwright');
const path = require('path');
const YEARS = +(process.argv[2] || 10), NS = +(process.argv[3] || 3);
const SEEDS = [12345, 54321, 98765, 24680, 13579].slice(0, NS);
const STRATS = ['value', 'vc', 'pe', 'tob', 'dividend', 'cash'];

function run(args) {
  const [strat, seed, weeks] = args, A = window.__atlas;
  A.newGame(seed, 'normal', 'B', 'b', 'std', true); const S = A.S; S.won = true; S.settings.p_year = false;
  const est = c => (A.estFair ? A.estFair(c) : A.fair(c));
  let peak = 0, mdd = 0, hit = null;
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
    A.step();
    for (const it of S.inbox.slice()) { if (it.kind === 'peexit' && it.bids && it.bids.length) { const c = S.cos.find(x => x.id === it.cid); if (c) A.peSell(c, it.bids[it.bids.length - 1]); } if (it.kind === 'vcoffer') { const h = S.vc.hold.find(x => x.id === it.hid); if (h) { S.player.cash += it.px * h.stake; S.vc.hold = S.vc.hold.filter(x => x !== h); } } }
    S.inbox = [];
    const nw = A.netWorth('P'); peak = Math.max(peak, nw); if (peak > 0) mdd = Math.max(mdd, 1 - nw / peak); if (hit == null && nw >= 1000) hit = S.week / 52;
    if (S.lost) break;
  }
  return {nw: A.netWorth('P'), mdd, hit, lost: !!S.lost};
}

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('#modal').hidden = true; });
  const out = {};
  for (const s of STRATS) {
    const rs = []; for (const seed of SEEDS) rs.push(await p.evaluate(run, [s, seed, YEARS * 52]));
    const nws = rs.map(r => r.nw).sort((a, b) => a - b);
    out[s] = {median: Math.round(nws[Math.floor(nws.length / 2)]), min: Math.round(nws[0]), max: Math.round(nws[nws.length - 1]), goal: rs.filter(r => r.hit != null).length + '/' + rs.length, mdd: Math.round(Math.max(...rs.map(r => r.mdd)) * 100) + '%', lost: rs.filter(r => r.lost).length};
    console.log(s.padEnd(9), JSON.stringify(out[s]));
  }
  await b.close();
})();
