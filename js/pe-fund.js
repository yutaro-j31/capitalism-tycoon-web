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
if(modules.peFund)throw new Error('Capitalism Tycoon peFund module is already registered.');
const EngineClass=modules.engine.TycoonEngine;

const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,finite(v,min)));
const arr=v=>Array.isArray(v)?v:[];

// ファンド期間10年・投資期間5年（設計書§2）。週次エンジンなので週数で扱う。
const FUND_TERM_WEEKS=520;
const INVESTMENT_PERIOD_WEEKS=260;

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

// Test/internal-only fund creation (no UI action yet -- see file header). Returns the
// created fund. y0 defaults to the current week.
function createFund(state,{size=0,gpCommit=0,terms={fee:0,carry:0,hurdle:0},lps=[],y0}={}){
  ensure(state);
  const fund={id:`pe-fund-${state.peFirm.funds.length+1}-${finite(state.week,1)}`,size:Math.max(0,finite(size)),gpCommit:Math.max(0,finite(gpCommit)),lps:arr(lps),terms:{...terms},y0:Math.max(1,Math.floor(finite(y0,finite(state.week,1)))),cash:Math.max(0,finite(size)),undrawn:0,distributed:0,deals:[],status:'investing'};
  ensureFund(fund,finite(state.week,1));
  state.peFirm.funds.push(fund);
  return fund;
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

modules.peFund=Object.freeze({
  FUND_TERM_WEEKS,INVESTMENT_PERIOD_WEEKS,
  ensure,ensureFund,createFund,processFundsWeek,install,
  __installed:true
});
})();
