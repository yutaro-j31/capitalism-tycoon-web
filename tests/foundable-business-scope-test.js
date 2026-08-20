'use strict';

// 30→5業種の一本化（Manus 1.6提案の検討・オーナー承認）の最小実装。
//
// 承認された5業種は ①ラーメン ②コンビニ ③ジム ④productVenturesの格上げ
// （新規業種IDを足さず既存の自社プロダクト開発制度をそのまま5本目の柱とする）
// ⑤不動産仲介。このうち④はテナントへの出店ではなく別画面（商品開発部門→開発開始）
// で扱う制度なので、テナント出店の選択肢としては①②③⑤の4業種に絞る。
//
// 実装方針はオーナーの指示により「UI上だけ消す」。理由は将来また業種を増やす
// 可能性があるため。したがって:
//   - data.js（MASTER.businesses）は変更しない。既存セーブの他26業種の店舗は
//     従来どおりまったく同じロジックで動作し続ける
//   - engine.openStore() 自体にも業種の許可リストを追加しない。UIの選択肢を
//     絞るだけで、エンジンは技術的には従来どおりどの業種でも出店を受け付ける
//     （後で業種を足し戻すときにengine側の変更が要らない、という可逆性のため）
//   - engine.businessPortfolio()（外部監査P3で「業種を1つも隠さない」と決めた
//     既存の読み取り専用集計）にも一切手を入れない。事業画面の「運営中/未出店」
//     一覧は引き続き30業種すべてを表示する
//   - 絞るのは「テナント出店」フォームのプルダウン（js/app.js 内の
//     businessOpts(g.businesses,ui.selectedBusiness) 3箇所のうち1箇所）だけ。
//     事業ポートフォリオのFC本部設置セレクトと海外進出セレクトは、既存セーブが
//     既に保有している非対象業種でも操作できるよう、従来どおり全30業種のまま

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

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

// 1. FOUNDABLE_BUSINESS_IDSは承認された4業種（テナント出店分）で、全てMASTERに実在する。
{
  const { engine } = newGame();
  const m = appSource.match(/const FOUNDABLE_BUSINESS_IDS = (\[[^\]]*\]);/);
  assert.ok(m, 'FOUNDABLE_BUSINESS_IDSの定義が見つかる');
  const ids = JSON.parse(m[1].replace(/'/g, '"'));
  assert.deepEqual(ids, ['ramen', 'conveni', 'gym', 'realEstateAgency'], '承認された4業種（ラーメン/コンビニ/ジム/不動産仲介）に一致する');
  for (const id of ids) assert.ok(engine.g.businesses.some(b => b.id === id), `${id}はdata.jsに実在する`);
}

// 2. テナント出店のプルダウンだけがfoundableBusinesses(g)で絞られている。
//    事業ポートフォリオ・海外進出は従来どおり全30業種のbusinessOptsのまま
//    （business-simulation-depth-test.jsのブロック7でも件数を固定しているが、
//    ここでは「絞ったのはどこか」という設計意図を直接記述する）。
{
  assert.match(appSource, /businessOpts\(foundableBusinesses\(g\),foundingID\)/, 'テナント出店セレクトはfoundableBusinesses(g)を使う');
  assert.match(appSource, /<select data-bind="selectedBusiness">\$\{businessOpts\(g\.businesses,ui\.selectedBusiness\)\}<\/select>\$\{btn\('FC本部を設置'/, '事業ポートフォリオのFC本部設置セレクトは全業種のまま');
  assert.match(appSource, /<select id="overseas-business-\$\{c\.id\}">\$\{businessOpts\(g\.businesses,ui\.selectedBusiness\)\}<\/select>/, '海外進出セレクトは全業種のまま');
}

// 3. engine.openStore()自体は業種の許可リストを持たない（UI層のみの制限であることの
//    直接検証）。承認された4業種以外（例: cafe）でも技術的には出店できる。
//    これにより「後で業種を足し戻す」ときエンジン側の変更が不要という可逆性が成り立つ。
{
  const { engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID: 'cafe', name: 'カフェ', operatingHours: 3 }), true, 'engineはUIで絞った4業種以外でも出店を受け付ける（UI限定の制限）');
  assert.equal(engine.g.stores.at(-1).businessID, 'cafe');
}

// 4. 旧セーブ互換: 出店済みの非対象業種（例: cafe）は、この変更後もまったく同じ
//    ロジックで運営中扱いになり、businessPortfolioからも消えない。
{
  const { engine } = newGame();
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  engine.openStore({ tenantID: tenant.id, businessID: 'cafe', name: 'カフェ', operatingHours: 3 });
  const store = engine.g.stores.at(-1);
  while (store.status !== 'open') engine.advanceWeek(false);

  const p = engine.businessPortfolio();
  assert.ok(p.operating.some(r => r.businessID === 'cafe'), '既存セーブのcafe店舗は運営中として引き続き表示される');
}

// 5. businessPortfolio()の未出店側は、後続PR（tests/business-portfolio-focus-test.js参照）で
//    主力4業種のみへ絞られた。このPR時点（#486）では未出店側も全30業種のままだったが、
//    その後オーナーの追加指示（事業画面自体も5業種に絞りたい）により変更された。
//    ここでは詳細を重複させず、「運営中は絞らない」という本ファイルの主眼（block 3, 4）だけを
//    固定し、未出店側の絞り込み仕様はbusiness-portfolio-focus-test.jsに委ねる。
{
  const { engine } = newGame();
  const p = engine.businessPortfolio();
  assert.ok(!p.idle.some(r => r.businessID === 'esportsFacility'), '対象外の業種（例: esportsFacility）は未出店側の絞り込み後は表示されない（詳細はbusiness-portfolio-focus-test.js）');
}

// 6. 読み取り専用ヘルパーであること。foundableBusinesses/foundingBusinessIDの追加が
//    RNGや保存を伴わないことを、実際のレンダリング経路を通して確認する
//    （app.jsはブラウザDOM前提のため、ここではengine側の副作用有無のみを見る）。
{
  const { engine } = newGame();
  const before = JSON.stringify(engine.g);
  engine.businessPortfolio();
  assert.equal(JSON.stringify(engine.g), before, '本PRの変更はengineの状態を変えない');
}

console.log('foundable business scope tests passed');
