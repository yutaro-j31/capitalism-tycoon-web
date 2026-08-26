const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame, ROOT } = require('./harness');

function lcg(seed = 4242) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function screen(tab, seed = 4242) {
  const { ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine, ui = ctx.__ct_ui;
  assert(engine && ui, 'harness exposes engine and ui');
  const read = () => String(ctx.document.getElementById('app').innerHTML || '');
  if (tab === 'setup') return { engine, ui, html: read() };
  engine.g.configured = true;
  ui.showSetup = false;
  engine.g.selectedTab = tab;
  engine.advanceWeek(false);
  return { engine, ui, html: read() };
}

// 1. ゲーム結果に影響する出身地の選択欄は残っている。
{
  const { html } = screen('setup');
  assert(html.includes('name="founderPrefID"'), 'セットアップに出身地セレクタが残っている');
  assert(html.includes('出身地'), 'セットアップに「出身地」の見出しが残っている');
}

// 2. 創業者プロフィールから、結果に影響しない指標だけが消えている。
{
  const { html } = screen('founder');
  // 指標としての表示が消えていること。「人脈を作る」は交渉スキルを上げる実効のある
  // 行動なので残す（同じ語を含むため、指標表示の形で判定する）。
  for (const word of ['体力', '集中力', '健康', '政策影響力']) {
    assert(!html.includes(word), `創業者画面に「${word}」が残っていない`);
  }
  for (const label of ['教育', '人脈']) {
    assert(!html.includes(`<span>${label}</span>`), `創業者画面に指標「${label}」が残っていない`);
  }
  for (const word of ['出身', '地元信用']) {
    assert(html.includes(word), `創業者画面に意味のある「${word}」が残っている`);
  }
}

// 3. 実際に効いている指標・行動は残っている。
//    スキル4種は市場・製品・交渉に効き、財団評価は legacyScore に、
//    後継者準備度は引退条件に効くため削除しない。
{
  const { html } = screen('founder');
  for (const word of ['経営スキル', '技術スキル', '金融スキル', '交渉スキル', '財団評価']) {
    assert(html.includes(word), `創業者画面に「${word}」が残っている`);
  }
  for (const kind of ['storeHunt', 'localEvent', 'studyBusiness', 'studyTech', 'studyFinance', 'network']) {
    assert(html.includes(`data-kind="${kind}"`), `行動「${kind}」が残っている`);
  }
  for (const kind of ['successor', 'foundation']) {
    assert(html.includes(`data-kind="${kind}"`), `自己投資「${kind}」が残っている`);
  }
}

// 4. 何も起こさない行動・投資ボタンは消えている。
//    休息は体力/集中力/健康しか動かさず、その3つはどこからも読まれない。
//    健康・教育・人脈・ロビー投資も同様に、現金を払うだけで結果が変わらなかった。
{
  const { html } = screen('founder');
  for (const kind of ['rest', 'health', 'education', 'lobby']) {
    assert(!html.includes(`data-kind="${kind}"`), `効果のない操作「${kind}」が消えている`);
  }
}

// 5. 出身地は地元信用・製品の初期ブランド・テナント探索の対象県に効くため、
//    内部状態・選択UI・結果表示すべて温存する。
{
  const { engine } = screen('founder');
  assert(engine.g.founderHomePrefID, '出身地の内部値は保持される');
  assert(engine.g.founderHomePrefName, '出身地名の内部値は保持される');
  assert(typeof engine.g.localReputationByPref === 'object', '地元信用の内部値は保持される');
}

// 5b. 体力・健康・集中力管理システムは2026-08-26に完全廃止（UI表示だけでなく
//     内部状態・weekly処理・行動も撤去）。新規ゲームにはこれらのフィールド自体が
//     存在しない（tests/founder-health-system-removal-test.js に詳細な回帰テストを分離）。
{
  const { engine } = screen('founder');
  assert(!('founderEnergy' in engine.g), 'founderEnergyは新規ゲームに存在しない');
  assert(!('founderHealth' in engine.g), 'founderHealthは新規ゲームに存在しない');
  assert(!('founderFocus' in engine.g), 'founderFocusは新規ゲームに存在しない');
}

// 6. 非UIの既存呼び出しが出身地を省略しても既定値で開始できる。
{
  const { ctx, modules: mods } = loadGame({ random: lcg(31) });
  const engine = ctx.__ct_engine;
  const expectedDefaultPref = engine.g.selectedPref;
  engine.configure({ playerName: '既定', companyName: '既定', difficulty: 'normal', scenario: 'standard' });
  // setFounderOrigin 側にも prefs[0] の保険があるため、意図した既定値を明示的に固定する。
  assert(engine.g.founderHomePrefID, '出身地未指定でも既定値が入る');
  assert.equal(engine.g.founderHomePrefID, expectedDefaultPref,
    '出身地は選択中の県を既定として採用する');
  assert(engine.g.configured, '出身地未指定でも創業できる');
  for (let i = 0; i < 12; i += 1) engine.advanceWeek(false);
  assert.equal(engine.g.week, 13, '出身地未指定でも週を進められる');
  assert(mods.finance.validate(engine.g).ok, '会計整合性が保たれる');
}

// 7. 出身地を明示指定する既存の呼び出しは引き続き有効（テストやセーブが依存している）。
{
  const { ctx } = loadGame({ random: lcg(32) });
  const engine = ctx.__ct_engine;
  engine.configure({ playerName: '指定', companyName: '指定', difficulty: 'normal', scenario: 'standard', founderPrefID: 'fukuoka', founderTraitID: 'merchant' });
  assert.equal(engine.g.founderHomePrefID, 'fukuoka', 'configure の founderPrefID は今も効く');
}

// 8. 意味のある出身地UIは残し、効果のない表示だけが消えている。
{
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
  assert(app.includes('name="founderPrefID"'), 'app.js に出身地セレクタが残る');
  assert(!app.includes("stat('体力'"), 'app.js に体力の表示が無い');
  assert(!app.includes("stat('集中力'"), 'app.js に集中力の表示が無い');
  assert(!app.includes("stat('健康'"), 'app.js に健康の表示が無い');
  assert(app.includes("stat('地元信用'"), 'app.js に地元信用の表示が残る');
  assert(!app.includes("stat('政策影響力'"), 'app.js に政策影響力の表示が無い');
  assert(app.includes("stat('財団評価'"), 'app.js に財団評価の表示は残る');
}

console.log('founder profile cleanup tests passed');
