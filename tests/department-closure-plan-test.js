'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

// 「やめる」導線（部門閉鎖）の回帰テスト。establishDepartment() で部門を設置する手段は
// 以前からあったが、閉鎖する手段が画面にもエンジンにも存在しなかった（Coffee Inc 2化
// Phase 1、店舗閉店(PR #550)・個人不動産の開発中止(PR #551)に続く3件目）。
// ここで守りたい不変条件は「画面が予告した退職金と、実際に支払われる額が一致する」こと。
// 予告は engine.departmentClosurePlan()、実行は engine.closeDepartment() が担う。
// 両者は workforce.departmentSeverance()（さらにその内部の departmentWeeklyPayroll()／
// teamWeeklyCost()）という同じ1箇所だけを参照するため、片方だけ変えて画面と実挙動が
// ズレることを防いでいる。

function newGame() {
  const { modules } = loadGame();
  const engine = new modules.engine.TycoonEngine();
  engine.g.configured = true;
  engine.g.hasHeadOffice = true;
  engine.g.officeCapacity = 50;
  engine.g.companyCash = 100_000_000;
  engine.g.stores = [];
  engine.g.workforceMigrationV7Applied = true;
  return { modules, engine };
}

// 1. 予告した退職金と、実際の現金減少額が一致する（画面が嘘をつかないことの担保）。
// 追加採用でcorporatePayrollCohortsが積み上がった後でも一致することを確認する
// （averageWeeklySalaryだけを見ると採用直後にズレるバグを再発させないため）。
{
  const { engine } = newGame();
  assert.ok(engine.establishDepartment('accounting'), 'establishDepartment must succeed with 0 stores (investment route)');
  assert.ok(engine.hireDepartmentStaff('accounting', 2), 'hire 2 more staff');
  const plan = engine.departmentClosurePlan('accounting');
  assert.ok(plan, 'departmentClosurePlan must return a plan for an established department');
  assert.equal(plan.headcount, 3);
  assert.ok(plan.severance > 0, '在籍者がいれば退職金は0より大きい');

  const cashBefore = engine.g.companyCash;
  assert.ok(engine.closeDepartment('accounting'), 'closeDepartment must succeed');
  const actualCashChange = engine.g.companyCash - cashBefore;

  assert.equal(
    Math.round(-actualCashChange), Math.round(plan.severance),
    `予告した退職金と実際の現金減少が一致すること（予告 ${plan.severance} / 実際 ${-actualCashChange}）`
  );
  assert.equal(engine.g.departments.accounting, undefined, '閉鎖後は部門が消える');
  assert.equal(engine.g.departmentStaff.accounting, undefined, '閉鎖後はdepartmentStaffも消える');
  assert.equal(engine.g.officeFloors.some(f => f.departmentID === 'accounting'), false, '閉鎖後はofficeFloorsからも消える');
  console.log(`department closure plan: 予告 ${plan.severance} = 実測 ${-actualCashChange}`);
}

// 2. departmentClosurePlan() は読み取り専用（呼んだだけで状態が変わらない）。
{
  const { engine } = newGame();
  engine.establishDepartment('accounting');
  const snapshot = JSON.stringify(engine.g);
  engine.departmentClosurePlan('accounting');
  engine.departmentClosurePlan('accounting');
  assert.equal(JSON.stringify(engine.g), snapshot, 'departmentClosurePlan は状態を変更してはならない');
}

// 3. 存在しない部門IDへは null / false を返す（UI側の ?. と組み合わせて安全に描画できる）。
{
  const { engine } = newGame();
  assert.equal(engine.departmentClosurePlan('missing-department'), null);
  assert.equal(engine.departmentClosurePlan(undefined), null);
  assert.equal(engine.closeDepartment('missing-department'), false);
}

// 4. 進行中のキャンペーンは閉鎖時に中止され、使用済み予算は戻らない。
{
  const { engine } = newGame();
  engine.establishDepartment('accounting');
  assert.ok(engine.startCampaign('accounting', '広告', 1_000_000), 'campaign must start');
  const plan = engine.departmentClosurePlan('accounting');
  assert.equal(plan.activeCampaignCount, 1, '進行中キャンペーンが試算に反映される');
  engine.closeDepartment('accounting');
  assert.equal(engine.g.departmentCampaigns.filter(c => c.status === 'active').length, 0, '閉鎖でアクティブなキャンペーンは残らない');
  assert.equal(engine.g.departmentCampaigns[0].status, 'cancelled');
}

// 5. 退職金を支払う資金が無い場合は閉鎖できず、部門はそのまま残る。
{
  const { engine } = newGame();
  engine.establishDepartment('accounting');
  engine.hireDepartmentStaff('accounting', 5);
  const plan = engine.departmentClosurePlan('accounting');
  engine.g.companyCash = plan.severance - 1;
  assert.equal(engine.closeDepartment('accounting'), false, '退職金の資金が不足していれば閉鎖できない');
  assert.notEqual(engine.g.departments.accounting, undefined, '失敗時は部門が残っている');
}

// 6. 閉鎖後、workforce.validate() が「存在しない部門」エラーを出さない
// （閉鎖したチームのdepartmentIDをnullにクリアしていないと再発するリグレッション）。
{
  const { engine, modules } = newGame();
  engine.establishDepartment('accounting');
  engine.hireDepartmentStaff('accounting', 3);
  engine.closeDepartment('accounting');
  const result = modules.workforce.validate(engine.g);
  assert.equal(result.ok, true, `閉鎖後もvalidateは通ること: ${JSON.stringify(result.errors)}`);
}

// 7. 閉鎖後は同じ部門を再設置できる（トグル可能であること）。
{
  const { engine } = newGame();
  engine.establishDepartment('accounting');
  engine.closeDepartment('accounting');
  assert.ok(engine.establishDepartment('accounting'), '閉鎖後は再設置できる');
}

// 8. 実装が同じ関数（workforce.departmentSeverance）から退職金を導く一元管理であること。
// 片方だけ式を変えると画面の予告と実際の退職金が静かにズレるため、
// 別々の計算式が実装に紛れ込んでいないことをソースレベルで確認する。
{
  const engineSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'engine.js'), 'utf8');
  assert.match(engineSource, /departmentClosurePlan\(id\)\s*\{[\s\S]*?workforce\.departmentSeverance\(this\.g,id\)/, 'departmentClosurePlanはworkforce.departmentSeveranceを参照する');
  assert.match(engineSource, /closeDepartment\(id\)\s*\{[\s\S]*?workforce\.departmentSeverance\(this\.g,id\)/, 'closeDepartmentもworkforce.departmentSeveranceを参照する');
}

// 9. UI から到達できること。エンジンに実装があっても画面にボタンが無ければ
//    プレイヤーには存在しないのと同じ（store-closure-plan-test.jsのFinding Aと同じパターン）。
{
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /data-action="close-department"|'close-department'/, 'close-department アクションが app.js に存在する');
  assert.match(app, /case 'close-department':/, 'close-department がアクションスイッチで処理される');
  assert.match(app, /function confirmCloseDepartment/, '実行前に結果を提示する確認ダイアログを経由する');
  assert.doesNotMatch(app, /case 'close-department':engine\.closeDepartment\(/, 'close-department は確認なしで直接closeDepartment()を呼ばない');
}

console.log('department closure plan tests passed');
