'use strict';

// 出店前の週次収支試算（外部監査P3「事前収支シミュレーター」）。
//
// 出店には設備＋保証金で約265万〜645万円かかり、これまでプレイヤーは開けてみるまで
// 黒字になるかを知る手段が無かった。engine.estimateStoreOpening() は advanceWeek() の
// 非詳細業種と同じ需要式をそのまま使い、rand(.88,1.14) だけを消費せずに両端を
// 保守的〜楽観的の帯として返す。
//
// 精度の実測（このテストのブロック2）: 開店週のマクロ状態を揃えて比較すると、
// 実績は5業種×3シードすべてで帯の中に入った。式は近似ではなく本番と同一である。
//
// ただし出店から開店までに3〜8週あり、その間に景気・季節・インフレが動く。通常スタートでは
// economy 1.00→1.13 / season 1.00→1.07 / inflation 1.00→1.03 と上振れし、固定費の
// レバレッジで週次利益は試算の約2.5倍になった。したがって「試算＝実績」ではない。
// この限界は caveats として返り値に持たせ、UIにも必ず出す（ブロック6・7）。

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

// 1. 基本形: 空きテナント×業種で、売上・費用・初期費用・回収期間が揃って返る。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  const estimate = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 3 });

  assert.ok(estimate, '試算が返る');
  assert.equal(estimate.businessID, 'cafe');
  assert.equal(estimate.tenantID, tenant.id);

  const business = engine.business('cafe');
  assert.equal(estimate.storeCost, business.storeCost, '設備費は業種のstoreCost');
  assert.equal(estimate.deposit, tenant.deposit, '保証金はテナントのdeposit');
  assert.equal(estimate.upfront, business.storeCost + tenant.deposit, '初期費用は設備＋保証金');
  assert.equal(estimate.cashAfterOpening, engine.g.companyCash - estimate.upfront, '出店後現金');

  assert.ok(estimate.expected.sales > 0, '売上が正');
  assert.equal(estimate.expected.profit, estimate.expected.sales - estimate.expected.variable - estimate.expected.fixed, '利益＝売上-変動費-固定費');
  assert.equal(
    estimate.expected.fixed,
    estimate.breakdown.rent + estimate.breakdown.wage + estimate.breakdown.otherFixed,
    '固定費の内訳が合計と一致する'
  );
}

// 2. 精度の本体: 開店週のマクロ状態を揃えれば、実績は必ず帯の中に入る。
//    estimateStoreOpening はテナントのoccupiedByを見ないので、出店後も同じテナント条件で
//    再試算でき、これにより「同じ週・同じマクロ」での厳密な比較ができる。
{
  for (const businessID of ['cafe', 'bookstore', 'conveni', 'izakaya', 'bakery']) {
    for (const seed of [190826041, 5551221, 987654321]) {
      const { engine } = newGame(seed);
      const tenant = freeTenant(engine);
      assert.equal(engine.openStore({ tenantID: tenant.id, businessID, name: '検証店', operatingHours: 3 }), true);

      const store = engine.g.stores.at(-1);
      while (engine.g.week < store.openingWeek) assert.notEqual(engine.advanceWeek(false), false);
      assert.notEqual(engine.advanceWeek(false), false); // 最初の取引週
      assert.equal(store.status, 'open', '前提: 営業中');

      const estimate = engine.estimateStoreOpening({ tenantID: tenant.id, businessID, operatingHours: 3 });
      assert.ok(
        store.lastProfit >= estimate.conservative.profit && store.lastProfit <= estimate.optimistic.profit,
        `${businessID}/seed=${seed}: 同一マクロなら実績${store.lastProfit}は帯[${estimate.conservative.profit}, ${estimate.optimistic.profit}]に入る`
      );
    }
  }
}

// 2b. 式そのものを固定する。帯（±14%）は5%程度の項の脱落を吸収してしまうため、
//     ブロック2だけでは競合圧力のような小さめの係数を落としても赤くならない。
//     ここでは需要式をテスト側で独立に組み立て、期待ケースの売上と厳密一致することを要求する。
{
  const { engine } = newGame();
  const g = engine.g;
  const tenant = freeTenant(engine);
  const b = engine.business('cafe');
  const p = engine.pref(tenant.prefID);
  const a = engine.area(p.areaID);

  const localCompetition = a.competition + engine.competitorPressure(a.id, b.id);
  assert.ok(localCompetition > 0, '前提: 競合圧力が0ではない（この項の脱落を検出できる）');

  let demand = b.demand * p.traffic * a.traffic * g.economy * g.season * engine.fit(b, a)
    * (1 + b.quality / 100) * (1 + b.brand / 90) * (1 + b.dx / 140) * (1 - localCompetition * .55);
  demand *= 1 + engine.departmentEffect('dx') * .05 + engine.departmentEffect('marketing') * .03;
  demand *= [0, .45, .75, 1, 1.17][3];
  if (g.macroCrisis) demand *= g.macroCrisis.salesMultiplier;

  const expectedSales = Math.floor(Math.max(0, demand * b.price * g.inflation));
  const expectedVariable = Math.floor(Math.max(0, demand * b.unitCost * g.inflation
    * (1 - Math.min(.22, b.efficiency / 260)) / (1 + engine.departmentEffect('operations') * .04)));
  const expectedFixed = Math.floor(Math.max(0, (b.fixedCost + p.rent + b.wage) * g.inflation * [0, .55, .8, 1, 1.24][3]
    * (g.macroCrisis ? g.macroCrisis.costMultiplier : 1)));

  const estimate = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 3 });
  assert.equal(estimate.expected.sales, expectedSales, '売上が需要式と厳密一致する');
  assert.equal(estimate.expected.variable, expectedVariable, '変動費が式と厳密一致する');
  assert.equal(estimate.expected.fixed, expectedFixed, '固定費が式と厳密一致する');
}

// 3. 帯の向き: 保守 ≤ 期待 ≤ 楽観。固定費は需要に依存しないので3ケースで同一。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  const e = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 3 });

  assert.ok(e.conservative.profit < e.expected.profit, '保守 < 期待');
  assert.ok(e.expected.profit < e.optimistic.profit, '期待 < 楽観');
  assert.ok(e.conservative.units < e.optimistic.units, '需要も同じ向き');
  assert.equal(e.conservative.fixed, e.optimistic.fixed, '固定費は需要に依存しない');
}

// 4. 営業時間が需要と固定費の両方に効く。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  const short = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 2 });
  const long = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 4 });

  assert.ok(long.expected.sales > short.expected.sales, '長時間営業のほうが売上が大きい');
  assert.ok(long.expected.fixed > short.expected.fixed, '長時間営業のほうが固定費も大きい');
  assert.equal(short.operatingHours, 2, '営業時間がそのまま返る');
}

// 5. 資金判定。現金が足りなければ affordable:false になり、不足分が読める。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  assert.equal(engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'ramen', operatingHours: 3 }).affordable, true, '初期資金では出店可能');

  engine.g.companyCash = 100000;
  const poor = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'ramen', operatingHours: 3 });
  assert.equal(poor.affordable, false, '現金不足なら出店不可と判定する');
  assert.ok(poor.cashAfterOpening < 0, '出店後現金がマイナスになることが読める');
}

// 6. 限界の開示。帯が需要のばらつきだけであること、開店までに時間があることを必ず返す。
//    ここを外すと「試算どおりにならない」という不信につながるので固定する。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);

  const simple = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'bookstore', operatingHours: 3 });
  assert.ok(simple.caveats.length >= 2, '注意事項が2件以上ある');
  assert.ok(simple.caveats.some(c => c.includes('景気')), '景気変動を含まないことを明示する');
  assert.ok(simple.caveats.some(c => c.includes(`${simple.weeksToOpen}週後`)), '開店までの週数を明示する');
  assert.equal(simple.approximate, false, '簡易業種では近似フラグが立たない');

  const detailed = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'ramen', operatingHours: 3 });
  assert.equal(detailed.approximate, true, '詳細シミュレーション業種では近似フラグが立つ');
  assert.ok(detailed.caveats.some(c => c.includes('近似')), '詳細業種では近似であることを明示する');
  assert.ok(detailed.caveats.length > simple.caveats.length, '詳細業種のほうが注意事項が多い');
}

// 7. 読み取り専用であること。RNGを消費せず、状態も変えない。
//    ここが崩れると、試算を開くだけで決定論の指紋がずれる。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  const before = JSON.stringify(engine.g);

  let randomCalls = 0;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try {
    for (const business of engine.g.businesses) {
      for (const hours of [1, 2, 3, 4]) engine.estimateStoreOpening({ tenantID: tenant.id, businessID: business.id, operatingHours: hours });
    }
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(randomCalls, 0, 'estimateStoreOpeningはRNGを消費しない');
  assert.equal(JSON.stringify(engine.g), before, 'ゲーム状態を変更しない');
}

// 8. 何度呼んでも同じ値（決定論）。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  const first = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 3 });
  const second = engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'cafe', operatingHours: 3 });
  assert.deepEqual(second, first, '同一入力なら同一結果');
  assert.ok(Object.isFrozen(first), '返り値はfrozen');
}

// 9. 不正な入力では null を返し、例外を投げない。
{
  const { engine } = newGame();
  const tenant = freeTenant(engine);
  assert.equal(engine.estimateStoreOpening({ tenantID: 'no-such-tenant', businessID: 'cafe' }), null, '存在しないテナント');
  assert.equal(engine.estimateStoreOpening({ tenantID: tenant.id, businessID: 'no-such-business' }), null, '存在しない業種');
  assert.equal(engine.estimateStoreOpening({}), null, '引数なし');
}

// 10. UI配線: テナントカードに試算が出て、業種セレクトの変更で追従する。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

  assert.match(source, /storeOpeningEstimate\(t\.id,foundingID\)/, 'テナントカードに試算を描画する（foundingIDはselectedBusinessを主力業種の範囲に丸めたもの）');
  assert.match(source, /<select id="business-\$\{t\.id\}" data-bind="selectedBusiness">/, '業種セレクトがselectedBusinessに連動し、選び直すと試算が更新される');
  assert.match(source, /function storeOpeningEstimate\(tenantID,businessID\)\{[\s\S]{0,300}estimateStoreOpening/, '表示はengineの試算を使う（app.js側で再計算しない）');
  assert.match(source, /e\.caveats\.map/, '注意事項をUIに必ず出す');
}

// 11. css/app.css を触らずに済ませていること（バイト一致要件）。
{
  const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'app.css'), 'utf8');
  const block = source.slice(source.indexOf('function storeOpeningEstimate'), source.indexOf('function renderMap'));

  for (const attr of block.match(/class="([a-z- ]+)"/g) || []) {
    for (const name of attr.replace(/class="|"/g, '').split(/\s+/).filter(Boolean)) {
      if (name === 'hint') continue; // 既存の未スタイルクラス
      assert.ok(css.includes(`.${name}`), `storeOpeningEstimateが使う .${name} はcss/app.cssに既存`);
    }
  }
}

console.log('store opening estimate tests passed');
