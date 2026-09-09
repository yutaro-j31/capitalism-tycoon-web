'use strict';

// PE mode T19 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §6.5): 人脈ノードの生成結線.
// Uses the full VM harness because js/pe-network-sourcing.js wraps contractSupplier (installed
// by js/expansion.js's installExpansion, which js/app.js calls) and exitPEPortfolioCompany.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGame } = require('./harness');

function makeRandom(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }
function freshLoad(seed) { return loadGame({ random: makeRandom(seed), isolatedLegacyIndex: true }); }

const main = freshLoad(41);
const { engineModule, modules } = main;
const pn = modules.peNetwork, ns = modules.peNetworkSourcing, pf = modules.peFund, ds = modules.peDealSupply, ops = modules.pePortfolioOperations;

function newGame(handles = main) {
  const e = new handles.engineModule.TycoonEngine();
  e.configure({ playerName: 'S', companyName: 'S商事', difficulty: 'normal' });
  return e;
}
function nodesOf(e) { pn.ensure(e.g); return e.g.peNetwork.nodes; }

// 1. モジュールが登録され、フックが実際にprototypeへ入っている。
{
  assert.ok(ns && ns.__installed, 'peNetworkSourcing module must be registered');
  assert.equal(engineModule.TycoonEngine.prototype.__peNetworkSourcingInstalled, true);
  assert.equal(typeof engineModule.TycoonEngine.prototype.contactPENetworkNode, 'function');
}

// 2. 完了条件: 各供給源（設計書§6.5の表）からノードが生成される。
//    純関数側を直接確認し、属性（経路・業種・地域）が表のとおりであることを見る。
{
  const e = newGame();
  e.g.selectedPref = 'tokyo';
  const supplier = ns.onSupplierContract(e.g, { offerID: 'offer-1', businessID: 'ramen', week: 5 });
  assert.equal(supplier.sourceType, ns.SOURCE_TYPES.supplier);
  assert.equal(supplier.pathType, 'longTermCultivation');
  assert.equal(supplier.industryTag, 'ramen');
  assert.equal(supplier.regionTag, 'tokyo');
  const owner = ns.onTenantContract(e.g, { tenantID: 'tenant-9', prefID: 'osaka', week: 6 });
  assert.equal(owner.sourceType, ns.SOURCE_TYPES.buildingOwner);
  assert.equal(owner.industryTag, 'realEstate');
  assert.equal(owner.regionTag, 'osaka');
  const banker = ns.onBankLoan(e.g, { account: 'company', prefID: 'tokyo', week: 7 });
  assert.equal(banker.sourceType, ns.SOURCE_TYPES.bankBranchManager);
  assert.equal(banker.pathType, 'referrer');
  assert.equal(banker.industryTag, 'finance');
  const exec = ns.onExecutiveHire(e.g, { candidateID: 'exec-3', role: 'CFO', week: 8 });
  assert.equal(exec.sourceType, ns.SOURCE_TYPES.formerExecutive);
  assert.ok(ns.EXECUTIVE_BACKGROUND_INDUSTRIES.includes(exec.industryTag), '前職の業種が付く');
  const president = ns.onPortfolioExit(e.g, { dealID: 'deal-1', industryTag: 'gym', week: 9 });
  assert.equal(president.sourceType, ns.SOURCE_TYPES.portfolioManagement);
  assert.equal(president.pathType, 'portfolioReferral');
  assert.equal(president.industryTag, 'gym');
  const underwriter = ns.onIPO(e.g, { market: '東証グロース', week: 10 });
  assert.equal(underwriter.sourceType, ns.SOURCE_TYPES.ipoUnderwriter);
  assert.ok(underwriter.trust >= ns.UNDERWRITER_TRUST_MIN && underwriter.trust <= ns.UNDERWRITER_TRUST_MAX, '主幹事担当は仕事上の付き合いとして高めから始まる');
  assert.equal(nodesOf(e).length, 6, '6つの供給源すべてからノードが増える');
  for (const node of nodesOf(e)) assert.ok(node.trust > 0 && node.trust < 100);
}

// 3. 同じ相手は二重に人脈へ入らない（同じ支店から何度借りても支店長は1人）。
{
  const e = newGame();
  ns.onBankLoan(e.g, { account: 'company', prefID: 'tokyo', week: 1 });
  assert.equal(ns.onBankLoan(e.g, { account: 'company', prefID: 'tokyo', week: 20 }), null, '同じ支店は1人まで');
  assert.equal(nodesOf(e).length, 1);
  ns.onBankLoan(e.g, { account: 'company', prefID: 'osaka', week: 21 });
  assert.equal(nodesOf(e).length, 2, '別の地域なら別の支店長');
}

// 4. 完了条件: 経営を進めるとノードが自然に増える（production path のフック経由）。
{
  const e = newGame();
  const before = nodesOf(e).length;
  // 銀行借入（既存アクション）→ 支店長
  assert.equal(e.borrow(1_000_000, 'company'), true);
  assert.equal(nodesOf(e).length, before + 1, '借入で支店長が人脈に入る');
  assert.equal(nodesOf(e)[nodesOf(e).length - 1].sourceType, ns.SOURCE_TYPES.bankBranchManager);
  // 出店（テナント契約）→ ビルオーナー
  const tenant = e.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, 'sanity: an empty tenant must exist');
  e.g.companyCash = 500_000_000;
  const nodesBeforeStore = nodesOf(e).length;
  assert.equal(e.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '一号店' }), true);
  assert.equal(nodesOf(e).length, nodesBeforeStore + 1, '出店でビルオーナーが人脈に入る');
  assert.equal(nodesOf(e)[nodesOf(e).length - 1].sourceType, ns.SOURCE_TYPES.buildingOwner);
  // 失敗したアクションでは人脈は増えない。
  const nodesNow = nodesOf(e).length;
  assert.equal(e.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '二号店' }), false);
  assert.equal(nodesOf(e).length, nodesNow, '失敗した出店では人脈は増えない');
}

// 5. Exit先の経営陣（T17のExit経路から）。
{
  const e = newGame();
  e.g.personalCash = 30_000_000_000;
  const fund = pf.createFund(e.g, { size: 200_000_000_000, terms: { fee: .02, carry: .2, hurdle: .08 }, y0: 1 });
  const deal = ops.acquirePillarCompany(e.g, fund.id, { businessID: 'ramen', enterpriseValue: 10_000_000_000, week: 1 });
  const before = nodesOf(e).length;
  assert.equal(e.exitPEPortfolioCompany(fund.id, deal.id, { method: 'sale' }), true);
  const added = nodesOf(e)[nodesOf(e).length - 1];
  assert.equal(nodesOf(e).length, before + 1, 'Exitで買収先の社長が人脈に入る');
  assert.equal(added.sourceType, ns.SOURCE_TYPES.portfolioManagement);
  assert.equal(added.industryTag, 'ramen');
}

// 6. 完了条件: 週次アクション枠（2回）が消費される。
{
  const e = newGame();
  const node = pn.addNode(e.g, { sourceType: 'x', pathType: 'referrer', week: 1, trust: 20 });
  assert.equal(pn.weeklyActionsRemaining(e.g, e.g.week), pn.WEEKLY_ACTIONS);
  const trustBefore = node.trust;
  assert.equal(e.contactPENetworkNode(node.id), true);
  assert.equal(pn.weeklyActionsRemaining(e.g, e.g.week), pn.WEEKLY_ACTIONS - 1, '接触は枠を1つ消費する');
  assert.ok(node.trust > trustBefore, '接触で信頼度が上がる');
  assert.equal(e.contactPENetworkNode(node.id), true);
  assert.equal(pn.weeklyActionsRemaining(e.g, e.g.week), 0);
  const trustAtCap = node.trust;
  assert.equal(e.contactPENetworkNode(node.id), false, '枠を使い切ったら接触できない');
  assert.equal(node.trust, trustAtCap, '拒否された接触は状態を変えない');
  e.advanceWeek(false);
  assert.equal(pn.weeklyActionsRemaining(e.g, e.g.week), pn.WEEKLY_ACTIONS, '週が変われば枠は戻る');
  assert.equal(e.contactPENetworkNode('does-not-exist'), false, '存在しない相手には接触できない');
}

// 7. 完了条件: 独占案件が実際に供給される（T16の供給経路に接続されている）。
{
  const e = newGame();
  e.g.departments.investment = { established: true };
  e.g.departmentStaff.investment = 9;
  e.g.companyCash = 50_000_000_000;
  pf.recordExit(e.g, { exitType: 'buyout', realizedAmount: 200_000_000, investedAmount: 8_000_000, foundedWeek: 1, exitedWeek: 52 });
  e.g.personalCash = 30_000_000_000;
  const size = pf.formableFundSize(e.g);
  pf.createFund(e.g, { size, terms: pf.fundTermsForScore(e.g.peFirm.trackRecord.score), y0: e.g.week });
  // 信頼度100の長期育成ノードを複数持てば、いずれかの供給週で独占案件が持ち込まれる。
  for (let i = 0; i < 6; i++) pn.addNode(e.g, { sourceType: 'x', pathType: 'longTermCultivation', week: 1, trust: 100 });
  let monopoly = null;
  for (let i = 0; i < 260 && !monopoly; i++) {
    e.advanceWeek(false);
    monopoly = e.g.acquisitionTargets.find(t => t?.dealChannel === 'monopoly') || null;
    // trustは独占のたびに消費されるので、育て直しの代わりにここで補充する（供給の有無を見るテスト）。
    for (const n of nodesOf(e)) n.trust = 100;
  }
  assert.ok(monopoly, '独占案件が実際に板へ供給される');
  assert.ok(monopoly.peSourceNodeID, '独占案件は持ち込んだ人脈ノードを記録する');
  assert.equal(ds.isPETarget(monopoly), true);
  assert.ok(monopoly.friendly, '独占案件は競争入札にならない');
}

// 8. 完了条件: 独占比率が1案件あたり40%を超えない。
{
  // monopolyProbability は経路・信頼度をどう振っても MAX_MONOPOLY_SHARE を超えない。
  for (const pathType of pn.PATH_TYPE_IDS) {
    for (let trust = 0; trust <= 100; trust += 5) {
      const p = pn.monopolyProbability({ pathType, trust });
      assert.ok(p <= pn.MAX_MONOPOLY_SHARE + 1e-12, `${pathType}/${trust} の独占確率が上限を超えた: ${p}`);
      assert.ok(p >= 0);
    }
  }
  assert.equal(pn.monopolyProbability({ pathType: 'longTermCultivation', trust: pn.MONOPOLY_TRUST_THRESHOLD - 1 }), 0, '信頼度が足りなければ独占はゼロ');
  // 実測でも1案件あたりの独占率が40%を超えない（同一ノード・同一週・案件シードだけを変える）。
  const e = newGame();
  const node = pn.addNode(e.g, { sourceType: 'x', pathType: 'longTermCultivation', week: 1, trust: 100 });
  let hits = 0;
  const trials = 400;
  for (let i = 0; i < trials; i++) { node.trust = 100; if (pn.rollMonopolySourcing(e.g, node.id, 10, `deal-${i}`)) hits++; }
  const rate = hits / trials;
  assert.ok(rate <= pn.MAX_MONOPOLY_SHARE + .05, `実測の独占率が上限を大きく超えた: ${rate}`);
  assert.ok(rate > 0, 'sanity: 独占はときどき起きる');
}

// 9. 完了条件: 同一seedでノード生成が完全に一致する。
{
  const run = (handles) => {
    const e = newGame(handles);
    e.g.companyCash = 500_000_000;
    e.borrow(1_000_000, 'company');
    const tenant = e.g.tenants.find(t => !t.occupiedBy);
    e.openStore({ tenantID: tenant.id, businessID: 'ramen', name: '一号店' });
    for (let i = 0; i < 30; i++) e.advanceWeek(false);
    return JSON.stringify(e.g.peNetwork);
  };
  assert.equal(run(freshLoad(77)), run(freshLoad(77)), '同一seedなら人脈はバイト単位で一致する');
}

// 10. 旧セーブ互換 & 決定論の絶対条件。
{
  const e = newGame();
  delete e.g.peNetwork;
  e.normalize();
  // 長さで見る: ゲーム側の配列は別realm由来なので、assert/strict の deep 比較は
  // プロトタイプ違いで落ちる。
  assert.equal(e.g.peNetwork.nodes.length, 0, '人脈欄が無いセーブでも安全に初期化される');
  e.borrow(1_000_000, 'company');
  assert.equal(e.g.peNetwork.nodes.length, 1);
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'pe-network-sourcing.js'), 'utf8');
  for (const banned of ['Math' + '.random', 'Date' + '.now', 'randomUUID']) {
    assert.equal(src.includes(banned), false, `${banned} must not appear in js/pe-network-sourcing.js`);
  }
}

console.log('pe network sourcing tests passed');
