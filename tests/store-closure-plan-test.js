'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 「やめる」導線（閉店）の回帰テスト。
// closeStore() 自体は以前から実装・テストされていたが、危機時の自動リストラ
// (js/player-crisis-restructuring.js) からしか呼ばれず、プレイヤーが能動的に
// 閉店する手段が画面に存在しなかった（UIUX監査 2026-08-26 の Finding A）。
// ここで守りたい不変条件は「画面が予告した結果と、実際に起きることが一致する」こと。
// 予告は engine.storeClosurePlan()、実行は engine.closeStore() が担う。

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function openedStore() {
  const { engineModule } = loadGame({ isolatedLegacyIndex: true, random: lcg(0x5109e01) });
  const engine = new engineModule.TycoonEngine();
  engine.configure({ playerName: 'T', companyName: 'T社', difficulty: 'normal', scenario: 'free', founderPrefID: 'tokyo', founderTraitID: 'merchant' });
  engine.g.companyCash += 200_000_000;
  const tenant = engine.g.tenants.find(t => t.prefID === 'tokyo' && t.businessID === 'ramen' && !t.occupiedBy);
  assert.ok(engine.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '閉店検証店', operatingHours: 3 }), 'store must open');
  for (let i = 0; i < 10; i++) engine.advanceWeek(false);
  return { engine, tenantID: tenant.id, tenantDeposit: tenant.deposit };
}

// 1. 予告が実際の入金と一致する（画面が嘘をつかないことの担保）。
{
  const { engine, tenantID, tenantDeposit } = openedStore();
  const store = engine.g.stores[0];
  const plan = engine.storeClosurePlan(store.id);
  assert.ok(plan, 'storeClosurePlan must return a plan for an existing store');
  assert.equal(plan.storeID, store.id);
  assert.equal(plan.forfeitedDeposit, tenantDeposit, '予告する没収保証金はテナントの保証金と一致する');

  const cashBefore = engine.g.companyCash;
  assert.ok(engine.closeStore(store.id), 'closeStore must succeed');
  const actualCashChange = engine.g.companyCash - cashBefore;

  assert.equal(
    Math.round(actualCashChange), Math.round(plan.proceeds),
    `予告した設備売却額と実際の現金増減が一致すること（予告 ${plan.proceeds} / 実際 ${actualCashChange}）`
  );
  assert.equal(Math.round(plan.netCashChange), Math.round(actualCashChange), 'netCashChangeも実測と一致する');
  // 保証金は返還されない＝現金には乗らない。予告文の「保証金は現金を伴いません」の根拠。
  assert.ok(
    actualCashChange < plan.forfeitedDeposit,
    '保証金は返還されないので、現金増加が保証金額を上回ることはない'
  );
  assert.equal(engine.g.stores.length, 0, '閉店後は店舗が消える');
  const tenant = engine.g.tenants.find(t => t.id === tenantID);
  assert.ok(!tenant.occupiedBy, '閉店するとテナントは空き物件に戻る');
  console.log(`store closure plan: 予告 ${plan.proceeds} = 実測 ${actualCashChange} / 保証金 ${plan.forfeitedDeposit} は没収`);
}

// 2. storeClosurePlan() は読み取り専用（呼んだだけで状態が変わらない）。
{
  const { engine } = openedStore();
  const store = engine.g.stores[0];
  const snapshot = JSON.stringify(engine.g);
  engine.storeClosurePlan(store.id);
  engine.storeClosurePlan(store.id);
  assert.equal(JSON.stringify(engine.g), snapshot, 'storeClosurePlan は状態を変更してはならない');
}

// 3. 存在しない店舗IDへは null を返す（UI側の ?. と組み合わせて安全に描画できる）。
{
  const { engine } = openedStore();
  assert.equal(engine.storeClosurePlan('missing-store-id'), null);
  assert.equal(engine.storeClosurePlan(undefined), null);
}

// 4. 実装の係数がひとつの定数から来ていること。closeStore() と storeClosurePlan() が
//    別々の数値を持つと、画面の予告と実際の入金が静かにズレる。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  assert.match(source, /const STORE_CLOSURE_SALVAGE_RATE\s*=/, '設備売却率は名前付き定数で定義する');
  const literalSalvage = source.match(/storeCost\s*\|\|\s*0\)\s*\*\s*\.15/);
  assert.equal(literalSalvage, null, 'closeStore() は生の .15 ではなく定数を参照すること');
}

// 5. UI から到達できること。エンジンに実装があっても画面にボタンが無ければ
//    プレイヤーには存在しないのと同じ（Finding A そのもの）。
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /data-action="close-store"|'close-store'/, 'close-store アクションが app.js に存在する');
  assert.match(app, /case 'close-store':/, 'close-store がアクションスイッチで処理される');
  assert.match(app, /function confirmCloseStore/, '実行前に結果を提示する確認ダイアログを経由する');
  // 確認を挟まず即実行してはならない（取り消せない操作のため）。
  assert.doesNotMatch(app, /case 'close-store':engine\.closeStore\(/, 'close-store は確認なしで直接 closeStore() を呼ばない');
}

console.log('store closure plan tests passed');
