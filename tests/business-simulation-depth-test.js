'use strict';

// 外部監査の指摘「業種間の深度差」への対応。
//
// market.js / supply.js / workforce.js はそれぞれ TARGET_BUSINESS_IDS（現状すべて ramen のみ）で
// 詳細モデルの対象業種を絞っており、対象外の業種は engine.js の旧売上式で動く。これは
// CLAUDE.md が定めた意図的な段階導入であって、バグではない。実際の問題は
// 「その差がプレイヤーに一切開示されていない」ことだった:
//
//   - js/app.js の業種セレクト3か所（テナント出店・事業ポートフォリオ・海外進出）は
//     素の <option> で、ramen だけが詳細対象であることが選択時点で分からない
//   - 唯一の注記は renderMarketInsightSection() の「ラーメンのみ」という副題で、
//     これは出店した後にしか見えない画面にある
//
// そこで engine.businessSimulationDepth() が3つのリストを実際に読んで深度を導出する。
// リストを直接読むので、業種を1つずつ詳細化していけばラベルは自動的に追従し、
// 途中の「一部詳細」状態も正しく表示される。TARGET_BUSINESS_IDS 自体は変更していない。

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }
const newGame = (seed = 190826041) => loadGame({ random: lcg(seed) });

// 1. 詳細対象の ramen は3システムすべてが詳細。
{
  const { modules } = newGame();
  const depth = modules.engine.businessSimulationDepth('ramen');

  assert.equal(depth.level, 'detailed', 'ramenは詳細シミュレーション');
  assert.equal(depth.detailedCount, 3, '市場・仕入・人員配置の3システムすべてが詳細');
  assert.equal(depth.label, '詳細シミュレーション');
  assert.ok(depth.systems.every(s => s.detailed), '個別システムもすべてdetailed');
}

// 2. 対象外の業種は簡易。ここが監査の指摘そのもの。
{
  const { modules } = newGame();
  for (const businessID of ['cafe', 'conveni', 'bookstore', 'gym']) {
    const depth = modules.engine.businessSimulationDepth(businessID);
    assert.equal(depth.level, 'simple', `${businessID}は簡易シミュレーション`);
    assert.equal(depth.detailedCount, 0, `${businessID}は詳細システムを持たない`);
    assert.equal(depth.label, '簡易シミュレーション');
    assert.ok(depth.summary.includes('簡易式'), `${businessID}の説明に簡易式であることが出る`);
  }
}

// 3. 実際のリストから導出していること。ハードコードなら業種を足しても変わらないので、
//    ここで市場だけ対象を広げて「一部詳細」に変わることを確かめる。
//    （TARGET_BUSINESS_IDS はfrozenなので、この検証はモジュールを差し替えて行う。）
{
  const { modules } = newGame();
  const before = modules.engine.businessSimulationDepth('cafe');
  assert.equal(before.level, 'simple', '前提: cafeは初期状態で簡易');

  const original = modules.market.TARGET_BUSINESS_IDS;
  Object.defineProperty(modules.market, 'TARGET_BUSINESS_IDS', { value: Object.freeze(['ramen', 'cafe']), configurable: true });
  try {
    const partial = modules.engine.businessSimulationDepth('cafe');
    assert.equal(partial.level, 'partial', '市場だけ対象になったら「一部詳細」になる');
    assert.equal(partial.detailedCount, 1, '詳細システムは1つ');
    assert.equal(partial.label, '一部詳細');
    assert.equal(partial.systems.find(s => s.key === 'market').detailed, true, '市場が詳細');
    assert.equal(partial.systems.find(s => s.key === 'supply').detailed, false, '仕入はまだ簡易');
    assert.ok(partial.summary.includes('のみ詳細'), '一部詳細であることが説明に出る');
  } finally {
    Object.defineProperty(modules.market, 'TARGET_BUSINESS_IDS', { value: original, configurable: true });
  }

  assert.equal(modules.engine.businessSimulationDepth('cafe').level, 'simple', '復元後は元の判定に戻る');
}

// 4. 存在しない・不正な業種IDでも壊れない。
{
  const { modules } = newGame();
  for (const bad of [undefined, null, '', 'does-not-exist', 123]) {
    const depth = modules.engine.businessSimulationDepth(bad);
    assert.equal(depth.level, 'simple', `${String(bad)}は簡易として扱う`);
    assert.equal(depth.systems.length, 3, `${String(bad)}でもシステム一覧は3件`);
  }
}

// 5. 読み取り専用であること。ゲーム状態を触らず、RNGも消費しない。
{
  const { modules, ctx } = newGame();
  const engine = ctx.__ct_engine;
  engine.g.configured = true;

  const before = JSON.stringify(engine.g);
  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try {
    for (const b of engine.g.businesses) modules.engine.businessSimulationDepth(b.id);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(randomCalls, 0, 'businessSimulationDepthはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'ゲーム状態を変更しない');
}

// 6. 返り値がfrozenで、呼び出し側が壊せない。
{
  const { modules } = newGame();
  const depth = modules.engine.businessSimulationDepth('ramen');
  assert.ok(Object.isFrozen(depth), '返り値はfrozen');
  assert.ok(Object.isFrozen(depth.systems), 'systemsもfrozen');
  assert.ok(depth.systems.every(Object.isFrozen), '各systemもfrozen');
}

// 7. UI配線: 業種セレクト3か所すべてが深度ラベル付きのbusinessOptsを使っている。
//    素のoptsに戻ると出店時点での開示が消えるので、ここで固定する。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  assert.equal(
    (source.match(/businessOpts\(g\.businesses,ui\.selectedBusiness\)/g) || []).length, 3,
    '業種セレクト3か所（テナント出店・事業ポートフォリオ・海外進出）がbusinessOptsを使う'
  );
  assert.equal(
    (source.match(/[^s]opts\(g\.businesses,ui\.selectedBusiness\)/g) || []).length, 0,
    '深度ラベルなしの素のoptsが業種セレクトに残っていない'
  );
  assert.match(source, /businessOpts\s*=\s*\(items,value\)\s*=>[\s\S]{0,400}businessSimulationDepth/, 'businessOptsはengineの深度導出を使う');
  assert.match(source, /businessDepthNote\(depth\)/, '業種カードに深度の注記を出す');
}

// 8. css/app.css を触らずに済ませていること（バイト一致要件）。既存クラスだけで組む。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const note = source.slice(source.indexOf('function businessDepthNote'), source.indexOf('function renderBusiness'));
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');

  for (const className of note.match(/class="([a-z- ]+)"/g) || []) {
    for (const name of className.replace(/class="|"/g, '').split(/\s+/).filter(Boolean)) {
      if (name === 'hint') continue; // 既存の未スタイルクラス（app.js内で既に9か所使用）
      assert.ok(css.includes(`.${name}`), `businessDepthNoteが使う .${name} はcss/app.cssに既存`);
    }
  }
}

console.log('business simulation depth tests passed');
