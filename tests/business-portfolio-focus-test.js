'use strict';

// 事業画面の「0店舗業種の整理」（外部監査P3）。
//
// ゲーム開始時、事業画面には30業種すべてが同じ見た目の空カードとして並んでいた
// （全業種が 0店・週次利益¥0・同一のプレースホルダKPI）。実測すると:
//
//   業種総数            30
//   初期資金で出店可能  17（最安の空きテナントの保証金で判定）
//   詳細シミュレーション 1（ramen のみ）
//
// つまり「今なにを選べるのか」が画面から一切読み取れない状態だった。
//
// engine.businessPortfolio() が運営中と未出店を分け、未出店側を「今すぐ出店できるか」
// →「安い順」で並べ替える。業種そのものは1つも隠さない（資金が増えれば可否は変わるため）。
// 表示は app.js が行い、計算はここに集約する。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 190826041) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

const freeTenant = engine => engine.g.tenants.find(t => !t.occupiedBy);

// 1. 開始時は全業種が未出店で、業種は1つも失われない。
{
  const { engine } = newGame();
  const p = engine.businessPortfolio();

  assert.equal(p.counts.total, engine.g.businesses.length, '業種総数が一致する');
  assert.equal(p.counts.operating, 0, '開始時は運営中が0');
  assert.equal(p.counts.idle, engine.g.businesses.length, '開始時は全業種が未出店');
  assert.equal(p.operating.length + p.idle.length, engine.g.businesses.length, '運営中と未出店の合計＝全業種（隠さない）');

  const ids = new Set([...p.operating, ...p.idle].map(r => r.businessID));
  for (const b of engine.g.businesses) assert.ok(ids.has(b.id), `${b.id}が欠落していない`);
}

// 2. 回帰の本体: 「今すぐ出店できる業種」が全体より明確に少なく、かつ判別できる。
//    ここが分からないことが、30枚の同じカードが並ぶ問題の中身だった。
{
  const { engine } = newGame();
  const p = engine.businessPortfolio();

  assert.ok(p.counts.affordableIdle > 0, '出店できる業種が存在する');
  assert.ok(p.counts.affordableIdle < p.counts.idle, '出店できる業種は全業種より少ない（区別に意味がある）');

  for (const row of p.idle) {
    assert.equal(row.affordable, engine.g.companyCash >= row.minimumUpfront, `${row.businessID}: affordableは会社資金と最低必要額の比較と一致する`);
    if (row.affordable) assert.equal(row.shortfall, 0, `${row.businessID}: 出店可能なら不足額0`);
    else assert.equal(row.shortfall, row.minimumUpfront - engine.g.companyCash, `${row.businessID}: 不足額が読める`);
  }
}

// 3. 最低必要額は「設備費＋最安の空きテナントの保証金」。特定テナントではなく
//    「どこかに出せるか」で判定するのが正しい意味づけ。
{
  const { engine } = newGame();
  const p = engine.businessPortfolio();

  const deposits = engine.g.tenants.filter(t => !t.occupiedBy).map(t => t.deposit);
  assert.equal(p.minimumDeposit, Math.min(...deposits), '最安の空きテナントの保証金を使う');
  assert.equal(p.hasFreeTenant, true, '前提: 空きテナントがある');

  for (const row of p.idle) {
    const business = engine.business(row.businessID);
    assert.equal(row.minimumUpfront, business.storeCost + p.minimumDeposit, `${row.businessID}: 最低必要額＝設備費＋最安保証金`);
  }
}

// 4. 未出店の並び順: 出店可能が先、その中では安い順。
{
  const { engine } = newGame();
  const p = engine.businessPortfolio();

  const firstLocked = p.idle.findIndex(r => !r.affordable);
  if (firstLocked >= 0) {
    assert.ok(p.idle.slice(firstLocked).every(r => !r.affordable), '出店可能な業種が資金不足の業種より後ろに来ない');
  }
  const affordable = p.idle.filter(r => r.affordable);
  for (let i = 1; i < affordable.length; i++) {
    assert.ok(affordable[i].minimumUpfront >= affordable[i - 1].minimumUpfront, '出店可能な業種は安い順');
  }
}

// 5. 出店すると運営中へ移り、未出店から外れる。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 }), true);

  const store = engine.g.stores.at(-1);
  while (engine.g.week < store.openingWeek + 2) assert.notEqual(engine.advanceWeek(false), false);

  const p = engine.businessPortfolio();
  assert.equal(p.counts.operating, 1, '運営中が1件になる');
  assert.equal(p.operating[0].businessID, 'ramen');
  assert.equal(p.operating[0].openStoreCount, 1, '営業中店舗数が数えられる');
  assert.ok(p.operating[0].weeklyProfit !== 0, '運営中は実績の週次利益を持つ');
  assert.ok(!p.idle.some(r => r.businessID === 'ramen'), 'ramenは未出店側から外れる');
  assert.equal(p.counts.total, engine.g.businesses.length, '総数は変わらない');
}

// 6. 閉店した店舗しか無い業種は未出店側に戻る（運営中に居座らない）。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '1号店', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (engine.g.week < store.openingWeek + 1) engine.advanceWeek(false);

  assert.equal(engine.businessPortfolio().counts.operating, 1, '前提: 運営中1件');
  store.status = 'closed';
  const p = engine.businessPortfolio();
  assert.equal(p.counts.operating, 0, '閉店のみの業種は運営中に数えない');
  assert.ok(p.idle.some(r => r.businessID === 'ramen'), '未出店側へ戻る');
}

// 7. 運営中は週次利益の降順（稼ぎ頭が先頭）。
{
  const { engine } = newGame();
  for (const businessID of ['ramen', 'cafe']) {
    const tenant = freeTenant(engine);
    engine.openStore({ tenantID: tenant.id, businessID, name: `${businessID}店`, operatingHours: 3 });
  }
  const last = engine.g.stores.at(-1);
  while (engine.g.week < last.openingWeek + 3) engine.advanceWeek(false);

  const p = engine.businessPortfolio();
  assert.equal(p.counts.operating, 2, '2業種が運営中');
  assert.ok(p.operating[0].weeklyProfit >= p.operating[1].weeklyProfit, '週次利益の降順');
}

// 8. 資金が増えると出店できる業種が増える（判定が会社資金に追従する）。
{
  const { engine } = newGame();
  const before = engine.businessPortfolio().counts.affordableIdle;
  engine.g.companyCash = 500_000_000;
  const after = engine.businessPortfolio();
  assert.ok(after.counts.affordableIdle > before, '資金を増やすと出店できる業種が増える');
  assert.equal(after.counts.affordableIdle, after.counts.idle, '十分な資金なら全業種が出店可能になる');
}

// 9. 空きテナントが無いときは、どの業種も出店可能にしない。
{
  const { engine } = newGame();
  for (const tenant of engine.g.tenants) tenant.occupiedBy = 'competitor';
  const p = engine.businessPortfolio();
  assert.equal(p.hasFreeTenant, false, '空きテナントなしを検出する');
  assert.equal(p.counts.affordableIdle, 0, '空きテナントが無ければ出店可能な業種は0');
}

// 10. 読み取り専用であること。RNGを消費せず、状態も変えない。
{
  const { engine } = newGame();
  const before = JSON.stringify(engine.g);

  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try { engine.businessPortfolio(); engine.businessPortfolio(); }
  finally { Math.random = originalRandom; }

  assert.equal(randomCalls, 0, 'businessPortfolioはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'ゲーム状態を変更しない');
}

// 11. 返り値がfrozenで、呼び出し側が壊せない。
{
  const { engine } = newGame();
  const p = engine.businessPortfolio();
  assert.ok(Object.isFrozen(p), '返り値はfrozen');
  assert.ok(Object.isFrozen(p.idle) && Object.isFrozen(p.operating) && Object.isFrozen(p.counts), '配列とcountsもfrozen');
  assert.ok(p.idle.every(Object.isFrozen), '各行もfrozen');
}

// 12. UI配線: 事業画面が businessPortfolio を使い、運営中と未出店を分けて描く。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const block = source.slice(source.indexOf('function businessFullCard'), source.indexOf('${renderFranchiseSection()}`;'));

  assert.match(block, /const portfolio=engine\.businessPortfolio\(\)/, '事業画面はengineの集計を使う（app.js側で再計算しない）');
  assert.match(block, /運営中の事業/, '運営中の事業セクションを出す');
  assert.match(block, /出店できる業種/, '出店できる業種セクションを出す');
  assert.match(block, /資金が足りない業種/, '資金不足の業種は折りたたんで出す');
  assert.match(block, /portfolio\.operating\.map/, '運営中は完全版カードで描く');
  assert.match(block, /businessIdleRow/, '未出店は1行に圧縮して描く');
  assert.match(block, /row\.shortfall/, '資金不足なら不足額を出す');
}

// 13. css/app.css を触らずに済ませていること（バイト一致要件）。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');
  const block = source.slice(source.indexOf('function businessFullCard'), source.indexOf('${renderFranchiseSection()}`;'));

  for (const attr of block.match(/class="([a-z- ]+)"/g) || []) {
    for (const name of attr.replace(/class="|"/g, '').split(/\s+/).filter(Boolean)) {
      if (name === 'hint') continue; // 既存の未スタイルクラス
      assert.ok(css.includes(`.${name}`), `事業画面が使う .${name} はcss/app.cssに既存`);
    }
  }
}

console.log('business portfolio focus tests passed');
