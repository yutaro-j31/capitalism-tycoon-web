'use strict';

// feature-requests.md R3 (スポーツ球団経営). The audit before this found the ownership loop
// already existed -- teamStrength decided each week's result, wins raised fanBase, fanBase
// scaled revenue -- but it had no downward pressure. Signing a player raised teamStrength
// permanently for one up-front fee and added nothing to the weekly cost, so buying every
// player on offer until teamStrength pinned at 100 was strictly correct and there was no
// decision left after the first few weeks.
//
// js/sports-management.js adds the two halves that make it a decision: players carry a weekly
// salary (strength has a permanent price), and revenue splits into gate receipts that follow
// fanBase and sponsorship that follows LAST season's win rate (so this season's spending is
// repaid from next season). Everything here is a pure function of state the team already
// carries, so no new randomness is drawn.

const assert = require('node:assert/strict');
const { loadGame } = require('./harness');

function lcg(seed = 260818777) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }

function newGame(seed = 260818777) {
  const { modules, ctx } = loadGame({ random: lcg(seed) });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 50_000_000_000;
  return { modules, ctx, engine, sports: modules.sportsManagement };
}

function team(overrides = {}) {
  return { id: 't1', name: 'テスト球団', revenue: 8_500_000, cost: 7_200_000, price: 480_000_000, fanBase: 40, teamStrength: 45, seasonWins: 0, seasonGames: 0, roster: [], ...overrides };
}

// 1. The module is registered and reachable the same way every other module here is.
{
  const { sports } = newGame();
  assert.ok(sports, 'sportsManagement モジュールが登録されている');
  assert.equal(sports.__installed, true);
}

// 2. Salary derivation covers each way a player can be signed, and is zero for a squad member
// carrying none of those fields rather than NaN.
{
  const { sports } = newGame();
  const drafted = { expectedSalary: 52_000_000 };
  assert.equal(sports.weeklySalaryFor(drafted), Math.round(52_000_000 * sports.DRAFT_SALARY_RATE / 52));
  const traded = { askingPrice: 104_000_000 };
  assert.equal(sports.weeklySalaryFor(traded), Math.round(104_000_000 * sports.TRADE_SALARY_RATE / 52));
  assert.equal(sports.weeklySalaryFor({}), 0, 'どの価格情報も無い選手は0円で、NaNにならない');
  assert.equal(sports.weeklySalaryFor(null), 0);
  const stored = { weeklySalary: 123_456, expectedSalary: 999_999_999 };
  assert.equal(sports.weeklySalaryFor(stored), 123_456, '保存済みのweeklySalaryが最優先される');
}

// 3. Payroll is the sum of the squad, so a bigger squad is a permanently bigger weekly cost.
{
  const { sports } = newGame();
  const empty = team();
  assert.equal(sports.payrollFor(empty), 0);
  const squad = team({ roster: [{ weeklySalary: 100_000 }, { weeklySalary: 250_000 }] });
  assert.equal(sports.payrollFor(squad), 350_000);
  assert.equal(sports.weeklyFinancialsFor(squad).cost, 7_200_000 + 350_000, '週次費用は固定費＋人件費');
}

// 4. Gate receipts follow fanBase and nothing else.
{
  const { sports } = newGame();
  const quiet = sports.gateRevenueFor(team({ fanBase: 10 }));
  const packed = sports.gateRevenueFor(team({ fanBase: 100 }));
  assert.ok(packed > quiet, 'ファンが増えるほど入場料収入が増える');
  assert.equal(sports.gateRevenueFor(team({ fanBase: 40, lastSeasonWinRate: 0 })), sports.gateRevenueFor(team({ fanBase: 40, lastSeasonWinRate: 1 })), '入場料は成績では変わらない');
}

// 5. Sponsorship follows last season's win rate and nothing else -- this is the lag that makes
// building a squad a bet rather than an immediate payout.
{
  const { sports } = newGame();
  const losers = sports.sponsorRevenueFor(team({ lastSeasonWinRate: 0 }));
  const winners = sports.sponsorRevenueFor(team({ lastSeasonWinRate: 1 }));
  assert.ok(winners > losers, '前シーズンの勝率が高いほどスポンサー収入が増える');
  assert.equal(sports.sponsorRevenueFor(team({ fanBase: 10, lastSeasonWinRate: .5 })), sports.sponsorRevenueFor(team({ fanBase: 100, lastSeasonWinRate: .5 })), 'スポンサーはファン数では変わらない');
}

// 6. Sponsorship prices off the completed season, not the one in progress: a team having a
// great run mid-season is still paid on last season's record.
{
  const { sports } = newGame();
  const midRun = team({ seasonWins: 20, seasonGames: 20, lastSeasonWinRate: 0 });
  assert.equal(sports.sponsorWinRate(midRun), 0, '進行中の連勝ではなく前シーズン確定分で算定される');
  assert.equal(sports.currentWinRate(midRun), 1, '進行中の勝率自体は別に読める');
}

// 7. Before any season has completed, sponsorship assumes an average team rather than treating
// the club as winless.
{
  const { sports } = newGame();
  const fresh = team();
  assert.equal(sports.sponsorWinRate(fresh), sports.NEUTRAL_WIN_RATE);
  assert.ok(sports.sponsorRevenueFor(fresh) > sports.sponsorRevenueFor(team({ lastSeasonWinRate: 0 })), '初シーズンは無勝利チーム扱いされない');
}

// 8. The season rolls over exactly on SEASON_WEEKS games, freezing the rate and resetting the
// record.
{
  const { sports } = newGame();
  const t = team();
  for (let i = 0; i < sports.SEASON_WEEKS - 1; i++) sports.recordGameResult(t, i % 2 === 0);
  assert.equal(sports.rolloverSeason(t, 51), false, 'シーズン途中では確定しない');
  sports.recordGameResult(t, true);
  assert.equal(sports.rolloverSeason(t, 52), true);
  assert.equal(t.seasonWins, 0, 'シーズン確定で今季成績がリセットされる');
  assert.equal(t.seasonGames, 0);
  assert.equal(t.seasonsCompleted, 1);
  assert.ok(t.lastSeasonWinRate > 0 && t.lastSeasonWinRate <= 1);
}

// 9. The headline invariant this whole feature exists for: a strong, well-supported club out-
// earns an untouched one even after paying a full squad's wages. If this ever inverts, signing
// players becomes a trap and the loop is broken.
{
  const { sports } = newGame();
  const idle = sports.weeklyFinancialsFor(team());
  const squadWages = 3_500_000;
  const contender = sports.weeklyFinancialsFor(team({
    fanBase: 100, teamStrength: 100, lastSeasonWinRate: 1,
    roster: [{ weeklySalary: squadWages }]
  }));
  assert.ok(contender.net > idle.net, `強豪(${contender.net})は無補強(${idle.net})より稼ぐ`);
  assert.ok(contender.payroll > 0, '強豪は人件費を負担している');
}

// 10. And the downside exists: a club that loses and empties its stands runs at a loss, so
// neglecting a team is not free.
{
  const { sports } = newGame();
  const failing = sports.weeklyFinancialsFor(team({ fanBase: 10, lastSeasonWinRate: 0 }));
  assert.ok(failing.net < 0, '弱くファンも去った球団は赤字になる');
}

// 11. Signing through the real engine actions records a salary on the player, so the squad
// starts costing money from the next week. signForeignPlayer used to raise teamStrength while
// adding nobody to the roster, which meant a permanent strength boost with no recurring cost.
{
  const { engine, sports } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const t = engine.g.sportsTeams[0];
  engine.refreshSportsMarket();
  assert.equal(engine.draftPlayer(t.id, engine.g.sportsDraftCandidates[0].id), true);
  assert.ok(sports.payrollFor(t) > 0, 'ドラフト指名した選手に週次年俸が付く');
  const afterDraft = sports.payrollFor(t);
  assert.equal(engine.tradePlayer(t.id, engine.g.sportsTradeMarket[0].id), true);
  assert.ok(sports.payrollFor(t) > afterDraft, 'トレード獲得した選手にも週次年俸が付く');
  const afterTrade = sports.payrollFor(t);
  const rosterBefore = t.roster.length;
  assert.equal(engine.signForeignPlayer(t.id), true);
  assert.equal(t.roster.length, rosterBefore + 1, '外国人補強もロスターに入る');
  assert.ok(sports.payrollFor(t) > afterTrade, '外国人補強にも週次年俸が付く');
  // Assert the stored salary specifically, not just that payroll rose: weeklySalaryFor would
  // fall back to the transfer-fee formula and mask a missing weeklySalary entirely, so a
  // foreign signing could silently be priced as a trade instead.
  const foreigner = t.roster.at(-1);
  assert.equal(foreigner.weeklySalary, sports.salaryFromForeign(foreigner.askingPrice), '外国人選手の年俸は移籍扱いではなく外国人レートで保存される');
  assert.notEqual(sports.salaryFromForeign(foreigner.askingPrice), sports.salaryFromTrade(foreigner), '前提: 外国人レートとトレードレートは異なる');
}

// 12. The weekly loop actually uses these numbers: cash moves by exactly the computed net.
{
  const { engine, sports } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const t = engine.g.sportsTeams[0];
  engine.refreshSportsMarket();
  engine.draftPlayer(t.id, engine.g.sportsDraftCandidates[0].id);
  const cashBefore = engine.g.personalCash;
  engine.updatePersonalAssets();
  const moved = engine.g.personalCash - cashBefore;
  assert.equal(moved, sports.weeklyFinancialsFor({ ...t, fanBase: t.fanBase }).net, '現金の増減が週次収支の計算結果と一致する');
  assert.equal(Number.isInteger(moved), true, '週次収支は整数円');
}

// 13. Playing weeks advances the season record through the real game loop.
{
  const { engine } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const t = engine.g.sportsTeams[0];
  for (let i = 0; i < 10; i++) assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(t.seasonGames, 10, '週を進めるごとに1試合ぶん記録される');
  assert.ok(t.seasonWins >= 0 && t.seasonWins <= 10);
}

// 14. A full season through the real loop freezes a rate and starts the next season clean.
{
  const { engine, sports } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const t = engine.g.sportsTeams[0];
  for (let i = 0; i < sports.SEASON_WEEKS; i++) engine.advanceWeek(false);
  assert.equal(t.seasonsCompleted, 1, '52週でシーズンが1つ完了する');
  assert.equal(t.seasonGames, 0);
  assert.ok(Number.isFinite(t.lastSeasonWinRate));
}

// 15. No new randomness: the weekly team loop still draws exactly three numbers per team
// (result, fanBase drift, value drift). Salaries, revenue split and rollover are all pure.
{
  let calls = 0;
  const inner = lcg();
  const counting = () => { calls++; return inner(); };
  const { ctx } = loadGame({ random: counting });
  const engine = ctx.__ct_engine;
  engine.g.configured = true;
  engine.g.personalCash = 50_000_000_000;
  engine.buySportsTeam('basketball', 'personal');
  engine.g.personalInvestments = [];
  engine.g.luxuryAssets = [];
  const before = calls;
  engine.updatePersonalAssets();
  assert.equal(calls - before, 3, '球団1件あたりのMath.random消費は3回のままで、今回の追加はゼロ');
}

// 16. Determinism.
{
  function run() {
    const { engine } = newGame(20260818);
    engine.buySportsTeam('basketball', 'personal');
    engine.refreshSportsMarket();
    engine.draftPlayer(engine.g.sportsTeams[0].id, engine.g.sportsDraftCandidates[0].id);
    for (let i = 0; i < 12; i++) engine.advanceWeek(false);
    return JSON.stringify({ cash: engine.g.personalCash, teams: engine.g.sportsTeams });
  }
  assert.equal(run(), run(), '同じseed・同じ操作で同じ結果になる');
}

// 17. Legacy saves: a team from before this feature has no seasonGames, no lastSeasonWinRate
// and a roster of players with no weeklySalary. It must keep earning sensibly and must not be
// treated as a winless club, and its old squad must still cost something.
{
  const { engine, sports } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const t = engine.g.sportsTeams[0];
  t.roster = [{ id: 'old-1', name: '旧選手', expectedSalary: 26_000_000 }];
  delete t.seasonGames;
  delete t.lastSeasonWinRate;
  delete t.seasonsCompleted;
  const financials = sports.weeklyFinancialsFor(t);
  assert.ok(Number.isFinite(financials.net), '旧セーブでもNaNにならない');
  assert.ok(financials.payroll > 0, 'weeklySalary未設定の旧選手も人件費として効く');
  assert.equal(sports.sponsorWinRate(t), sports.NEUTRAL_WIN_RATE, '旧セーブは無勝利扱いされない');
  assert.notEqual(engine.advanceWeek(false), false);
  assert.equal(t.seasonGames, 1, '旧セーブも次の週から通常どおりシーズンが始まる');
}

// 18. Company-owned teams keep their weekly result on the company ledger (the fix from the
// preceding PR still holds once revenue is computed by this module).
{
  const { modules, engine } = newGame();
  const office = engine.g.rentalOffices.reduce((a, b) => (a.deposit < b.deposit ? a : b));
  assert.equal(engine.contractOffice(office.id), true);
  engine.g.companyCash = 10_000_000_000;
  engine.g.finance = modules.finance.defaultFinanceState(engine.g);
  assert.equal(engine.buySportsTeam('basketball', 'company'), true);
  for (let i = 0; i < 6; i++) assert.notEqual(engine.advanceWeek(false), false);
  const v = modules.finance.validate(engine.g);
  assert.equal(v.ok, true, (v.errors || []).join('\n'));
}

// 19. Save/reload keeps the season record and the squad's salaries.
{
  const { modules, engine, sports } = newGame();
  assert.equal(engine.buySportsTeam('basketball', 'personal'), true);
  const t = engine.g.sportsTeams[0];
  engine.refreshSportsMarket();
  engine.draftPlayer(t.id, engine.g.sportsDraftCandidates[0].id);
  for (let i = 0; i < 5; i++) engine.advanceWeek(false);
  const payroll = sports.payrollFor(t);
  engine.save();
  const reloaded = modules.engine.TycoonEngine.load();
  const loadedTeam = reloaded.g.sportsTeams[0];
  assert.equal(loadedTeam.seasonGames, t.seasonGames);
  assert.equal(sports.payrollFor(loadedTeam), payroll, 'reload後も人件費が一致する');
  assert.equal(reloaded.g.saveVersion, 9);
}

// 20. The front office screen shows the split and the season state, so the player can actually
// see why the number moved.
{
  const { ctx } = loadGame({ random: lcg() });
  const engine = ctx.__ct_engine, ui = ctx.__ct_ui;
  engine.g.configured = true;
  ui.showSetup = false;
  engine.g.personalCash = 5_000_000_000;
  engine.buySportsTeam('basketball', 'personal');
  engine.refreshSportsMarket();
  engine.draftPlayer(engine.g.sportsTeams[0].id, engine.g.sportsDraftCandidates[0].id);
  engine.g.selectedTab = 'assets';
  ui.assetTab = 'sports';
  engine.emit('change');
  const html = String(ctx.document.getElementById('app').innerHTML || '');
  for (const label of ['入場料', 'スポンサー', '人件費', '週次損益']) {
    assert.ok(html.includes(label), `球団フロントに「${label}」が表示される`);
  }
  assert.ok(/スポンサー収入は[^<]*シーズン/.test(html), 'スポンサー算定根拠が説明されている');
}

// 21. Static source scan: no MutationObserver added by this feature.
{
  const fs = require('node:fs');
  const path = require('node:path');
  for (const file of ['../js/sports-management.js', '../js/engine.js', '../js/expansion.js', '../js/app.js']) {
    const src = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/new MutationObserver|new env\.MutationObserver/.test(src), `${file}に新しいMutationObserverを追加していない`);
  }
}

console.log('sports management tests passed');
