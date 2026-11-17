/* Trader-scenario benchmark: an analyst-style player starting with 10,000,000円 who accepts managed money, founds a company
   once allowed, opens an office and departments as the firm grows. Prints the years to each personal-net-worth milestone.
   Usage: node raider-game/tests/trader.js [difficulty=normal] [seeds=5] [years=16]   (NOMM=1: never accept managed money; INDIV=1: never found a company — for comparing routes) */
const {chromium} = require('playwright'); const path = require('path');
const DIFF = process.argv[2] || 'normal', NS = +(process.argv[3] || 5), YEARS = +(process.argv[4] || 16);
const SEEDS = Array.from({length: NS}, (_, i) => 2003 + i * 7919);
const MS = [[.3, '3千万'], [1, '1億'], [10, '10億'], [30, '30億'], [100, '100億'], [1000, '1000億']];

function run([seed, diff, weeks, ms, nomm, indiv]) {
  const A = window.__atlas; A.newGame(seed, diff, 'B', 'b', 'trader', false); const S = A.S; S.won = false; document.querySelector('#modal').hidden = true;
  const est = c => A.fairEst(c), hit = {}, out = {};
  for (let w = 0; w < weeks; w++) {
    if (w % 13 === 0) {
      for (const c of S.cos) if (!c.priv && (c.own.P || 0) > 0 && c.ctrl !== 'P' && c.price > est(c) * .97) A.execSell('P', c, c.own.P);
      const L = S.cos.filter(c => !c.priv && !c.ctrl && c.ni > 0 && est(c) / c.price > 1.15 && !(c.own.P > 0)).sort((a, b) => est(b) / b.price - est(a) / a.price).slice(0, 4);
      const m = Math.max(0, S.player.cash) * .9 / Math.max(1, L.length);
      for (const c of L) { const n = A.preCo() ? A.roundSh(A.sharesForMoney(c, m)) : A.sharesForMoney(c, m); if (n > 0) A.execBuy('P', c, n, m); }
    }
    A.step(); if (S.won) S.won = true;
    for (const it of S.inbox.slice()) if (it.kind === 'mmoffer' && !nomm) A.mmAccept(it);
    S.inbox = [];
    if (!S.nl && A.trWeeks() >= 26 && S.player.cash > .03) A.nlStart(); /* the research newsletter */
    if (!indiv && A.preCo() && A.myWorth() >= .3) A.incorporate('B社', Math.min(.02, Math.max(0, S.player.cash - .25)));
    if (!A.preCo()) { A.hqInit(); const g = A.grossWorth();
      if (g >= 1 && A.office().lvl < 1) A.setOffice(1, 'tyo');
      if (g >= 1.5 && !S.dept.inv.on) Object.assign(S.dept.inv, {on: true, staff: Math.max(1, S.dept.inv.staff)});
      if (g >= 3 && !S.dept.acc.on) Object.assign(S.dept.acc, {on: true, staff: Math.max(1, S.dept.acc.staff)});
      if (g >= 20 && A.office().lvl < 2) A.setOffice(2, 'tyo');
      if (g >= 20 && !S.dept.legal.on) Object.assign(S.dept.legal, {on: true, staff: Math.max(1, S.dept.legal.staff)});
      if (g >= 100 && A.office().lvl < 3) A.setOffice(3, 'tyo');
      if (S.dept.inv.on && w % 13 === 0) S.dept.inv.staff = Math.max(S.dept.inv.staff, Math.min([4, 20, 40, 60][A.office().lvl], Math.ceil(g / 8))); /* grow the investment team with the firm */ }
    const nw = A.myWorth(); for (const [v] of ms) if (hit[v] == null && nw >= v) hit[v] = +(S.week / 52).toFixed(1);
    if (S.lost) break;
  }
  return {hit, nw: A.myWorth(), lost: !!S.lost, aum: S.mm.aum, fees: S.mm.fees + S.mm.perf, restarts: S.restarts || 0, nl: S.nl ? Math.round(S.nl.subs) : 0, foundY: S.foundW != null ? +(S.foundW / 52).toFixed(1) : null};
}

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  const rs = []; for (const seed of SEEDS) rs.push(await p.evaluate(run, [seed, DIFF, YEARS * 52, MS, !!process.env.NOMM, !!process.env.INDIV]));
  const med = a => { const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
  console.log(`${DIFF} ${NS} seeds, ${YEARS} years${process.env.NOMM ? ' (no managed money)' : ''}${process.env.INDIV ? ' (individual, never founds)' : ''}`);
  for (const [v, l] of MS) { const ys = rs.map(r => r.hit[v] == null ? YEARS + 1 : r.hit[v]); console.log(`  ${l.padEnd(6)} median ${med(ys) > YEARS ? YEARS + '+' : med(ys)}y  reached ${rs.filter(r => r.hit[v] != null).length}/${NS}`); }
  console.log(`  founded at ${rs.map(r => r.foundY).join(',')}y · final ${rs.map(r => Math.round(r.nw)).join(',')} (億) · managed ${rs.map(r => Math.round(r.aum)).join(',')} · members ${rs.map(r => r.nl).join(',')} · restarts ${rs.map(r => r.restarts).join(',')} · lost ${rs.filter(r => r.lost).length}`);
  await b.close();
})();
