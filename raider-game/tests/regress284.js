/* rev13 regression: every listed company × 4 trades (max cash buy · sell 50% of 101 shares · max short · buy back 50% of 101 shorted shares).
   After each trade the money/ownership checks must pass and the save must load. Usage: node tests/regress284.js [seed] [trader|std] */
const {chromium} = require('playwright'); const path = require('path'); const SEED = +(process.argv[2] || 2401), SCEN = process.argv[3] || 'trader';
(async () => { const b = await chromium.launch(); const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
  const r = await p.evaluate(([seed, scen]) => { const A = window.__atlas, res = [];
    const fresh = () => { A.newGame(seed, 'normal', 'R', 'r', scen, scen === 'std'); A.S.won = A.S.lost = true; A.S.settings.confirm = false; if (scen === 'trader') { A.S.player.cash = 30; A.S.tr.eq1 = A.grossWorth(); A.S.tr.mid = 0; A.S.tr.seen = 0; } /* trader: 30億 like the standard start, so every condition can trade */ };
    fresh(); const ids = A.S.cos.filter(c => !c.priv).map(c => c.id); const sh101 = A.roundSh(101e-6), sh50 = A.roundSh(50e-6);
    const check = (id, kind, okTrade) => { const e = A.econCheck(A.S), loads = !!A.parseSave(A.exportText()); res.push([id, kind, okTrade && !e && loads ? 'ok' : `trade ${okTrade} econ ${e} load ${loads} ${loads ? '' : A.trialErr.slice(0, 80)}`]); };
    for (const id of ids) {
      fresh(); let c = A.S.cos.find(x => x.id === id), cash = A.S.player.cash; const q1 = A.execBuy('P', c, A.sharesForMoney(c, cash), cash); check(id, 'max cash buy', !!q1 && A.S.player.cash >= -1e-9 && (c.own.P || 0) > 0);
      fresh(); c = A.S.cos.find(x => x.id === id); A.execBuy('P', c, sh101); const h0 = c.own.P || 0; const q2 = A.execSell('P', c, sh50); check(id, 'sell 50% of 101', !!q2 && Math.abs(h0 - sh101) < 1e-12 && Math.abs((c.own.P || 0) - (sh101 - sh50)) < 1e-12);
      fresh(); c = A.S.cos.find(x => x.id === id); const n3 = A.sharesForShort(c, A.shortRoom ? A.shortRoom() : A.S.player.cash); const q3 = A.execShort(c, n3); check(id, 'max short', !!q3 && (A.S.player.shorts[c.id] || {}).n > 0);
      fresh(); c = A.S.cos.find(x => x.id === id); A.execShort(c, sh101); const s0 = (A.S.player.shorts[c.id] || {}).n || 0; const q4 = A.execCover(c, sh50); check(id, 'cover 50% of 101', !!q4 && Math.abs(s0 - sh101) < 1e-12 && Math.abs(((A.S.player.shorts[c.id] || {}).n || 0) - (sh101 - sh50)) < 1e-12);
    }
    return {n: ids.length, res}; }, [SEED, SCEN]);
  const bad = r.res.filter(x => x[2] !== 'ok');
  console.log(`${r.n} listed companies × 4 = ${r.res.length} conditions (seed ${SEED}, ${SCEN}): ${r.res.length - bad.length} passed, ${bad.length} failed, page errors ${errs.length}`);
  for (const x of bad.slice(0, 10)) console.log('FAIL', x.join(' · '));
  await b.close(); process.exit(bad.length || errs.length ? 1 : 0); })();
