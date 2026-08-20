'use strict';

// 従業員数が0人のまま店舗が稼働して見える問題（外部監査の指摘）を、実エンジンで再現してから直した。
//
// 再現条件はラーメン店ではなく「ラーメン以外の店舗」だった。js/workforce.js の createStoreTeam() は
// TARGET_BUSINESS_IDS（現状 ramen のみ）以外の店舗に対して null を返すため、cafe / conveni / bookstore
// では workforceTeams が空のままになる。一方 js/engine.js は status==='open' の全店舗に対して
// b.wage を毎週課金しているので、週¥48,750〜82,000の人件費を払いながらCEOダッシュボードは
// 従業員数 0人 と表示していた。実測（第8週・同一seed）:
//
//   ramen     employees=5  teams=[store:5]   wage/週=52,500
//   cafe      employees=0  teams=[]          wage/週=51,250   ← 人件費だけ発生
//   conveni   employees=0  teams=[]          wage/週=48,750   ← 同上
//   bookstore employees=0  teams=[]          wage/週=82,000   ← 同上
//
// 修正方針は表示のみ。TARGET_BUSINESS_IDS を広げるのは CLAUDE.md が「アンロック順に1業種ずつ、
// そのたびに決定論の指紋を更新する」と定めた別作業なので、ここでは触らない。代わりに
// workforce.companyHeadcount() が、チーム未生成の営業中店舗について createStoreTeam() と同じ
// 賃金式から人数を導出する。シミュレーションは従来どおりチームベースのままで、この関数は
// 読み取り専用（g を変更せず、チームを作らず、RNGを消費しない）。

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 190826041) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 190826041) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  return { modules, engine };
}

function openStore(engine, businessID, name) {
  const tenant = engine.g.tenants.find(t => !t.occupiedBy);
  assert.ok(tenant, '前提: 空きテナントが存在する');
  assert.equal(engine.openStore({ tenantID: tenant.id, businessID, name, operatingHours: 3 }), true, `${businessID}の出店が成功する`);
  return engine.g.stores.at(-1);
}

const advanceTo = (engine, week) => { while (engine.g.week < week) assert.notEqual(engine.advanceWeek(false), false); };
const employeesOf = (modules, engine) => modules.ceoDashboard.build(engine.g, {
  companyValue: engine.companyValue(), ipoMissingReasons: engine.ipoMissingReasons(), missions: []
}).overview.employees;

// 1. 回帰の本体: ラーメン以外の営業中店舗でも従業員数が0人にならない。
{
  for (const businessID of ['cafe', 'conveni', 'bookstore']) {
    const { modules, engine } = newGame();
    const store = openStore(engine, businessID, '検証店');
    advanceTo(engine, store.openingWeek + 4);

    assert.equal(store.status, 'open', `前提: ${businessID}が営業中`);
    assert.equal(engine.g.workforceTeams.length, 0, `前提: ${businessID}には詳細チームが存在しない`);

    const employees = employeesOf(modules, engine);
    assert.ok(employees > 0, `${businessID}: 営業中の店舗で従業員数が0人にならない（実測 ${employees}人）`);
    assert.equal(employees, modules.workforce.impliedStoreHeadcount(engine.g, store), `${businessID}: 表示人数は賃金由来の導出人数と一致する`);
  }
}

// 2. 人件費を実際に払っていることを確認する。表示だけを埋めているのではなく、
//    「賃金は出ているのに人数が出ていない」という不整合を解消していることの根拠。
{
  const { modules, engine } = newGame();
  const store = openStore(engine, 'cafe', 'カフェ検証店');
  advanceTo(engine, store.openingWeek + 1);

  const business = engine.g.businesses.find(b => b.id === 'cafe');
  assert.ok(business.wage > 0, '前提: cafeには週次賃金が設定されている');
  assert.ok(employeesOf(modules, engine) > 0, '賃金が発生している店舗の従業員数は0人ではない');
}

// 3. ラーメン店（詳細チームあり）の表示は今回の変更で変わらず、二重計上もしない。
{
  const { modules, engine } = newGame();
  const store = openStore(engine, 'ramen', 'ラーメン検証店');
  advanceTo(engine, store.openingWeek + 4);

  const team = engine.g.workforceTeams.find(t => t.storeID === store.id);
  assert.ok(team, '前提: ラーメン店には詳細チームが生成される');
  assert.equal(employeesOf(modules, engine), team.headcount, 'チームがある店舗はチーム人数のみを計上する（二重計上しない）');
}

// 4. 開業準備中の店舗は0人。js/engine.js は status!=='open' の店舗に賃金を課金しないので、
//    人数も出してはいけない。
{
  const { modules, engine } = newGame();
  const store = openStore(engine, 'cafe', '準備中店');
  assert.equal(store.status, 'preparing', '前提: 出店直後はpreparing');
  assert.equal(modules.workforce.impliedStoreHeadcount(engine.g, store), 0, '準備中の店舗は人数を計上しない');
  assert.equal(employeesOf(modules, engine), 0, '営業中店舗が無ければ従業員数は0人');
}

// 5. 複数店舗・混在業種で合算される。
{
  const { modules, engine } = newGame();
  const ramen = openStore(engine, 'ramen', '混在ラーメン');
  const cafe = openStore(engine, 'cafe', '混在カフェ');
  advanceTo(engine, Math.max(ramen.openingWeek, cafe.openingWeek) + 4);

  const team = engine.g.workforceTeams.find(t => t.storeID === ramen.id);
  assert.ok(team && team.headcount > 0, '前提: ラーメン店のチームが存在する');
  assert.equal(
    employeesOf(modules, engine),
    team.headcount + modules.workforce.impliedStoreHeadcount(engine.g, cafe),
    '詳細チームと導出人数を合算する'
  );
}

// 6. 導出式は createStoreTeam() が使う式と一致する。ここがずれると、同じ店舗が
//    TARGET_BUSINESS_IDS に加わった瞬間に表示人数が飛ぶ。
{
  const { modules, engine } = newGame();
  const ramen = openStore(engine, 'ramen', '式一致検証店');
  advanceTo(engine, ramen.openingWeek + 1);

  const team = engine.g.workforceTeams.find(t => t.storeID === ramen.id);
  const business = engine.g.businesses.find(b => b.id === 'ramen');
  assert.equal(team.headcount, Math.max(5, Math.round(business.wage / 17500)), '前提: createStoreTeamの賃金式');
  assert.equal(modules.workforce.impliedStoreHeadcount(engine.g, ramen), team.headcount, '導出式はcreateStoreTeamと同じ人数を返す');
}

// 7. 読み取り専用であること: g を変更せず、チームを作らず、RNGを消費しない。
{
  const { modules, engine } = newGame();
  const store = openStore(engine, 'conveni', '副作用検証店');
  advanceTo(engine, store.openingWeek + 3);

  let randomCalls = 0;
  const before = JSON.stringify(engine.g);
  const teamsBefore = engine.g.workforceTeams.length;

  const g = engine.g;
  const originalRandom = Math.random;
  Math.random = () => { randomCalls++; return originalRandom(); };
  try {
    modules.workforce.companyHeadcount(g);
    modules.workforce.impliedStoreHeadcount(g, store);
  } finally {
    Math.random = originalRandom;
  }

  assert.equal(randomCalls, 0, 'companyHeadcountはRNGを消費しない');
  assert.equal(engine.g.workforceTeams.length, teamsBefore, 'チームを新規生成しない');
  assert.equal(JSON.stringify(engine.g), before, 'gを一切変更しない');
}

// 8. js/executive-secretary.js は `if(!__modules.ceoDashboard)` のフォールバックとして
//    ceoDashboard の二重定義を持っている。読み込み順（ceo-dashboard.js が先）のため実行時には
//    使われないが、片方だけ直すと将来この分岐が生きたときに0人表示が復活する。ここでは
//    両ファイルの従業員数式が同一であることをソース上で固定する。
{
  const fs = require('node:fs');
  const path = require('node:path');
  const expression = /employees:nf\(g\?\.employeeCount,__modules\.workforce\?\.companyHeadcount\?\.\(g\)\?\?arr\(g\?\.workforceTeams\)\.reduce\(\(a,t\)=>a\+nf\(t\?\.headcount\),0\)\)/;

  for (const file of ['js/ceo-dashboard.js', 'js/executive-secretary.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(source, expression, `${file}: 従業員数の式が二重定義間で一致する`);
  }
}

// 9. 旧セーブ互換: g.employeeCount が明示的に入っていれば従来どおりそれを優先する。
{
  const { modules, engine } = newGame();
  const store = openStore(engine, 'cafe', '旧セーブ検証店');
  advanceTo(engine, store.openingWeek + 1);

  engine.g.employeeCount = 42;
  assert.equal(employeesOf(modules, engine), 42, '明示的なemployeeCountは導出値より優先される');
}

// 10. 本社部門の人数も引き続き含まれる。
{
  const { modules, engine } = newGame();
  const store = openStore(engine, 'cafe', '本社併存店');
  advanceTo(engine, store.openingWeek + 2);

  const derivedOnly = employeesOf(modules, engine);
  const team = modules.workforce.createDepartmentTeam(engine.g, 'operations', 3);
  assert.ok(team && team.headcount === 3, '前提: 本社部門チームを生成できる');
  assert.equal(employeesOf(modules, engine), derivedOnly + 3, '本社部門の人数が加算される');
}

console.log('company headcount display tests passed');
