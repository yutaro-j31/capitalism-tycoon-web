// Script boundary: js/pe-fund.js (classic JavaScript)
//
// PE mode T5 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §2, §12): the fund container
// itself -- state.peFirm and the lifecycle of a single fund (formation week, investment
// period, term, and the rule that exit proceeds are distributed immediately and never
// reinvested). This file intentionally does not touch js/ma-deal-room.js; funds cannot yet
// finance an acquisition (that wiring is a later task) so state.peFirm.funds[].deals stays
// empty except in tests that seed it directly to exercise T7's DPI/next-fund math.
'use strict';
(function(){
const modules=globalThis.__capitalismTycoonModules;
if(!modules?.engine?.TycoonEngine)throw new Error('Capitalism Tycoon engine module must load before pe-fund.js.');
if(!modules?.completion)throw new Error('Capitalism Tycoon completion module must load before pe-fund.js.');
if(modules.peFund)throw new Error('Capitalism Tycoon peFund module is already registered.');
const EngineClass=modules.engine.TycoonEngine;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));
const arr=v=>Array.isArray(v)?v:[];

// ファンド期間10年・投資期間5年（設計書§2）。週次エンジンなので週数で扱う。
const FUND_TERM_WEEKS=520;
const INVESTMENT_PERIOD_WEEKS=260;
// PE mode T7: 次号組成の条件（設計書§3 関門3）。
const NEXT_FUND_MIN_DPI=1.2;
const NEXT_FUND_MIN_DEPLOYMENT=.8;

function defaultTrackRecord(){return {score:0,exits:[],realizedDPI:0};}
function defaultPeFirm(){return {trackRecord:defaultTrackRecord(),funds:[],ddSlotsPerYear:3,unlocked:false};}

function ensureFund(f,week){
  if(!f)return f;
  f.lps=arr(f.lps);
  f.deals=arr(f.deals).slice(-500);
  f.terms=f.terms&&typeof f.terms==='object'?f.terms:{fee:0,carry:0,hurdle:0};
  f.terms.fee=Math.max(0,finite(f.terms.fee));
  f.terms.carry=Math.max(0,finite(f.terms.carry));
  f.terms.hurdle=Math.max(0,finite(f.terms.hurdle));
  f.size=Math.max(0,finite(f.size));
  f.gpCommit=Math.max(0,finite(f.gpCommit));
  f.y0=Math.max(1,Math.floor(finite(f.y0,week)));
  // T5 simplification: the whole committed size is called at formation (cash=size,
  // undrawn=0) rather than modeling a gradual capital-call schedule, since no deal-financing
  // mechanic exists yet to draw against a schedule. undrawn is kept in the shape (per the
  // design doc's fund contract) for a later task to actually use.
  f.cash=Math.max(0,finite(f.cash,f.size));
  f.undrawn=Math.max(0,finite(f.undrawn,0));
  f.distributed=Math.max(0,finite(f.distributed,0));
  f.undeployedReturned=Math.max(0,finite(f.undeployedReturned,0));
  f.investmentDeadlineWeek=f.y0+INVESTMENT_PERIOD_WEEKS;
  f.deadlineWeek=f.y0+FUND_TERM_WEEKS;
  f.status=f.status||'investing';
  f.lastProcessedWeek=Math.max(0,Math.floor(finite(f.lastProcessedWeek,f.y0)));
  return f;
}

function ensure(state){
  if(!state)return state;
  if(!state.peFirm||typeof state.peFirm!=='object')state.peFirm=defaultPeFirm();
  const pf=state.peFirm;
  pf.trackRecord=pf.trackRecord&&typeof pf.trackRecord==='object'?pf.trackRecord:defaultTrackRecord();
  pf.trackRecord.exits=arr(pf.trackRecord.exits).slice(-200);
  pf.trackRecord.score=clamp(finite(pf.trackRecord.score),0,100);
  pf.trackRecord.realizedDPI=Math.max(0,finite(pf.trackRecord.realizedDPI));
  pf.funds=arr(pf.funds).slice(-20);
  pf.ddSlotsPerYear=Math.max(1,Math.floor(finite(pf.ddSlotsPerYear,3)));
  pf.unlocked=Boolean(pf.unlocked);
  pf.funds.forEach(f=>ensureFund(f,finite(state.week,1)));
  if(!Number.isFinite(finite(state.currentCompanyFoundedInvestment,NaN)))state.currentCompanyFoundedInvestment=Math.max(1,finite(state.companyCash,8_000_000));
  return state;
}

// PE mode T6 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §3 関門2): GP出資・報酬条件.
// GP commits GP_COMMIT_FRACTION_OF_PERSONAL_CASH of personal cash; the required GP ratio
// falls (and the formable fund size rises) as trackRecord.score climbs. Formulas are the
// task doc's literal ones, not the design doc's illustrative table (which mixes in later
// LP-trust history from its own simulation and doesn't reduce to one clean formula).
const GP_COMMIT_FRACTION_OF_PERSONAL_CASH=.5;
function requiredGPRatio(score){return clamp(.20-.18*Math.pow(clamp(score,0,100)/100,.7),.02,.20);}
function managementFeeRate(score){return .015+.01*(clamp(score,0,100)/100);}
function carryRate(score){return .15+.10*(clamp(score,0,100)/100);}
function hurdleRate(score){return .10-.02*(clamp(score,0,100)/100);}
function fundTermsForScore(score){return {fee:managementFeeRate(score),carry:carryRate(score),hurdle:hurdleRate(score)};}
// LP信頼度（設計書§3）: reacts to the most recently EVALUATED fund's DPI tier (set by T7's
// evaluateFund below). Until any fund has been evaluated there is no history to react to, so
// it stays neutral (1).
function lpTrustMultiplier(state){ensure(state);const funds=state.peFirm.funds;for(let i=funds.length-1;i>=0;i--){const f=funds[i];if(Number.isFinite(f.dpiAtEvaluation))return f.dpiAtEvaluation>=NEXT_FUND_MIN_DPI?1.12:f.dpiAtEvaluation>=1.0?.80:.55;}return 1;}
function formableFundSize(state){
  ensure(state);
  const ratio=requiredGPRatio(state.peFirm.trackRecord.score);
  const gpBudget=Math.max(0,finite(state.personalCash))*GP_COMMIT_FRACTION_OF_PERSONAL_CASH;
  const funds=state.peFirm.funds,latestFund=funds[funds.length-1];
  const promiseMultiplier=latestFund?promiseComplianceMultiplier(latestFund):1;
  return ratio>0?gpBudget/ratio*lpTrustMultiplier(state)*promiseMultiplier:0;
}

// PE mode T6: a single exit's "quality" in [0,1], composited from MOIC, speed, and business
// quality (profitable-week streak + headcount). Weights and curve shape are this file's own
// calibration -- neither doc gives an exact formula, only the two testable bounds: a first
// exit must land in [5,15], and the score must climb toward 100 with a longer, better track
// record.
function exitQuality(exit){
  const moicQ=clamp((finite(exit.personalMOIC,1)-1)/2,0,1);
  const speedQ=clamp(1-(finite(exit.yearsElapsed,10)-1)/9,0,1);
  // A fund-level track-record entry (T7's evaluateFund) has no employee/profit-streak
  // concept of its own -- it is the fund's blended DPI, not one company -- so it is scored
  // purely on MOIC and speed instead of diluting those with a fabricated quality signal.
  if(exit.exitType==='fund')return moicQ*.6+speedQ*.4;
  const qualityQ=clamp(finite(exit.profitableWeekStreak)/260,0,1)*.7+clamp(finite(exit.employeeCount)/50,0,1)*.3;
  return moicQ*.4+speedQ*.2+qualityQ*.4;
}
function computeTrackScore(exits){
  const list=arr(exits);
  if(!list.length)return 0;
  const n=list.length;
  const ceilingFor=k=>k<=1?15:Math.min(100,15+(k-1)*20);
  const ceiling=ceilingFor(n),floor=ceilingFor(n-1);
  const avgQuality=list.reduce((sum,e)=>sum+exitQuality(e),0)/n;
  return Math.round(clamp(floor+avgQuality*(ceiling-floor),0,100));
}

// Records one Exit (会社売却・IPO・子会社売却) into trackRecord.exits and refreshes the
// composite score. Unlocks PE mode on the very first exit (設計書§3 関門1).
function recordExit(state,{exitType,realizedAmount=0,investedAmount=1,foundedWeek=1,exitedWeek=1,profitableWeekStreak=0,employeeCount=0}={}){
  ensure(state);
  const investedSafe=Math.max(1,finite(investedAmount,1));
  const personalMOIC=Math.max(0,finite(realizedAmount)/investedSafe);
  const yearsElapsed=Math.max(1/52,(finite(exitedWeek)-finite(foundedWeek))/52);
  const entry={id:`pe-exit-${state.peFirm.trackRecord.exits.length+1}-${finite(exitedWeek)}`,exitType:String(exitType||'unknown'),realizedAmount:Math.max(0,finite(realizedAmount)),investedAmount:investedSafe,personalMOIC,yearsElapsed,profitableWeekStreak:Math.max(0,finite(profitableWeekStreak)),employeeCount:Math.max(0,finite(employeeCount)),recordedWeek:Math.max(1,finite(state.week,1))};
  state.peFirm.trackRecord.exits.push(entry);
  state.peFirm.trackRecord.exits=state.peFirm.trackRecord.exits.slice(-200);
  state.peFirm.trackRecord.score=computeTrackScore(state.peFirm.trackRecord.exits);
  state.peFirm.unlocked=true;
  return entry;
}

// Derives the 4 recorded items (設計書§3) from state for an exit of the CURRENT company
// (whole-company buyout, or an IPO founder-share sale that doesn't end the company).
function recordExitForCurrentCompany(state,exitType,realizedAmount){
  ensure(state);
  const foundedWeek=Math.max(1,finite(state.currentCompanyFoundedWeek,1));
  const exitedWeek=Math.max(foundedWeek,finite(state.week,foundedWeek));
  const investedAmount=Math.max(1,finite(state.currentCompanyFoundedInvestment,8_000_000));
  const history=arr(state.weeklyProfitHistory);
  let profitableWeekStreak=0;
  for(let i=history.length-1;i>=0&&finite(history[i])>0;i--)profitableWeekStreak++;
  const employeeCount=arr(state.workforceTeams).reduce((sum,t)=>sum+Math.max(0,finite(t?.headcount)),0);
  return recordExit(state,{exitType,realizedAmount,investedAmount,foundedWeek,exitedWeek,profitableWeekStreak,employeeCount});
}

// Test/internal-only fund creation (no UI action yet -- see file header). Returns the
// created fund. y0 defaults to the current week.
function createFund(state,{size=0,gpCommit=0,terms={fee:0,carry:0,hurdle:0},lps=[],y0}={}){
  ensure(state);
  const fund={id:`pe-fund-${state.peFirm.funds.length+1}-${finite(state.week,1)}`,size:Math.max(0,finite(size)),gpCommit:Math.max(0,finite(gpCommit)),lps:arr(lps),terms:{...terms},y0:Math.max(1,Math.floor(finite(y0,finite(state.week,1)))),cash:Math.max(0,finite(size)),undrawn:0,distributed:0,deals:[],status:'investing'};
  ensureFund(fund,finite(state.week,1));
  state.peFirm.funds.push(fund);
  return fund;
}

// PE mode T7 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §3 関門3): DPI / IRR and the
// next-fund formation gate. T5 calls a fund's entire size at formation, so "出資総額" is just
// fund.size; fundDeployed reads state.peFirm.funds[].deals, which stays empty until a later
// task can actually finance an acquisition from a fund -- tests exercise this by pushing
// synthetic deal records directly.
function fundContributed(fund){return Math.max(0,finite(fund?.size));}
function fundDeployed(fund){return arr(fund?.deals).reduce((sum,d)=>sum+Math.max(0,finite(d?.investedAmount)),0);}
function fundDeploymentRate(fund){const c=fundContributed(fund);return c>0?clamp(fundDeployed(fund)/c,0,1):0;}
function fundDPI(fund){const c=fundContributed(fund);return c>0?Math.max(0,finite(fund.distributed))/c:0;}
// Approximates IRR as the fund's compound annual growth rate (distributed/contributed over
// elapsed years). This is not a true multi-cashflow XIRR, but neither doc's next-fund gate or
// LP-trust tiers are defined in terms of IRR (both use DPI), so a closer approximation isn't
// load-bearing for any tested behavior -- IRR here is informational.
function fundIRR(fund,currentWeek){
  const years=Math.max(1/52,(finite(currentWeek,fund.y0)-fund.y0)/52);
  const dpi=fundDPI(fund);
  return dpi>0?Math.pow(dpi,1/years)-1:-1;
}
// Evaluates a fund's current performance: records its DPI for js/pe-fund.js's own LP-trust
// tiering (lpTrustMultiplier), and -- only when at least NEXT_FUND_MIN_DEPLOYMENT of its
// capital was actually deployed -- feeds that performance into trackRecord (a fund that
// mostly sat in cash and returned it undeployed does not get credited, per the task doc's
// "資金消化80%未満だと実績が加算されない"). Callable at any time (no auto-trigger from
// processFundsWeek yet -- there is no fund-financed deal-exit mechanic to react to until a
// later task, so a test or a future "raise the next fund" action calls this on demand).
function evaluateFund(state,fundID,evaluationWeek){
  ensure(state);
  const fund=state.peFirm.funds.find(f=>f.id===fundID);
  if(!fund)return null;
  const week=Math.max(fund.y0,finite(evaluationWeek,finite(state.week,fund.y0)));
  const dpi=fundDPI(fund),deploymentRate=fundDeploymentRate(fund);
  fund.dpiAtEvaluation=dpi;
  fund.deploymentRateAtEvaluation=deploymentRate;
  fund.evaluatedWeek=week;
  state.peFirm.trackRecord.realizedDPI=dpi;
  const trackRecordAdded=deploymentRate>=NEXT_FUND_MIN_DEPLOYMENT;
  if(trackRecordAdded){
    // 設計書: 未投資返却分（額面1.0x）はファンド全体のDPI(上のdpi/fundDPI)には含めるが、
    // トラックレコードのスコア計算には一切加算しない。ここで使うMOICは、実際に投資に
    // 回した分（fundDeployed）が生んだ回収額（distributed-undeployedReturned）だけを
    // 分子・分母に使い、未投資分を除外する。
    const deployedInvested=Math.max(1,fundDeployed(fund));
    const deployedRealized=Math.max(0,finite(fund.distributed)-finite(fund.undeployedReturned));
    recordExit(state,{exitType:'fund',realizedAmount:deployedRealized,investedAmount:deployedInvested,foundedWeek:fund.y0,exitedWeek:week});
  }
  return {dpi,deploymentRate,irr:fundIRR(fund,week),trackRecordAdded};
}
// 次号を組成できる条件（設計書§3）: DPI 1.2倍以上 かつ 資金消化80%以上。最新のファンドが
// 評価済みならその値を、未評価ならその場で計算した現在値を使う。ファンドがまだ無ければ
// Fund Iの話（T6の解禁条件のみ）。
function canFormNextFund(state){
  ensure(state);
  const funds=state.peFirm.funds;
  if(!funds.length)return state.peFirm.unlocked;
  const latest=funds[funds.length-1];
  const dpi=Number.isFinite(latest.dpiAtEvaluation)?latest.dpiAtEvaluation:fundDPI(latest);
  const deploymentRate=Number.isFinite(latest.deploymentRateAtEvaluation)?latest.deploymentRateAtEvaluation:fundDeploymentRate(latest);
  return dpi>=NEXT_FUND_MIN_DPI&&deploymentRate>=NEXT_FUND_MIN_DEPLOYMENT;
}

// PE mode T8 (docs/PE_MODE_TASKS.md / docs/PE_MODE_DESIGN.md §3 関門3): LP面談. This is
// deliberately NOT a "decision" screen (§9 failure 7 found every LP-mix optimization reduces
// to "raise the max regardless") -- it is progress visibility (which LPs are meetable),
// evaluation of the last fund, and promise bookkeeping. Meet conditions follow the design
// doc's table; each LP type's accompanying condition is a PROMISE (something the player can
// accept or decline, never a hard constraint), except formerColleague/wealthyFamilyOffice,
// whose rows describe a passive risk instead of an active promise to keep.
const LP_TYPES=Object.freeze({
  formerColleague:Object.freeze({id:'formerColleague',name:'元同僚・知人',scale:'小',meetConditionLabel:'実績不問',promiseID:null,promiseLabel:null,riskLabel:'失敗すると人間関係の記録が残る'}),
  wealthyFamilyOffice:Object.freeze({id:'wealthyFamilyOffice',name:'富裕層・ファミリーオフィス',scale:'小〜中',meetConditionLabel:'Exit経験1回',promiseID:null,promiseLabel:null,riskLabel:'途中解約を言い出すことがある'}),
  regionalBankCorporate:Object.freeze({id:'regionalBankCorporate',name:'地方銀行・事業会社',scale:'中',meetConditionLabel:'スコア30',promiseID:'localInvestment',promiseLabel:'地元企業へ2件以上投資する',riskLabel:null}),
  pensionFund:Object.freeze({id:'pensionFund',name:'年金基金',scale:'大',meetConditionLabel:'DPI 1.2倍実績',promiseID:'quarterlyReporting',promiseLabel:'四半期報告を行う',riskLabel:null}),
  universitySovereign:Object.freeze({id:'universitySovereign',name:'大学基金・政府系',scale:'最大',meetConditionLabel:'実現実績2本',promiseID:'investmentRestriction',promiseLabel:'投資対象を制約に従わせる',riskLabel:null})
});
const LP_TYPE_IDS=Object.freeze(Object.keys(LP_TYPES));
// 破っても即ペナルティではなく、次号の調達額が目減りするだけ（設計書「守れないと次号で
// 不利になるだけ」）。全履行なら1.0（ボーナスなし）、全不履行ならこの下限まで下がる。
const PROMISE_BROKEN_FLOOR=.7;
// ファンド1本あたりのLP件数上限。現状LP_TYPESは5種類しかないため同一タイプ拒否と
// 実質同じ効果になるが、T14でLP面談UIが付く前に上限自体を明示しておく。
const MAX_LPS_PER_FUND=5;

function meetsLPCondition(state,lpTypeID){
  ensure(state);
  const tr=state.peFirm.trackRecord;
  if(lpTypeID==='formerColleague')return true;
  if(lpTypeID==='wealthyFamilyOffice')return tr.exits.length>=1;
  if(lpTypeID==='regionalBankCorporate')return tr.score>=30;
  if(lpTypeID==='pensionFund')return state.peFirm.funds.some(f=>Number.isFinite(f.dpiAtEvaluation)&&f.dpiAtEvaluation>=NEXT_FUND_MIN_DPI);
  if(lpTypeID==='universitySovereign')return tr.exits.length>=2;
  return false;
}
// 進捗の可視化（画面6）: 会えるLPだけでなく、会えないLPも条件付きで返す。
function visibleLPTypes(state){
  ensure(state);
  return LP_TYPE_IDS.map(id=>({...LP_TYPES[id],meetable:meetsLPCondition(state,id)}));
}

// 案件ではなくLPとの間の「約束」。断っても(promiseAccepted:false)ペナルティは無く、単に
// その分の金額が小さいだけ（金額そのものはUIが無いためcommittedAmountを呼び出し側が渡す）。
function addLPCommitment(fund,{lpTypeID,committedAmount=0,promiseAccepted=false}={}){
  if(!fund||!LP_TYPES[lpTypeID])return null;
  fund.lps=arr(fund.lps);
  if(fund.lps.some(c=>c.lpTypeID===lpTypeID))return null; // 同一LPタイプは1ファンドにつき1件まで
  if(fund.lps.length>=MAX_LPS_PER_FUND)return null; // ファンド1本あたりのLP件数上限
  const commitment={lpTypeID,committedAmount:Math.max(0,finite(committedAmount)),promiseAccepted:Boolean(promiseAccepted)&&Boolean(LP_TYPES[lpTypeID].promiseID),promiseFulfilled:null};
  fund.lps.push(commitment);
  return commitment;
}
// 約束の達成状況を記録する。fulfilled=null (未評価) はそのまま、true/falseで確定させる。
function recordLPPromiseOutcome(fund,lpTypeID,fulfilled){
  if(!fund)return null;
  const commitment=arr(fund.lps).find(c=>c.lpTypeID===lpTypeID&&c.promiseAccepted);
  if(!commitment)return null;
  commitment.promiseFulfilled=Boolean(fulfilled);
  return commitment;
}
// 次号の調達額への反映（完了条件）。承諾した約束のうち何割を守れたかで1.0(全履行)〜
// PROMISE_BROKEN_FLOOR(全不履行)を線形補間する。約束が無い/未評価ならニュートラル(1)。
function promiseComplianceMultiplier(fund){
  const accepted=arr(fund?.lps).filter(c=>c.promiseAccepted&&c.promiseFulfilled!==null);
  if(!accepted.length)return 1;
  const rate=accepted.filter(c=>c.promiseFulfilled).length/accepted.length;
  return PROMISE_BROKEN_FLOOR+clamp(rate,0,1)*(1-PROMISE_BROKEN_FLOOR);
}
// 既存LPは自動継続（設計書）。前号のLP構成をそのまま次号の出発点として返す。実際に次号へ
//引き継ぐかどうかは呼び出し側（将来のUI）が決める。
function continuingLPCommitments(state){
  ensure(state);
  const funds=state.peFirm.funds;
  if(!funds.length)return [];
  return arr(funds[funds.length-1].lps).map(c=>({...c}));
}

// PE mode T5: exit proceeds are distributed immediately and never reinvested (design doc §9
// failure 3) -- so weekly processing here only ever moves cash OUT of a fund (to distributed)
// or advances its lifecycle status, it never adds cash back into fund.cash from a return.
function processFundsWeek(state,week){
  ensure(state);
  for(const fund of state.peFirm.funds){
    if(fund.status==='closed'){fund.lastProcessedWeek=Math.max(fund.lastProcessedWeek,week);continue;}
    if(fund.lastProcessedWeek>=week){continue;}
    if(fund.status==='investing'&&week>=fund.investmentDeadlineWeek){
      // 投資期間終了。使い切れなかった資金は額面(1.0x)でLP・GPへ返す。
      if(fund.cash>0){const returned=fund.cash;fund.distributed+=returned;fund.undeployedReturned+=returned;fund.cash=0;}
      fund.status='harvesting';
    }
    if(week>=fund.deadlineWeek&&fund.status!=='closed'){
      if(fund.cash>0){const returned=fund.cash;fund.distributed+=returned;fund.undeployedReturned+=returned;fund.cash=0;}
      fund.status='closed';
      fund.closedWeek=week;
    }
    fund.lastProcessedWeek=week;
  }
  return state;
}

function install(){
  const proto=EngineClass.prototype;
  if(proto.__peFundInstalled)return true;
  const baseNormalize=proto.normalize;
  proto.normalize=function(){const r=baseNormalize.call(this);ensure(this.g);return r;};
  // executeIPO is a plain class method on TycoonEngine (js/engine.js), available immediately
  // -- unlike recordCurrentCompany/configure/foundNewCompanyAfterBuyout below, which only
  // exist once js/completion.js's exported installCompletion(TycoonEngine) actually runs (see
  // installCompletionDependentHooks).
  const baseExecuteIPO=proto.executeIPO;
  proto.executeIPO=function(market,sellShares){
    const before=finite(this.g.personalCash);
    const r=baseExecuteIPO.call(this,market,sellShares);
    if(r===true){
      const founderSale=finite(this.g.personalCash)-before;
      if(founderSale>0)recordExitForCurrentCompany(this.g,'ipo',founderSale);
    }
    return r;
  };
  const baseAdvanceWeek=proto.advanceWeek;
  proto.advanceWeek=function(showSummary=true){
    return this.runTransaction(()=>{
      const before=finite(this.g.week);
      const r=baseAdvanceWeek.call(this,false);
      if(r!==false){
        ensure(this.g);
        if(this.g.peFirm.funds.length)for(let w=before+1;w<=finite(this.g.week);w++)processFundsWeek(this.g,w);
      }
      return r;
    },'week',()=>({summary:showSummary?this.g.lastWeeklySummary:null}));
  };
  Object.defineProperty(proto,'__peFundInstalled',{value:true});
  return true;
}
install();

// PE mode T6: js/completion.js only *defines* installCompletion(TycoonEngine) -- app.js is
// what actually calls it (alongside installMADealRoom etc.), late in the canonical script
// order. recordCurrentCompany/configure/foundNewCompanyAfterBuyout do not exist on the
// prototype until that call happens, so wrapping them here at pe-fund.js's own load time
// would silently wrap `undefined` and then be clobbered when installCompletion runs afterward
// and (re)defines them from scratch. js/pe-value-creation.js solves the identical problem
// (there, waiting on installExpansion) the same way: defer to DOMContentLoaded, which in both
// the real page and tests/harness.js's simulated one fires only after every synchronous
// script -- app.js included -- has already run.
function installCompletionDependentHooks(){
  const proto=EngineClass.prototype;
  if(proto.__peFundCompletionHooksInstalled)return true;
  if(typeof proto.recordCurrentCompany!=='function'||typeof proto.foundNewCompanyAfterBuyout!=='function'||typeof proto.configure!=='function')return false;
  // recordCurrentCompany is the one call site behind selling the whole company (会社売却).
  // No existing action pays the founder personally for a *subsidiary* sale
  // (sellMASubsidiary/ipoSubsidiary credit companyCash, not personalCash), so "子会社売却"
  // has nothing to hook yet -- recordExit stays generic enough for a later task to call
  // directly once/if such a flow is added.
  const baseRecordCurrentCompany=proto.recordCurrentCompany;
  proto.recordCurrentCompany=function(exitType,exitPrice=0,founderProceeds=0,note=''){
    const r=baseRecordCurrentCompany.call(this,exitType,exitPrice,founderProceeds,note);
    recordExitForCurrentCompany(this.g,exitType,founderProceeds);
    return r;
  };
  const baseFoundNewCompanyAfterBuyout=proto.foundNewCompanyAfterBuyout;
  proto.foundNewCompanyAfterBuyout=function(companyName,investment,mode){
    const r=baseFoundNewCompanyAfterBuyout.call(this,companyName,investment,mode);
    ensure(this.g);
    this.g.currentCompanyFoundedInvestment=Math.max(1,finite(investment,this.g.companyCash));
    return r;
  };
  const baseConfigure=proto.configure;
  proto.configure=function(options){
    const r=baseConfigure.call(this,options);
    ensure(this.g);
    this.g.currentCompanyFoundedInvestment=Math.max(1,finite(this.g.companyCash,8_000_000));
    return r;
  };
  Object.defineProperty(proto,'__peFundCompletionHooksInstalled',{value:true});
  return true;
}
if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
  if(!EngineClass.prototype.__peFundCompletionHooksInstalled)document.addEventListener('DOMContentLoaded',installCompletionDependentHooks,{once:true});
}

modules.peFund=Object.freeze({
  FUND_TERM_WEEKS,INVESTMENT_PERIOD_WEEKS,GP_COMMIT_FRACTION_OF_PERSONAL_CASH,NEXT_FUND_MIN_DPI,NEXT_FUND_MIN_DEPLOYMENT,
  ensure,ensureFund,createFund,processFundsWeek,install,installCompletionDependentHooks,
  requiredGPRatio,managementFeeRate,carryRate,hurdleRate,fundTermsForScore,formableFundSize,lpTrustMultiplier,
  exitQuality,computeTrackScore,recordExit,recordExitForCurrentCompany,
  fundContributed,fundDeployed,fundDeploymentRate,fundDPI,fundIRR,evaluateFund,canFormNextFund,
  LP_TYPES,LP_TYPE_IDS,PROMISE_BROKEN_FLOOR,MAX_LPS_PER_FUND,meetsLPCondition,visibleLPTypes,addLPCommitment,recordLPPromiseOutcome,promiseComplianceMultiplier,continuingLPCommitments,
  __installed:true
});
})();
