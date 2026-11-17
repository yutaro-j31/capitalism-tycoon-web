/* Difficulty benchmark: two scripted players (an analyst-style value investor using the visible estimate, and the
   original reference bot that buys cheap stocks, sells dear ones and milks controlled companies) over N seeds.
   Usage: node raider-game/tests/difficulty.js [difficulty|all] [seeds=10] [years=15] ['{"param":value}' overrides]
   Prints, per bot, the median years to reach 1,000億円 (15+ = not reached), how many reached it within 10 / 15 years,
   bankruptcies and the median final net worth. */
const {chromium} = require('playwright'); const path = require('path');
const DIFFS = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : ['easy', 'normal', 'hard'];
const NS = +(process.argv[3] || 10), YEARS = +(process.argv[4] || 15), OVER = JSON.parse(process.argv[5] || '{}');
const SEEDS = Array.from({length: NS}, (_, i) => 1009 + i * 7919);

function run([bot, diff, seed, weeks, over]) {
  const A = window.__atlas; if (over && Object.keys(over).length) Object.assign(A.DIFF[diff], over);
  A.newGame(seed, diff, 'B', 'b', 'std', true); const S = A.S; S.won = true; let hit = null;
  for (let w = 0; w < weeks; w++) {
    if (bot === 'analyst' && w % 13 === 0) {
      for (const c of S.cos) if (!c.priv && (c.own.P || 0) > 0 && c.ctrl !== 'P' && c.price > A.fairEst(c) * .97) A.execSell('P', c, c.own.P);
      const L = S.cos.filter(c => !c.priv && !c.ctrl && c.ni > 0 && A.fairEst(c) / c.price > 1.15 && !(c.own.P > 0)).sort((a, b) => A.fairEst(b) / b.price - A.fairEst(a) / a.price).slice(0, 4);
      const m = Math.max(0, S.player.cash) * .9 / Math.max(1, L.length); for (const c of L) A.execBuy('P', c, A.sharesForMoney(c, m), m);
    }
    if (bot === 'reference' && w % 2 === 0) {
      const nw = A.netWorth('P');
      for (const c of S.cos.slice()) if (c.own.P && c.ctrl !== 'P' && c.price > A.fair(c) * 1.12) A.execSell('P', c, c.own.P);
      for (const c of S.cos) if (c.ctrl === 'P' && c.cash > 5) { const a = c.cash * .8; c.cash -= a; S.player.cash += a * (c.own.P || 0) / c.shares; }
      const pay = Math.min(Math.max(0, S.player.cash), S.player.loan); S.player.cash -= pay; S.player.loan -= pay;
      let best = null, bs = 1.15; for (const c of S.cos) { if (c.priv || (c.ctrl && c.ctrl !== 'P')) continue; const s = A.fair(c) / c.price; if (s > bs && c.price * c.shares < nw * 4) { bs = s; best = c; } }
      if (best && S.player.cash > 1) A.execBuy('P', best, Math.min(S.player.cash * 1.6, best.price * best.shares * .1) / best.price / 1.05);
    }
    A.step(); S.inbox = [];
    if (hit == null && A.netWorth('P') >= 1000) hit = (w + 1) / 52;
    if (S.lost) break;
  }
  return {hit, lost: !!S.lost, nw: A.netWorth('P')};
}

(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  await p.evaluate(() => { document.querySelector('#modal').hidden = true; });
  for (const d of DIFFS) for (const bot of ['analyst', 'reference']) {
    const rs = []; for (const seed of SEEDS) rs.push(await p.evaluate(run, [bot, d, seed, YEARS * 52, OVER]));
    const yrs = rs.map(r => r.hit == null ? YEARS + 1 : r.hit).sort((a, b) => a - b), med = a => a[Math.floor(a.length / 2)];
    const nws = rs.map(r => r.nw).sort((a, b) => a - b);
    console.log(`${d.padEnd(6)} ${bot.padEnd(9)} median ${med(yrs) > YEARS ? YEARS + '+' : med(yrs).toFixed(1)}y  by10y ${rs.filter(r => r.hit != null && r.hit <= 10).length}/${NS}  by${YEARS}y ${rs.filter(r => r.hit != null).length}/${NS}  bankrupt ${rs.filter(r => r.lost).length}  medianNW ${Math.round(med(nws))}  ${JSON.stringify(OVER) !== '{}' ? JSON.stringify(OVER) : ''}`);
  }
  await b.close();
})();
