'use strict';

// Two real defects found while auditing feature-requests.md R3 (sports team management),
// both in code that predates this test file:
//
// 1. A company-owned team's weekly gate receipts moved companyCash directly, with no
//    finance.event -- so the ledger's opening-cash rollforward drifted from companyCash every
//    single week and finance.validate() returned ok:false after one advanceWeek().
// 2. personalNetWorth() summed EVERY team regardless of owner, while companyValue() counted
//    none at all. Buying a team with company cash therefore added its full value to personal
//    net worth (and personal credit) while removing the same amount from company value --
//    company money turning straight into personal assets, which the "会社資産と個人資産の分離"
//    invariant forbids. finance.js's otherFixedBook() already filtered on owner==='company',
//    so the ledger and the engine disagreed about who owned the asset.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260818001) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260818001) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  engine.g.companyCash = 10_000_000_000;
  engine.g.personalCash = 10_000_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  return { modules, ctx, engine };
}

// 1. A company-owned team's weekly result reaches the finance ledger, and the ledger stays
// valid. Before the fix this produced zero ledger rows and validate() failed outright.
{
  const { modules, engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  const team = engine.g.sportsTeams[0];
  const cashBefore = engine.g.companyCash;
  const txBefore = engine.g.finance.transactions.length;
  engine.updatePersonalAssets();
  const delta = engine.g.companyCash - cashBefore;
  assert.notEqual(delta, 0, '前提: 会社保有球団の週次収支はcompanyCashを動かす');
  const rows = engine.g.finance.transactions.filter(t => t.sourceType === 'sportsTeamWeekly' && t.sourceID === team.id);
  assert.equal(rows.length, 1, '会社保有球団の週次収支は台帳に1行だけ記録される');
  assert.equal(rows[0].cashEffect, delta, '台帳のcashEffectがcompanyCashの増減と一致する');
  assert.equal(rows[0].profitEffect, delta);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 2. The ledger stays valid across many weeks of the real game loop, not just one direct call.
{
  const { modules, engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  for (let i = 0; i < 8; i++) assert.notEqual(engine.advanceWeek(false), false);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 3. Buying a team with company cash is a pure asset swap: company value is unchanged (cash
// becomes a fixed asset) and personal net worth does not move at all.
{
  const { engine } = newGame();
  const companyBefore = engine.companyValue();
  const personalBefore = engine.personalNetWorth();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  assert.equal(engine.companyValue(), companyBefore, '会社保有球団の取得は現金から固定資産への振替で会社価値は変わらない');
  assert.equal(engine.personalNetWorth(), personalBefore, '会社資金で買った球団は個人純資産を1円も動かさない');
}

// 4. Buying a team with personal cash is the mirror image: personal net worth unchanged,
// company value untouched.
{
  const { engine } = newGame();
  const companyBefore = engine.companyValue();
  const personalBefore = engine.personalNetWorth();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  assert.equal(engine.personalNetWorth(), personalBefore, '個人保有球団の取得は個人現金から個人資産への振替');
  assert.equal(engine.companyValue(), companyBefore, '個人資金で買った球団は会社価値に影響しない');
}

// 5. The engine and the finance ledger agree on which teams are company assets: companyValue's
// share of sports teams equals what finance.js already books as company fixed assets.
{
  const { engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  assert.equal(engine.buySportsTeam('football', 'personal'), true);
  const companyTeams = engine.g.sportsTeams.filter(t => t.owner === 'company');
  const personalTeams = engine.g.sportsTeams.filter(t => t.owner !== 'company');
  assert.equal(companyTeams.length, 1);
  assert.equal(personalTeams.length, 1);
  const emptied = engine.companyValue() - companyTeams.reduce((a, t) => a + t.value, 0);
  engine.g.sportsTeams = personalTeams;
  assert.equal(engine.companyValue(), emptied, '会社価値に含まれる球団分は会社保有球団の価値ちょうど');
}

// 6. Company/personal separation in the weekly loop: a personal-owned team never touches
// companyCash and never writes to the company ledger.
{
  const { modules, engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const companyBefore = engine.g.companyCash;
  const personalBefore = engine.g.personalCash;
  const txBefore = engine.g.finance.transactions.length;
  engine.updatePersonalAssets();
  assert.equal(engine.g.companyCash, companyBefore, '個人保有球団の週次収支はcompanyCashに影響しない');
  assert.notEqual(engine.g.personalCash, personalBefore, '個人保有球団の週次収支はpersonalCashへ入る');
  assert.equal(engine.g.finance.transactions.length, txBefore, '個人保有球団は会社台帳に一切記帳されない');
}

// 7. Legacy saves whose teams predate the owner field are treated as personal, exactly as
// finance.js's otherFixedBook() already treated them -- never double-counted, never dropped.
{
  const { engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const team = engine.g.sportsTeams[0];
  const personalWithOwner = engine.personalNetWorth();
  const companyWithOwner = engine.companyValue();
  delete team.owner;
  assert.equal(engine.personalNetWorth(), personalWithOwner, 'owner欠損の球団は個人資産のまま');
  assert.equal(engine.companyValue(), companyWithOwner, 'owner欠損の球団は会社価値に混入しない');
}

// 8. A team's value is counted exactly once across the two net-worth figures.
{
  const { engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  const team = engine.g.sportsTeams[0];
  const companyWith = engine.companyValue();
  const personalWith = engine.personalNetWorth();
  engine.g.sportsTeams = [];
  const companyWithout = engine.companyValue();
  const personalWithout = engine.personalNetWorth();
  assert.equal(companyWith - companyWithout, team.value, '会社保有球団の価値は会社側にちょうど1回だけ計上される');
  assert.equal(personalWith - personalWithout, 0, '会社保有球団は個人側には計上されない');
}

// 9. Personal credit is no longer inflated by a team the company paid for. This was the
// player-visible consequence of defect 2: company cash bought personal borrowing power.
{
  const { engine } = newGame();
  const limitBefore = engine.personalCreditLimit();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  assert.equal(engine.personalCreditLimit(), limitBefore, '会社が買った球団で個人与信枠は増えない');
}

// 10. Determinism: same seed, same actions -> identical state.
{
  function run() {
    const { engine } = newGame(19990909);
    engine.buySportsTeam('basketball', 'company');
    engine.updatePersonalAssets();
    return JSON.stringify({ companyCash: engine.g.companyCash, teams: engine.g.sportsTeams, tx: engine.g.finance.transactions.length });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 11. The ledger row consumes no randomness: the weekly team loop draws exactly the same
// number of Math.random() calls as before this fix (win roll + fanBase drift + value drift).
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { modules, ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  engine.contractOffice(office.id);
  engine.g.companyCash = 10_000_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  engine.buySportsTeam('basketball', 'company');
  engine.g.personalInvestments = [];
  engine.g.luxuryAssets = [];
  const before = calls;
  engine.updatePersonalAssets();
  assert.equal(calls - before, 3, '球団1件あたりのMath.random消費は勝敗・fanBase・value driftの3回のみで、台帳記帳による追加消費はゼロ');
}

// 12. Same week, same team, one row: the idempotency key stops a double charge if the weekly
// update is ever invoked twice for the same week.
{
  const { engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  const team = engine.g.sportsTeams[0];
  engine.updatePersonalAssets();
  engine.updatePersonalAssets();
  const rows = engine.g.finance.transactions.filter(t => t.sourceType === 'sportsTeamWeekly' && t.sourceID === team.id);
  assert.equal(rows.length, 1, '同じ週の同じ球団の記帳は1行に収まる');
}

// 13. Save/reload round trip keeps ownership and the ledger intact.
{
  const { modules, engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  engine.updatePersonalAssets();
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  assert.equal(reloaded.g.sportsTeams[0].owner, 'company');
  assert.equal(reloaded.g.saveVersion, 9);
  assert.equal(modules.finance.validate(reloaded.g).ok, true, 'reload後も会計整合性が保たれる');
}

console.log('sports team accounting and ownership tests passed');
