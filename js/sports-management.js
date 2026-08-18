// Sports team management: make winning actually pay, and make staying strong actually cost.
//
// Before this, a team's weekly result was `revenue * (.7 + fanBase/100) - cost`, where cost
// was a constant read straight off the SPORTS_TEAMS master. Signing players raised
// teamStrength permanently for a single up-front fee, so the optimal play was to buy every
// player on offer until teamStrength pinned at 100 and then collect forever. There was no
// decision to make after the first few weeks.
//
// Two things change that. Players now carry a weekly salary, so a stronger squad is a
// permanently heavier payroll -- strength has to be paid for every week, not once. And gate
// receipts split from sponsorship: gate follows fanBase (who shows up), sponsorship follows
// last season's win rate (who wants their logo on the shirt). Sponsorship lagging a full
// season means this season's spending shows up in next season's income, so the payoff for
// building a strong squad arrives late enough to be a real bet.
//
// Nothing here draws a random number: salaries, revenue splits and the season rollover are
// all pure functions of state the team already carries, so the deterministic fingerprint is
// untouched.
(function(){'use strict';
if(!globalThis.__capitalismTycoonModules)throw new Error('runtime.js must be loaded before sports-management.js.');
const modules=globalThis.__capitalismTycoonModules;
if(!modules.engine)throw new Error('engine.js must be loaded before sports-management.js.');
if(modules.sportsManagement)throw new Error('Sports management is already registered.');

const SEASON_WEEKS=52;

// Gate and sponsorship split the same headline revenue the team always earned, so an average
// team (fanBase 40, a .500 record) lands within a few percent of what it earned before.
const GATE_SHARE=.65;
const SPONSOR_SHARE=.35;
const GATE_FLOOR=.5;            // gate multiplier at fanBase 0 -- an empty stadium earns little
const SPONSOR_FLOOR=.4;         // sponsor multiplier at a winless season
const SPONSOR_SWING=1.6;        // added at a perfect season; sponsors chase winners hardest
const NEUTRAL_WIN_RATE=.5;      // assumed before a first season has ever been completed

// What a signing already costs up front is the whole multi-year package; the recurring salary
// is a share of it, spread weekly. The rates are set so that a squad strong enough to win most
// weeks costs slightly less in wages than the extra gate and sponsorship that winning brings
// in -- building a contender is profitable, but only just, and only once the fans arrive.
// Anything much higher made signing even three players an instant loss, which turned "never
// sign anyone" into the correct play and removed the decision entirely.
const DRAFT_SALARY_WEEKS=52;
const DRAFT_SALARY_RATE=.35;
const TRADE_SALARY_RATE=.12;
const FOREIGN_SALARY_RATE=.15;

const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Squads saved before players carried a salary still have to cost something, or an old save
// would be strictly better off than a new one. Derive it from whatever pricing the player was
// originally signed under.
function weeklySalaryFor(player){
  if(!player)return 0;
  const stored=finite(player.weeklySalary);
  if(stored>0)return Math.round(stored);
  const drafted=finite(player.expectedSalary);
  if(drafted>0)return Math.round(drafted*DRAFT_SALARY_RATE/DRAFT_SALARY_WEEKS);
  const traded=finite(player.askingPrice);
  if(traded>0)return Math.round(traded*TRADE_SALARY_RATE/DRAFT_SALARY_WEEKS);
  return 0;
}

function salaryFromDraft(candidate){
  return Math.round(Math.max(0,finite(candidate?.expectedSalary))*DRAFT_SALARY_RATE/DRAFT_SALARY_WEEKS);
}
function salaryFromTrade(asset){
  return Math.round(Math.max(0,finite(asset?.askingPrice))*TRADE_SALARY_RATE/DRAFT_SALARY_WEEKS);
}
function salaryFromForeign(fee){
  return Math.round(Math.max(0,finite(fee))*FOREIGN_SALARY_RATE/DRAFT_SALARY_WEEKS);
}

function payrollFor(team){
  return (Array.isArray(team?.roster)?team.roster:[]).reduce((sum,p)=>sum+weeklySalaryFor(p),0);
}

// The rate sponsors actually price against: last completed season if there is one, otherwise
// the season in progress, otherwise an assumed average team.
function sponsorWinRate(team){
  const last=Number(team?.lastSeasonWinRate);
  if(Number.isFinite(last))return clamp(last,0,1);
  const games=finite(team?.seasonGames);
  if(games>0)return clamp(finite(team?.seasonWins)/games,0,1);
  return NEUTRAL_WIN_RATE;
}

// The record being built right now, which is what the season rollover will freeze.
function currentWinRate(team){
  const games=finite(team?.seasonGames);
  return games>0?clamp(finite(team?.seasonWins)/games,0,1):0;
}

function gateRevenueFor(team){
  const base=Math.max(0,finite(team?.revenue));
  return base*GATE_SHARE*(GATE_FLOOR+clamp(finite(team?.fanBase),0,100)/100);
}

function sponsorRevenueFor(team){
  const base=Math.max(0,finite(team?.revenue));
  return base*SPONSOR_SHARE*(SPONSOR_FLOOR+sponsorWinRate(team)*SPONSOR_SWING);
}

// Whole yen, because finance.event rounds what it stores and the ledger has to agree with the
// cash balance exactly.
function weeklyFinancialsFor(team){
  const gate=Math.round(gateRevenueFor(team));
  const sponsor=Math.round(sponsorRevenueFor(team));
  const payroll=payrollFor(team);
  const fixedCost=Math.round(Math.max(0,finite(team?.cost)));
  return {gate,sponsor,revenue:gate+sponsor,payroll,fixedCost,cost:fixedCost+payroll,net:gate+sponsor-fixedCost-payroll};
}

function recordGameResult(team,win){
  if(!team)return;
  team.seasonGames=finite(team.seasonGames)+1;
  if(win)team.seasonWins=finite(team.seasonWins)+1;
}

// A season closes every SEASON_WEEKS weeks of ownership. Freezing the rate here is what makes
// sponsorship lag: the squad built this season is paid for now and rewarded from next season.
function seasonEndDue(team,week){
  const games=finite(team?.seasonGames);
  return games>0&&games%SEASON_WEEKS===0;
}

function rolloverSeason(team,week){
  if(!seasonEndDue(team,week))return false;
  team.lastSeasonWinRate=currentWinRate(team);
  team.lastSeasonWins=finite(team.seasonWins);
  team.seasonsCompleted=finite(team.seasonsCompleted)+1;
  team.seasonWins=0;
  team.seasonGames=0;
  return true;
}

// What the UI shows: the same numbers the weekly loop uses, plus the record behind them.
function summaryFor(team){
  const financials=weeklyFinancialsFor(team);
  return Object.freeze({
    ...financials,
    roster:(Array.isArray(team?.roster)?team.roster:[]).length,
    seasonWins:finite(team?.seasonWins),
    seasonGames:finite(team?.seasonGames),
    currentWinRate:currentWinRate(team),
    sponsorWinRate:sponsorWinRate(team),
    seasonsCompleted:finite(team?.seasonsCompleted),
    hasCompletedSeason:Number.isFinite(Number(team?.lastSeasonWinRate)),
    weeksLeftInSeason:SEASON_WEEKS-(finite(team?.seasonGames)%SEASON_WEEKS)
  });
}

modules.sportsManagement=Object.freeze({
  SEASON_WEEKS,GATE_SHARE,SPONSOR_SHARE,GATE_FLOOR,SPONSOR_FLOOR,SPONSOR_SWING,
  NEUTRAL_WIN_RATE,DRAFT_SALARY_WEEKS,DRAFT_SALARY_RATE,TRADE_SALARY_RATE,FOREIGN_SALARY_RATE,
  weeklySalaryFor,salaryFromDraft,salaryFromTrade,salaryFromForeign,payrollFor,
  sponsorWinRate,currentWinRate,gateRevenueFor,sponsorRevenueFor,weeklyFinancialsFor,
  recordGameResult,seasonEndDue,rolloverSeason,summaryFor,
  __installed:true
});
})();
