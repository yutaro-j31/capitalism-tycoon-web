const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT } = require('./harness');

function lcg(seed = 4242) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

const { modules } = loadGame({ random: lcg() });
const gameDate = modules.engine.gameDate;
assert.equal(typeof gameDate, 'function', 'engine が gameDate を公開している');

// 1. 週が1つ進むごとに7日進み、ユーザーの求める 1月1日 → 1月8日 → 1月15日 になる。
{
  assert.equal(gameDate(1).label, '1月1日', '第1週は1月1日');
  assert.equal(gameDate(2).label, '1月8日', '第2週は1月8日');
  assert.equal(gameDate(3).label, '1月15日', '第3週は1月15日');
  assert.equal(gameDate(4).label, '1月22日', '第4週は1月22日');
  assert.equal(gameDate(5).label, '1月29日', '第5週は1月29日');
  assert.equal(gameDate(6).label, '2月5日', '月をまたいでも7日進む');
}

// 2. 52週で1年。エンジンが week%52 で founderAge を加算するのと同じ区切りにする。
{
  assert.equal(gameDate(52).year, 1, '第52週はまだ1年目');
  assert.equal(gameDate(53).year, 2, '第53週から2年目');
  assert.equal(gameDate(53).label, '1月1日', '各年の第1週は必ず1月1日');
  assert.equal(gameDate(105).label, '1月1日', '3年目の第1週も1月1日');
  for (let year = 1; year <= 40; year += 1) {
    const first = gameDate((year - 1) * 52 + 1);
    assert.equal(first.label, '1月1日', `${year}年目の第1週が1月1日`);
    assert.equal(first.year, year, `${year}年目の年数が一致する`);
  }
}

// 3. 想定プレイ期間（20歳開始で40年＝2080週）の全域で日付が壊れない。
{
  let previous = null;
  for (let week = 1; week <= 2080; week += 1) {
    const d = gameDate(week);
    assert(d.month >= 1 && d.month <= 12, `第${week}週の月が範囲内 (${d.month})`);
    assert(d.day >= 1 && d.day <= 31, `第${week}週の日が範囲内 (${d.day})`);
    assert.equal(d.weekOfYear, ((week - 1) % 52) + 1, `第${week}週の年内週番号`);
    if (previous && previous.year === d.year) {
      const before = previous.month * 100 + previous.day;
      const after = d.month * 100 + d.day;
      assert(after > before, `同じ年の中では日付が必ず前進する (第${week}週)`);
    }
    previous = d;
  }
  assert.equal(gameDate(2080).year, 40, '2080週目は40年目');
}

// 4. 表示専用の純関数であること（同じ入力なら常に同じ、状態も乱数も触らない）。
{
  const before = JSON.stringify(gameDate(232));
  const { modules: other } = loadGame({ random: lcg(999) });
  assert.equal(JSON.stringify(other.engine.gameDate(232)), before, '乱数に依存しない');
  assert.equal(JSON.stringify(gameDate(232)), before, '同じ入力なら同じ出力');
  assert.equal(gameDate(0).label, '1月1日', '不正な週は第1週として扱う');
  assert.equal(gameDate(-5).label, '1月1日', '負の週も第1週として扱う');
  assert.equal(gameDate(undefined).label, '1月1日', '未定義でも壊れない');
}

// 5. 画面に実際に描画される。ヘッダーと D-UI トップバーの両方で同じ日付を出す。
{
  const { ctx } = loadGame({ random: lcg(77) });
  const engine = ctx.__ct_engine, ui = ctx.__ct_ui;
  engine.g.configured = true;
  ui.showSetup = false;
  engine.g.selectedTab = 'home';
  for (let i = 0; i < 2; i += 1) engine.advanceWeek(false);
  const html = String(ctx.document.getElementById('app').innerHTML || '');
  const expected = ctx.__ct_engine ? modules.engine.gameDate(engine.g.week) : null;
  assert(html.includes(expected.fullLabel), `ヘッダーに ${expected.fullLabel} が表示される`);
  assert(html.includes(`第${engine.g.week}週`), '週番号も併記される（他画面が第N週表記のため）');
  assert(!/\d+か月目/.test(html), '「か月目」表記は残っていない');
}

// 6. 両方の表示箇所が gameDate を使っている（片方だけ古い表記に戻らないように）。
{
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  const shell = fs.readFileSync(path.join(ROOT, 'js/d-ui-shell.js'), 'utf8');
  assert(app.includes('engineModule.gameDate(g.week)'), 'app.js のヘッダーが gameDate を使う');
  assert(shell.includes('modules.engine.gameDate(g.week).label'),
    'd-ui-shell.js のトップバーが日付そのもの（.label）を主表示に使う');
  assert(!app.includes('${g.month}か月目'), 'app.js に旧「か月目」表記が残っていない');
  assert(!shell.includes('か月目'), 'd-ui-shell.js に旧「か月目」表記が残っていない');
}

console.log('game date display tests passed');
