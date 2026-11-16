/* Automated play-test: a scripted player + a seeded "monkey" that taps real buttons on an iPhone viewport,
   with invariant checks every week and a full screen sweep every quarter. Usage: node playtest.js [years] */
const {chromium, devices} = require('playwright');
const fs = require('fs');
const YEARS = +(process.argv[2] || 12);
const RUNS = [[101, 'normal'], [202, 'hard'], [303, 'easy']];
const OUT = require('path').join(__dirname, 'playtest-out/');
fs.mkdirSync(OUT, {recursive: true});

function inPage(seed) { /* installs window.__pt */
  const A = window.__atlas, M = document.querySelector('#modal');
  let r = seed >>> 0; const rng = () => { r = (Math.imul(r, 1664525) + 1013904223) >>> 0; return r / 4294967296; };
  const found = {}, clicks = {}, flow = {};
  const note = (k, d) => { const f = found[k] || (found[k] = {n: 0, w: A.S.week, d}); f.n++; };
  const EXCL = /^(newgame|restart|restorebak|savemgr|scen|diff|allu|speed|importsave|exportsave|help)$/;
  const BAD = /undefined|NaN|Infinity|\[object|(^|[^a-z])null([^a-z]|$)/;
  const scan = (where, el) => { if (!el) return; const t = el.innerText || ''; const m = t.match(BAD); if (m) { const i = t.indexOf(m[0]); note(`表示に「${m[0].trim()}」: ${where}`, t.slice(Math.max(0, i - 50), i + 30).replace(/\s+/g, ' ')); } };
  const over = where => { const o = document.documentElement.scrollWidth - innerWidth; if (o > 0) note(`横はみ出し ${where}`, o + 'px'); };
  const tap = el => { if (!el || el.disabled) return false; const a = el.dataset.act; clicks[a] = (clicks[a] || 0) + 1; try { el.click(); } catch (e) { note('クリックで例外 ' + a, e.message); } return true; };
  const q = s => document.querySelector(s);
  const btn = s => { const e = q(s); return e && !e.disabled ? tap(e) : false; };
  const tab = t => { A.ui.sel = A.ui.sel; btn(`[data-act=tab][data-v=${t}]`); };
  function modals(){
    for (let i = 0; i < 8 && !M.hidden; i++) {
      const txt = M.innerText; scan('モーダル「' + txt.slice(0, 14).replace(/\s+/g, ' ') + '」', M); over('モーダル');
      if (txt.includes('実行前の確認')) { flow.preview = (flow.preview || 0) + 1; const before = JSON.stringify(A.S); if (before.length < 10) note('preview', ''); }
      let b = null; const okb = M.querySelector('[data-ok]');
      if (okb && rng() < .6) b = okb; else b = M.querySelector('[data-act=awardok],[data-act=unlockgo],[data-act=close]');
      if (!b) b = [...M.querySelectorAll('button[data-act]')].find(x => !EXCL.test(x.dataset.act) && !x.disabled);
      if (!b) { note('閉じられないモーダル', txt.slice(0, 80)); M.hidden = true; break; }
      tap(b);
    }
    if (!M.hidden) { note('モーダルが閉じない（8回押しても）', M.innerText.slice(0, 80)); M.hidden = true; }
  }
  function monkey(n, root){
    for (let i = 0; i < n; i++) {
      modals();
      const bs = [...document.querySelectorAll((root || '#pbody') + ' button[data-act], #tabs button[data-act]')].filter(b => !b.disabled && !EXCL.test(b.dataset.act) && b.dataset.act !== 'step' && b.offsetParent);
      if (!bs.length) return; tap(bs[Math.floor(rng() * bs.length)]); modals();
      const sel = [...document.querySelectorAll('#pbody select')]; if (sel.length && rng() < .15) { const s = sel[Math.floor(rng() * sel.length)]; if (s.options.length > 1) { s.selectedIndex = Math.floor(rng() * s.options.length); s.dispatchEvent(new Event('input', {bubbles: true})); } }
    }
  }
  function invariants(){
    const S = A.S, bad = [], fin = (v, w) => { if (!Number.isFinite(v)) bad.push(w + '=' + v); };
    for (const c of S.cos) {
      for (const k of ['price', 'cash', 'debt', 'shares', 'rev', 'assets', 'margin']) fin(c[k], `${c.name}.${k}`);
      if (c.cash < -1e-6) bad.push(`会社の現金がマイナス`);
      let held = 0; for (const k in c.own) { if (!(c.own[k] >= 0)) bad.push(`持株がマイナス`); held += c.own[k]; }
      if (held > c.shares * (1 + 1e-6)) bad.push(`発行株数を超える保有`);
      const t = {}; for (const k in c.own) { const b = k[0] === 'C' ? (S.cos.find(x => x.id === k) || {}).ctrl : /^F\d+$/.test(k) ? 'P' : k; if (b) t[b] = (t[b] || 0) + c.own[k]; }
      let nc = null, bv = 0, sv = 0; for (const b of Object.keys(t).sort()) { if (t[b] > bv) { sv = bv; bv = t[b]; nc = b; } else if (t[b] > sv) sv = t[b]; }
      if (nc && !(bv > c.shares * .5 || (bv >= c.shares * .4 - 1e-9 && sv < bv * .5 && A.ownCap(c, nc) >= 1))) nc = null; if ((nc || null) !== (c.ctrl || null)) bad.push(`支配者の不一致`);
      if (c.ex) for (const r in c.ex) if (c.ex[r] && !S.hr.people[c.ex[r]]) bad.push('存在しない幹部を参照');
    }
    fin(S.player.cash, 'player.cash'); fin(S.player.loan, 'player.loan'); fin(A.netWorth('P'), 'netWorth');
    if (S.player.cash < -1e-6 && S.player.od != null && S.week - S.player.od > 9) bad.push('現金のマイナスが回収されない'); if (S.player.loan < -1e-9) bad.push('信用借入がマイナス');
    fin(S.pres.cash, 'pres.cash'); if (S.pres.cash < -1e-6) bad.push('社長個人の現金がマイナス');
    fin(S.research.pts, 'research.pts'); if (S.research.pts < -1e-6) bad.push('研究ポイントがマイナス');
    for (const rv of S.rivals) { fin(rv.cash, rv.n + '.cash'); fin(A.netWorth(rv.id), rv.n + '.nw'); }
    for (const t of S.tobs) if (!S.cos.some(c => c.id === t.cid)) bad.push('消えた会社へのTOB');
    for (const p of S.props || []) { fin(p.v, '不動産.v'); fin(p.mort, '不動産.mort'); }
    for (const n of S.news.slice(0, 20)) { const m = n.t.match(BAD); if (m) bad.push(`ニュース文に「${m[0].trim()}」: ${n.t.slice(0, 60)}`); }
    for (const b of bad) note('不変条件: ' + b, '');
  }
  function sweep(){
    const S = A.S;
    for (const t of ['market', 'port', 'pe', 'pres', 'rivals', 'news', 'inbox']) { tab(t); scan('タブ ' + t, q('#pbody')); over('タブ ' + t); }
    tab('inbox'); const cards = document.querySelectorAll('#pbody .offer').length; if (S.inbox.length !== cards) note('受信箱の件数と表示カード数が違う', `件数${S.inbox.length}・表示${cards}・種類${S.inbox.map(i => i.kind).join(',')}`);
    for (const h of ['acc', 'hr', 'board', 'inv', 'floor', 'me']) { A.ui.hqTab = h; tab('pres'); scan('本社 ' + h, q('#pbody')); over('本社 ' + h); }
    for (const k of ['pl', 'bs', 'cf']) for (const per of ['w', 'q', 'y']) { A.ui.hqTab = 'acc'; A.ui.fsKind = k; A.ui.fsPer = per; tab('pres'); scan(`財務諸表 ${k}/${per}`, q('#pbody')); }
    const mine = S.cos.filter(c => c.ctrl === 'P'), any = [mine[0], S.cos.find(c => c.priv && c.ctrl === 'P'), S.cos.find(c => A.netWorth && c.ctrl && c.ctrl !== 'P'), S.cos[Math.floor(rng() * S.cos.length)]].filter(Boolean);
    for (const c of any) for (const ct of ['info', 'trade', 'raid', 'ceo']) { A.ui.sel = c.id; A.ui.ctab = ct; tab('market'); scan(`企業 ${ct}`, q('#pbody')); over(`企業 ${ct}`); }
    for (const w of ['nw', 'bp', 'loan', 'cash', 'short']) { btn(`[data-act=why][data-v=${w}]`); scan('内訳 ' + w, M); modals(); }
    A.ui.sel = null; tab('market'); scan('ヘッダー', q('#stats')); scan('凡例', q('#legend'));
    try { const B = A.bsNow(), nw = A.netWorth('P') / (1 - (S.player.outside || 0)); if (Math.abs(B.eq - nw) > 1e-6 * Math.max(1, Math.abs(nw))) note('貸借対照表の純資産が本体価値と合わない', `${B.eq} vs ${nw}`); } catch (e) { note('bsNow例外', e.message); }
    const L = (S.player.plHist || [])[0]; if (L) { try { const C = A.cfOf(L); if (Math.abs(C.op + C.inv + C.fin - (L.cash1 - L.cash0)) > 1e-6) note('キャッシュフローの合計が現金の増減と合わない', ''); } catch (e) { note('cfOf例外', e.message); } }
  }
  function strategy(){ /* a simple human-like plan: buy cheap small caps, then TOB, then run companies */
    const S = A.S, nw = A.netWorth('P');
    const cands = S.cos.filter(c => !c.priv && !c.ctrl && !(S.player.ban || {})[c.id]).sort((a, b) => (A.fair(b) / b.price) * 1 / Math.sqrt(b.price * b.shares) - (A.fair(a) / a.price) / Math.sqrt(a.price * a.shares));
    const tgt = S.cos.find(c => c.id === flow.tgt && !c.ctrl) || cands[0]; if (!tgt) return; flow.tgt = tgt.id;
    if (S.week % 2 === 0) { A.ui.sel = tgt.id; A.ui.ctab = 'trade'; tab('market'); const amts = [...document.querySelectorAll('#pbody [data-act=amt]')].filter(b => b.dataset.v !== 'max'); if (amts.length) tap(amts[Math.min(amts.length - 1, 1 + Math.floor(rng() * 2))]); if (btn('#pbody [data-act=buy]')) flow.buy = (flow.buy || 0) + 1; modals(); }
    if (S.week % 6 === 3) { A.ui.sel = tgt.id; A.ui.ctab = 'raid'; tab('market'); if (q('#pbody [data-act=tender]')) { btn('#pbody [data-act=tprem][data-v="0.3"]'); if (btn('#pbody [data-act=tender]')) flow.tender = (flow.tender || 0) + 1; modals(); } }
    const mine = S.cos.filter(c => c.ctrl === 'P');
    if (mine.length && S.week % 3 === 1) { const c = mine[Math.floor(rng() * mine.length)]; A.ui.sel = c.id; A.ui.ctab = 'ceo'; tab('market'); monkey(3); }
    if (S.week % 5 === 0) { tab('pe'); monkey(3); }
    if (S.week % 7 === 0) { A.ui.hqTab = ['acc', 'hr', 'board', 'inv', 'floor', 'me'][Math.floor(rng() * 6)]; tab('pres'); monkey(3); }
    if (S.inbox.length) { tab('inbox'); for (let i = 0; i < 4; i++) { const b = [...document.querySelectorAll('#pbody .offer button[data-act]')].filter(x => !x.disabled && x.dataset.act !== 'sel'); if (!b.length) break; tap(b[Math.floor(rng() * b.length)]); modals(); } }
  }
  window.__pt = {
    week(){
      const S = A.S, w0 = S.week, t0 = performance.now();
      try { strategy(); } catch (e) { note('戦略中に例外', e.message); }
      try { A.ui.sel = null; tab('market'); monkey(4); } catch (e) { note('モンキー中に例外', e.message); }
      modals(); const w1 = A.S.week;
      btn('[data-act=step]'); modals();
      if (A.S.week === w1 && !A.S.lost) note('+1週を押しても週が進まない', `week ${w1}`);
      invariants();
      if (A.S.week % 13 === 0) try { sweep(); } catch (e) { note('画面巡回中に例外', e.message + ' ' + (e.stack || '').split('\n')[1]); }
      const dt = performance.now() - t0; flow.maxMs = Math.max(flow.maxMs || 0, dt);
      return {w: A.S.week, nw: A.netWorth('P'), lost: A.S.lost, won: A.S.won, stage: A.S.stage};
    },
    stepTime(){ const t = performance.now(); for (let i = 0; i < 10; i++) A.step(); return (performance.now() - t) / 10; },
    report(){
      const S = A.S; let save = null; try { A.save(); const L = A.loadSave(); save = !!L && L.week === S.week && Math.abs(L.player.cash - S.player.cash) < 1e-9; } catch (e) { save = 'err ' + e.message; }
      return {found, clicks, flow, save, saveKB: Math.round((localStorage.getItem(A.SAVE_KEY) || '').length / 1024), week: S.week, nw: A.netWorth('P'), rank: 1 + S.rivals.filter(r => A.netWorth(r.id) > A.netWorth('P')).length, rivals: S.rivals.map(r => [r.n, Math.round(A.netWorth(r.id))]), ctrl: S.cos.filter(c => c.ctrl === 'P').length, rivalCtrl: S.cos.filter(c => c.ctrl && c.ctrl[0] === 'R').length, stage: S.stage, won: S.won, lost: S.lost, ach: Object.keys(S.ach).length, steps: Object.keys(S.tut || {}).length, awards: (S.awards || []).map(a => a.wins.length), cos: S.cos.length, inbox: S.inbox.length, research: Object.keys(S.research.done).length, pe: (S.pe.funds || []).length, props: (S.props || []).filter(p => p.own === 'P').length, rep: S.player.rep, loan: S.player.loan, cash: S.player.cash};
    },
  };
}

(async () => {
  const b = await chromium.launch(); const all = [];
  for (const [seed, diff] of RUNS) {
    const ctx = await b.newContext({...devices['iPhone 13']}); const p = await ctx.newPage(); const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|CORS/.test(m.text())) errs.push('console: ' + m.text()); });
    await p.goto('file://' + require('path').join(__dirname, '..', 'index.html')); await p.waitForTimeout(300);
    await p.click(`[data-act=diff][data-v=${diff}]`); await p.click('[data-act=newgame]'); await p.click('[data-act=speed][data-v="0"]');
    await p.evaluate(([s, d]) => { const A = window.__atlas; A.newGame(s, d, 'テスト商事', '試験 太郎', 'std', false); }, [seed, diff]);
    await p.evaluate(inPage, seed);
    const t0 = Date.now(), traj = []; let last = null;
    for (let w = 0; w < YEARS * 52; w++) {
      try { last = await p.evaluate(() => window.__pt.week()); } catch (e) { errs.push('evaluate: ' + e.message.slice(0, 200)); break; }
      if (last.w % 52 === 0) traj.push([last.w / 52, Math.round(last.nw), last.stage]);
      if (last.lost) break;
    }
    const rep = await p.evaluate(() => window.__pt.report()); rep.stepMs = await p.evaluate(() => window.__pt.stepTime());
    rep.errs = [...new Set(errs)].slice(0, 15); rep.errCount = errs.length; rep.traj = traj; rep.seed = seed; rep.diff = diff; rep.sec = Math.round((Date.now() - t0) / 1000);
    await p.screenshot({path: OUT + `end-${diff}.png`});
    all.push(rep); console.log(JSON.stringify(rep, null, 1).slice(0, 6000)); await ctx.close();
  }
  fs.writeFileSync(OUT + 'report.json', JSON.stringify(all, null, 1)); await b.close();
})();
