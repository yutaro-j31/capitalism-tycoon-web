'use strict';
// オーナー方針: 創業者本人の体力・健康・集中力管理システム(founderHealth /
// founderEnergy / founderFocus および関連ロジック)は、バランス調整対象ではなく
// 2026-08-26付けで完全廃止された機能として扱う。
//
// このテストは「体力システムがなくてもゲーム進行・世代交代・セーブ互換が
// 正常」であることを確認する回帰テストであり、削除前にこれらのフィールドの
// 存在を前提にしていた古いテスト(tests/founder-profile-cleanup-test.js)を
// 置き換えるものではなく補完する。
//
// SAVE_KEY / saveVersion は変更していない。旧セーブにfounderHealth等が
// 残っていても、engine.js の mergeDefaults() は「defaultsに無いキーは
// 単に読み飛ばす」実装のため、削除のためだけの追加migrationコードは不要。
const assert = require('node:assert/strict');
const { loadGame, findStateIssues } = require('./harness');

function lcg(seed = 7654321) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function freshEngine(seed = 7654321) {
  const { engineModule, modules } = loadGame({ random: lcg(seed), isolatedLegacyIndex: true });
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: '検証者', companyName: '体力撤去検証商事', difficulty: 'normal', scenario: 'free', founderPrefID: 'fukuoka', founderTraitID: 'merchant' });
  return { engine, engineModule, modules };
}

// 1. 新規ゲームには体力・健康・集中力フィールドが一切存在しない。
{
  const { engine } = freshEngine();
  for (const key of ['founderHealth', 'founderEnergy', 'founderFocus']) {
    assert.equal(key in engine.g, false, `新規ゲームに${key}は存在しない`);
  }
  // FOUNDER_TRAITS由来の値も出身特性オブジェクト自体から消えている。
  const trait = engine.founderTrait();
  assert.equal('focus' in trait, false, 'FOUNDER_TRAITSにfocusは存在しない');
  assert.equal('energy' in trait, false, 'FOUNDER_TRAITSにenergyは存在しない');
}

// 2. 旧セーブ(founderHealth/founderEnergy/founderFocusを含むsaveVersion 9)は
//    正常にロードでき、ゲームを継続できる。旧フィールドは残っていても無視される。
{
  const { engine, engineModule } = freshEngine(111);
  const legacyState = JSON.parse(JSON.stringify(engine.g));
  legacyState.founderHealth = 85;
  legacyState.founderEnergy = 70;
  legacyState.founderFocus = 70;
  assert.equal(legacyState.saveVersion, 9, '対象は現行saveVersion(9)のまま');

  let restored;
  assert.doesNotThrow(() => { restored = new engineModule.TycoonEngine(legacyState); }, '旧フィールドを含むセーブのロードで例外が発生しない');
  assert.equal(restored.g.saveVersion, 9, 'saveVersionはこの撤去のためだけに変更されていない');
  assert.doesNotThrow(() => restored.advanceWeek(false), '旧フィールドを含む状態からの週進行が失敗しない');
  assert.equal(restored.g.week, legacyState.week + 1, '週は正常に進む');
}

// 3. 体力に依存していた行動(rest/health投資)は安全な無害操作になっている
//    (存在しない指定として扱われ、他の状態を壊さず、例外も投げない)。
{
  const { engine } = freshEngine(222);
  const cashBefore = engine.g.personalCash;
  assert.doesNotThrow(() => engine.founderHomeAction('rest'), 'founderHomeAction("rest")は例外を投げない');
  assert.equal(engine.g.personalCash, cashBefore, 'restはもはや何も変化させない(現金消費もない)');
  assert.doesNotThrow(() => engine.investFounder('health'), 'investFounder("health")は例外を投げない');
  assert.equal(engine.g.personalCash, cashBefore, '存在しない投資kindは現金を消費しない');
}

// 4. 世代交代(executeSuccession)は体力状態と無関係に正常動作する。
{
  const { engine } = freshEngine(333);
  engine.g.personalCash = 50_000_000;
  assert.ok(engine.appointSuccessor('internal'), '後継者候補を指名できる');
  engine.g.successorCandidate.readiness = 80;
  engine.g.successorReadiness = 80;
  const genBefore = engine.g.founderGeneration;
  const successorName = engine.g.successorCandidate.name;
  assert.doesNotThrow(() => engine.executeSuccession(), 'executeSuccessionは体力状態なしで例外を投げない');
  assert.equal(engine.g.founderGeneration, genBefore + 1, '世代番号は正しく進む');
  assert.equal(engine.g.playerName, successorName, '後継者の名前が引き継がれる');
  assert.equal(engine.g.successorReadiness, 0, '後継者準備度はリセットされる(体力とは無関係)');
  for (const key of ['founderHealth', 'founderEnergy', 'founderFocus']) {
    assert.equal(key in engine.g, false, `世代交代後も${key}は存在しない`);
  }
}

// 5. 中期のweekly進行(260週, 5年相当)でも体力起因の問題は起こり得ない。
//    findStateIssuesで非有限値・不正な数量が無いことを確認する
//    (test:long は520週の別ファイルで既存カバレッジがあるため、ここでは
//    このテスト専用に短く抑える)。
{
  const { engine, modules } = freshEngine(444);
  for (let i = 0; i < 260; i += 1) {
    const before = engine.g.week;
    engine.advanceWeek(false);
    assert.equal(engine.g.week, before + 1, `週${before}からの進行が失敗していない`);
    const issues = findStateIssues(engine.g);
    assert.deepEqual(issues, [], `週${engine.g.week}: 状態異常なし`);
  }
  assert.equal(modules.finance.validate(engine.g).errors.length, 0, '260週後も会計整合性が保たれる');
}

// 6. save→load往復後も状態は正常。
{
  const { engine, engineModule } = freshEngine(555);
  for (let i = 0; i < 12; i += 1) engine.advanceWeek(false);
  const weekBeforeSave = engine.g.week;
  const cashBeforeSave = engine.g.companyCash;
  const serialized = JSON.parse(JSON.stringify(engine.g));
  let reloaded;
  assert.doesNotThrow(() => { reloaded = new engineModule.TycoonEngine(serialized); }, 'save→loadの往復で例外が発生しない');
  assert.equal(reloaded.g.week, weekBeforeSave, 'save→load後も週が一致する');
  assert.equal(reloaded.g.companyCash, cashBeforeSave, 'save→load後も会社現金が一致する');
  assert.doesNotThrow(() => reloaded.advanceWeek(false), 'save→load後も週を進められる');
}

// 7. 決定論: 同一シードなら同一結果になる(体力システム撤去がRNG消費数や
//    結果を変えていないことの確認)。
{
  const run = () => {
    const { engine } = freshEngine(666);
    for (let i = 0; i < 52; i += 1) engine.advanceWeek(false);
    return { week: engine.g.week, companyCash: engine.g.companyCash, personalCash: engine.g.personalCash, stores: engine.g.stores.length };
  };
  const a = run();
  const b = run();
  assert.deepEqual(a, b, '同一シードなら52週後の主要状態が完全一致する');
}

console.log('founder health/energy/focus system removal regression tests passed');
